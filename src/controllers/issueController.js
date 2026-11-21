import mongoose from 'mongoose';
import Issue from '../models/issue.model.js';
import ErrorEvent from '../models/errorevent.model.js';
import Branch from '../models/branch.model.js';

// 1. GET /api/v1/issues - Fetch grouped issues with status filtering & pagination
export const getIssues = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const issues = await Issue.find(query)
      .sort({ lastSeen: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Issue.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: issues,
    });
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
};

// 2. GET /api/v1/issues/:id - Fetch a single issue along with its recent error event logs
export const getIssueDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid Issue ID format' });
    }

    // Capitalized Issue model prevents variable collisions
    const issueDoc = await Issue.findById(id);
    if (!issueDoc) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Fetch the 50 most recent occurrence logs for this specific issue
    const events = await ErrorEvent.find({ issueId: id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: {
        issue: issueDoc,
        events,
      },
    });
  } catch (error) {
    console.error('Failed to fetch issue details:', error);
    res.status(500).json({ error: 'Failed to fetch issue details' });
  }
};

// 3. PATCH /api/v1/issues/:id/status - Update issue status
export const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid Issue ID format' });
    }

    const validStatuses = ['UNRESOLVED', 'IN_PROGRESS', 'RESOLVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updatedIssue = await Issue.findByIdAndUpdate(
      id,
      { status },
      { returnDocument: 'after' }
    );

    if (!updatedIssue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Safe WebSockets broadcast
    const io = req.io || req.app.get('socketio');
    if (io && typeof io.to === 'function') {
      io.to('developers-room').emit('issue_status_changed', {
        issueId: updatedIssue._id,
        status: updatedIssue.status,
      });
    }

    res.json({
      success: true,
      data: updatedIssue,
    });
  } catch (error) {
    console.error('Failed to update issue status:', error);
    res.status(500).json({ error: 'Failed to update issue status' });
  }
};