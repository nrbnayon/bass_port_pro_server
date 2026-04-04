const express = require('express');
const router  = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  createUser,
} = require('../controllers/userController');

const { protect, authProtected, requirePermission } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
//  OWN PROFILE ROUTES  (any authenticated user)
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/users/me          → get own profile
// PUT  /api/users/me          → update own profile + avatar (multipart/form-data)
router
  .route('/me')
  .get(protect, getMyProfile)
  .put(
    protect,
    upload.single('avatar'), // field name must be "avatar" in the form-data
    updateMyProfile
  );

// PUT  /api/users/me/change-password
router.put('/me/change-password', protect, changePassword);

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN-ONLY ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/users             → list all users (search, filter, pagination)
// POST /api/users             → create a new user
router
  .route('/')
  .get(protect, authProtected('admin'), getAllUsers)
  .post(protect, requirePermission('manage_users'), createUser);

// GET    /api/users/:id       → single user detail  (admin)
// PUT    /api/users/:id       → update user by id   (admin / manager with manage_users)
// DELETE /api/users/:id       → delete user by id   (admin only)
router
  .route('/:id')
  .get(protect, authProtected('admin'), getUserById)
  .put(protect, requirePermission('manage_users'), updateUserById)
  .delete(protect, authProtected('admin'), deleteUserById);

module.exports = router;
