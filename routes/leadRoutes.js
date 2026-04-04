const express = require('express');
const router = express.Router();

const { getLeads } = require('../controllers/rbacModuleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.get('/', protect, requirePermission('view_leads'), getLeads);

module.exports = router;
