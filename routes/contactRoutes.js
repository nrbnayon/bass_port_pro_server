const express = require('express');
const router  = express.Router();
const {
  submitContact, getContacts, getContactById,
  updateContact, deleteContact, getMyContacts,
} = require('../controllers/contactController');
const { protect, authProtected } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimitMiddleware');

// Public (rate-limited to prevent spam)
router.post('/', authLimiter, submitContact);

// Authenticated user — see own submissions
router.get('/my', protect, getMyContacts);

// Admin / Manager — full management
router.get('/',     protect, authProtected('admin', 'manager'), getContacts);
router.get('/:id',  protect, authProtected('admin', 'manager'), getContactById);
router.patch('/:id',protect, authProtected('admin', 'manager'), updateContact);
router.delete('/:id',protect,authProtected('admin'),            deleteContact);

module.exports = router;
