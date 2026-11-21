import express from 'express';
import { getBranches, createBranch } from '../controllers/branchController.js';

const router = express.Router();

// GET /api/v1/branches - Get list of registered branches
router.get('/', getBranches);

// POST /api/v1/branches - Register a new branch and generate API Key
router.post('/', createBranch);

export default router; 