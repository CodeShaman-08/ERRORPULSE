import express from 'express';
import {
  getIssues,
  getIssueDetails,
  updateIssueStatus,
} from '../controllers/issueController.js';

const router = express.Router();

// GET /api/v1/issues - List all issues with filtering & pagination
router.get('/', getIssues);

// GET /api/v1/issues/:id - Get details and recent logs for a specific issue
router.get('/:id', getIssueDetails);

// PATCH /api/v1/issues/:id/status - Update issue status (UNRESOLVED, IN_PROGRESS, RESOLVED)
router.patch('/:id/status', updateIssueStatus);

export default router;