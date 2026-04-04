const express = require('express');
const router = express.Router();
const { protect, requirePermission } = require('../middleware/authMiddleware');
const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob
} = require('../controllers/jobController');

router
  .route('/')
  .get(getJobs)
  .post(protect, requirePermission('manage_jobs'), createJob);

router
  .route('/:id')
  .get(getJob)
  .put(protect, requirePermission('manage_jobs'), updateJob)
  .delete(protect, requirePermission('manage_jobs'), deleteJob);

module.exports = router;
