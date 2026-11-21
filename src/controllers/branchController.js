import crypto from 'crypto';
import Branch from '../models/branch.model.js';

// 1. GET /api/v1/branches - Fetch all registered branches/apps
export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: branches,
      apiKey: branches.map((b) => b.apiKey), // Return API keys for each branch
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
};

// 2. POST /api/v1/branches - Create a new branch/app and generate a secure API Key
export const createBranch = async (req, res) => {
  try {
    const { branchName, environment } = req.body;

    if (!branchName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    // Generate a unique 32-character hex API Key
    const apiKey = `ep_${crypto.randomBytes(16).toString('hex')}`;

    const branch = await Branch.create({
      branchName,
      environment: environment || 'development',
      apiKey,
    });

    res.status(201).json({
      success: true,
      data: branch,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Branch name already exists' });
    }
    res.status(500).json({ error: 'Failed to create branch' });
  }
};