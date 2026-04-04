const express = require('express');
const router = express.Router();

const { getTasks } = require('../controllers/rbacModuleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.get('/', protect, requirePermission('view_tasks'), getTasks);

module.exports = router;
