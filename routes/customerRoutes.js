const express = require('express');
const router = express.Router();

const { getCustomerPortal } = require('../controllers/rbacModuleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.get('/portal', protect, requirePermission('view_customer_portal'), getCustomerPortal);

module.exports = router;
