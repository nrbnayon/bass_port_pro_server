const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

// Base requirements: Any user making changes needs manage_users permission
router.route('/')
  .get(protect, requirePermission('manage_users'), getUsers)
  .post(protect, requirePermission('manage_users'), createUser);

router.route('/:id')
  .put(protect, requirePermission('manage_users'), updateUser)
  .delete(protect, requirePermission('manage_users'), deleteUser);

module.exports = router;
