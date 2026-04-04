const express = require('express');
const router = express.Router();
const { submitApplication, getApplications } = require('../controllers/applicationController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router
  .route('/')
  .post(protect, requirePermission('submit_applications'), submitApplication)
  .get(protect, requirePermission('view_applications'), getApplications);

module.exports = router;
