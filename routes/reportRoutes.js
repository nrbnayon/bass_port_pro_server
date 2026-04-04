const express = require('express');
const router = express.Router();

const { getReports } = require('../controllers/rbacModuleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.get('/', protect, requirePermission('view_reports'), getReports);

module.exports = router;
