const express = require('express');
const router  = express.Router();
const {
  getDashboard, getStats, getUserActivity,
  getReportsSubmitted, getRecentActivity, getAnalytics,
} = require('../controllers/dashboardController');
const { protect, authProtected } = require('../middleware/authMiddleware');

// All dashboard routes are admin/manager protected
router.use(protect, authProtected('admin', 'manager'));

router.get('/',                  getDashboard);
router.get('/analytics',         getAnalytics);
router.get('/stats',             getStats);
router.get('/user-activity',     getUserActivity);
router.get('/reports-submitted', getReportsSubmitted);
router.get('/recent-activity',   getRecentActivity);

module.exports = router;
