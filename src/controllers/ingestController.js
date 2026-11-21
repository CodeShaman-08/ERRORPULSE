import issue from '../models/issue.model.js';
import errorevent from '../models/errorevent.model.js';
import Branch from '../models/branch.model.js';
import { generateFingerprint } from '../utils/fingerprint.js';

export const logError = async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    // 1. Validate API Key
    if (!apiKey) {
      return res.status(401).json({ error: 'API Key missing' });
    }

    const branch = await Branch.findOne({ apiKey });
    if (!branch) {
      return res.status(403).json({ error: 'Invalid API Key' });
    }

    const { message, stack, route, httpMethod, headers, userContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Error message is required' });
    }

    // 2. Generate unique fingerprint hash
    const fingerprint = generateFingerprint(message, stack);

    // 3. Optimized Atomic DB Update: Find existing issue or create a new one
    let foundIssue = await issue.findOneAndUpdate(
      { fingerprint },
      {
        $inc: { count: 1 },                 // Increment count by 1
        $set: {                             // Keep metadata updated
          title: message,
          stackTrace: stack || '',
          lastSeen: new Date(),
          status: 'UNRESOLVED',            // Re-open if it was previously marked resolved
        },
        $setOnInsert: {                     // Fields set ONLY when creating a new issue
          branchId: branch._id,
          firstSeen: new Date(),
        },
      },
      { new: true, upsert: true }           // Return updated doc; create if doesn't exist
    );

    // 4. Log individual Error Event
    await errorevent.create({
      issueId: foundIssue._id,
      branchId: branch._id,
      route: route || 'N/A',
      httpMethod: httpMethod || 'UNKNOWN',
      headers: headers || {},
      userContext: userContext || {},
    });
    // Determine if it was newly inserted or an existing issue updated
    const isNewIssue = foundIssue.count === 1;

    const payload = {
      issueId: foundIssue._id,
      title: foundIssue.title,
      count: foundIssue.count,
      status: foundIssue.status,
      lastSeen: foundIssue.lastSeen,
      branchId: branch._id,
      branchName: branch.branchName,
    };

 const io = req.io || req.app.get('socketio');
    if (io && typeof io.to === 'function') {
      const eventName = isNewIssue ? 'new_error_event' : 'issue_updated';
      io.to('developers-room').emit(eventName, payload);
    }
     
    res.status(201).json({
      success: true,
      issueId: foundIssue._id,
      count: foundIssue.count,
    });
  } catch (error) {
    console.error('Ingestion Error:', error);
    res.status(500).json({ error: 'Failed to process error log' });
  }
};