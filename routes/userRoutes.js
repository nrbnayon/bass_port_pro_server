const express = require('express');
const router  = express.Router();

const {
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  createUser,
} = require('../controllers/userController');

const { protect, authProtected, requirePermission } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// GET  /api/users             → list all users (search, filter, pagination)
// POST /api/users             → create a new user
router
  .route('/')
  .get(protect, authProtected('admin'), getAllUsers)
  .post(protect, requirePermission('manage_users'), createUser);

// PUT  /api/users/:id       → update user by id   (admin / manager with manage_users)
// DELETE /api/users/:id       → delete user by id   (admin only)
router
  .route('/:id')
  .get(protect, authProtected('admin'), getUserById)
  .put(protect, requirePermission('manage_users'), updateUserById)
  .delete(protect, authProtected('admin'), deleteUserById);

module.exports = router;
