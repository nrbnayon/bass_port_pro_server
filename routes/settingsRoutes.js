const express = require('express');
const router = express.Router();

const { getSettings } = require('../controllers/rbacModuleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.get('/', protect, requirePermission('manage_settings'), getSettings);

module.exports = router;
