const express = require('express');
const router = express.Router();

const { getAuditLogs } = require('../controllers/auditController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.get('/', protect, requirePermission('view_audit_logs'), getAuditLogs);

module.exports = router;
