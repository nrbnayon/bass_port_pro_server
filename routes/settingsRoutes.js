const express = require('express');
const router = express.Router();

const { getSystemSettings, updateSystemSettings } = require('../controllers/settingsController');
const { protect, authProtected } = require('../middleware/authMiddleware');

// System settings are strictly admin-only for security reasons.
// They control global platform behaviors.
router
  .route('/')
  .get(protect, authProtected('admin'), getSystemSettings)
  .put(protect, authProtected('admin'), updateSystemSettings);

module.exports = router;
