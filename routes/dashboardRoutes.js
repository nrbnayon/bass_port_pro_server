const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/dashboardController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router
  .route('/stats')
  .get(protect, requirePermission('view_dashboard'), getStats);

module.exports = router;
