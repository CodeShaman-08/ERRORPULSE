import issue from '../models/issue.model.js';
import errorevent from '../models/errorevent.model.js';

// GET /api/v1/analytics/stats - Overview counts for metrics cards
export const getDashboardStats = async (req, res) => {
  try {
    const totalIssues = await issue.countDocuments();
    const unresolvedIssues = await issue.countDocuments({ status: 'UNRESOLVED' });
    const inProgressIssues = await issue.countDocuments({ status: 'IN_PROGRESS' });
    const resolvedIssues = await issue.countDocuments({ status: 'RESOLVED' });
    const totalCrashEvents = await errorevent.countDocuments();

    res.json({
      success: true,
      data: {
        totalIssues,
        unresolvedIssues,
        inProgressIssues,
        resolvedIssues,
        totalCrashEvents,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

// GET /api/v1/analytics/top-routes - Top 5 crashing API endpoints
export const getTopFailingRoutes = async (req, res) => {
  try {
    const topRoutes = await errorevent.aggregate([
      {
        $group: {
          _id: '$route',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: topRoutes.map((r) => ({ route: r._id, crashes: r.count })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top failing routes' });
  }
};