const express = require('express');
const router = express.Router();

const { getSystemSettings, updateSystemSettings, getPublicLegalInfo } = require('../controllers/settingsController');
const { protect, authProtected } = require('../middleware/authMiddleware');

// Public route to fetch legal docs
router.get('/legal', getPublicLegalInfo);

// System settings are strictly admin-only for security reasons.
// They control global platform behaviors.
router
  .route('/')
  .get(protect, authProtected('admin'), getSystemSettings)
  .put(protect, authProtected('admin'), updateSystemSettings);

module.exports = router;
