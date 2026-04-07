const User          = require('../models/User');
const Lake          = require('../models/Lake');
const BassPorn      = require('../models/BassPorn');
const FishingReport = require('../models/FishingReport');
const Review        = require('../models/Review');
const Comment       = require('../models/Comment');
const ContactMessage= require('../models/ContactMessage');
const AuditLog      = require('../models/AuditLog');
const { success, serverError } = require('../utils/apiResponse');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get admin dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalLakes,
      pendingLakes,
      totalCatches,
      totalReports,
      totalReviews,
      totalComments,
      openContacts,
      recentUsers,
      previousUsers,
      recentLakes,
      previousLakes,
    ] = await Promise.all([
      User.countDocuments(),
      Lake.countDocuments({ status: 'active' }),
      Lake.countDocuments({ status: 'pending' }),
      BassPorn.countDocuments({ status: 'active' }),
      FishingReport.countDocuments({ status: 'active' }),
      Review.countDocuments({ status: 'active' }),
      Comment.countDocuments({ status: 'active' }),
      ContactMessage.countDocuments({ status: 'open' }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      User.countDocuments({ createdAt: { $gte: twoMonthsAgo, $lt: monthAgo } }),
      Lake.countDocuments({ status: 'active', createdAt: { $gte: monthAgo } }),
      Lake.countDocuments({ status: 'active', createdAt: { $gte: twoMonthsAgo, $lt: monthAgo } }),
    ]);

    const usersTrend = recentUsers - previousUsers;
    const lakesTrend = recentLakes - previousLakes;

    return success(res, {
      stats: {
        totalUsers:    { value: totalUsers,   trend: usersTrend },
        totalLakes:    { value: totalLakes,   trend: lakesTrend },
        totalReports:  { value: totalReports, trend: 0 },
        lakeRequests:  { value: pendingLakes, trend: 0 },
        totalCatches:  { value: totalCatches, trend: 0 },
        totalReviews:  { value: totalReviews, trend: 0 },
        totalComments: { value: totalComments,trend: 0 },
        openContacts:  { value: openContacts, trend: 0 },
      }
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get daily user activity for chart (last 7 days)
// @route   GET /api/dashboard/user-activity
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.getUserActivity = async (req, res) => {
  try {
    const days = 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0,0,0,0);
      const end   = new Date(start);
      end.setHours(23,59,59,999);

      const count = await User.countDocuments({ createdAt: { $gte: start, $lte: end } });
      result.push({ day: DAYS[start.getDay()], users: count });
    }

    return success(res, { userActivity: result });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get reports submitted per week (last 4 weeks)
// @route   GET /api/dashboard/reports-submitted
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.getReportsSubmitted = async (req, res) => {
  try {
    const result = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const end   = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);

      const reports = await FishingReport.countDocuments({ createdAt: { $gte: start, $lt: end } });
      result.push({ week: `Week-${4 - i}`, reports });
    }
    return success(res, { reportsSubmitted: result });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get recent activity feed
// @route   GET /api/dashboard/recent-activity
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('user', 'name avatar')
      .lean();

    const activity = logs.map(log => {
      const diff = Date.now() - new Date(log.createdAt).getTime();
      const hours = Math.floor(diff / 3600000);
      const mins  = Math.floor(diff / 60000);
      const timeAgo = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ago`
                    : mins > 0  ? `${mins} min${mins > 1 ? 's' : ''} ago`
                    : 'just now';

      return {
        id:     log._id,
        user:   { name: log.user?.name || 'System', avatar: log.user?.avatar || '' },
        action: log.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
        lake:   log.details?.name || log.details?.lakeName || '',
        time:   timeAgo,
      };
    });

    return success(res, { recentActivity: activity });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Combined full dashboard (one call = all data)
// @route   GET /api/dashboard
// @access  Private (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // Prepare time range queries for activity charts
    const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dailyQueries = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(); start.setDate(start.getDate() - i); start.setHours(0,0,0,0);
      const end   = new Date(start); end.setHours(23,59,59,999);
      dailyQueries.push(User.countDocuments({ createdAt: { $gte: start, $lte: end } }));
    }

    const weeklyQueries = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const end   = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
      weeklyQueries.push(FishingReport.countDocuments({ createdAt: { $gte: start, $lt: end } }));
    }

    const [
      totalUsers, totalLakes, totalCatches, totalReports, totalReviews, openContacts,
      recentUsers, previousUsers,
      recentLakes, previousLakes,
      pendingCatches,
      recentReportsCount, recentCatchesCount, recentReviewsCount, recentContactsCount,
      userActivityCounts,
      reportsSubmittedCounts,
      logs
    ] = await Promise.all([
      User.countDocuments(),
      Lake.countDocuments({ status: 'active' }),
      BassPorn.countDocuments({ status: 'active' }),
      FishingReport.countDocuments({ status: 'active' }),
      Review.countDocuments({ status: 'active' }),
      ContactMessage.countDocuments({ status: 'open' }),
      // Growth/Trend Data
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      User.countDocuments({ createdAt: { $gte: twoMonthsAgo, $lt: monthAgo } }),
      Lake.countDocuments({ status: 'active', createdAt: { $gte: monthAgo } }),
      Lake.countDocuments({ status: 'active', createdAt: { $gte: twoMonthsAgo, $lt: monthAgo } }),
      // Moderation / Requests
      BassPorn.countDocuments({ status: 'pending' }), 
      // Recent counts (this month)
      FishingReport.countDocuments({ createdAt: { $gte: monthAgo } }),
      BassPorn.countDocuments({ createdAt: { $gte: monthAgo } }),
      Review.countDocuments({ createdAt: { $gte: monthAgo } }),
      ContactMessage.countDocuments({ createdAt: { $gte: monthAgo } }),
      // Chart Data (Parallelized)
      Promise.all(dailyQueries),
      Promise.all(weeklyQueries),
      // Audit Logs
      AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('user', 'name avatar').lean()
    ]);

    // Format User Activity Chart
    const userActivity = userActivityCounts.map((count, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return { day: DAYS[date.getDay()], users: count };
    });

    // Format Reports Chart
    const reportsSubmitted = reportsSubmittedCounts.map((count, i) => ({
      week: `Week-${i + 1}`,
      reports: count
    }));

    // Map Trends
    const userTrend = recentUsers - previousUsers;
    const lakeTrend = recentLakes - previousLakes;

    // Recent Activity Feed
    const recentActivity = logs.map(log => {
      const diff = Date.now() - new Date(log.createdAt).getTime();
      const hours = Math.floor(diff / 3600000);
      const mins  = Math.floor(diff / 60000);
      const timeAgo = hours > 0 ? `${hours}h ago` : mins > 0 ? `${mins}m ago` : 'just now';
      return {
        id:     log._id,
        user:   { name: log.user?.name || 'System', avatar: log.user?.avatar || '' },
        action: log.action.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()),
        lake:   log.details?.name || log.details?.lakeName || '',
        time:   timeAgo,
      };
    });

    return success(res, {
      stats: {
        totalUsers:    { value: totalUsers,   trend: userTrend },
        totalLakes:    { value: totalLakes,   trend: lakeTrend },
        totalReports:  { value: totalReports, trend: recentReportsCount },
        lakeRequests:  { value: pendingCatches, trend: pendingCatches }, 
        totalCatches:  { value: totalCatches, trend: recentCatchesCount },
        totalReviews:  { value: totalReviews, trend: recentReviewsCount },
        openContacts:  { value: openContacts,  trend: recentContactsCount },
      },
      userActivity,
      reportsSubmitted,
      recentActivity,
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};
