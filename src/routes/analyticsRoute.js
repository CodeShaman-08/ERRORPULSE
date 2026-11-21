import express from 'express';
import {
  getDashboardStats,
  getTopFailingRoutes,
} from '../controllers/analyticsController.js';

const router = express.Router();

// GET /api/v1/analytics/stats - Overview metrics (total, unresolved, resolved count)
router.get('/stats', getDashboardStats);

// GET /api/v1/analytics/top-routes - Top 5 failing routes
router.get('/top-routes', getTopFailingRoutes);

export default router;