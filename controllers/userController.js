const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcrypt');

const User     = require('../models/User');
const AuditLog = require('../models/AuditLog');
const {
  successResponse,
  createdResponse,
  paginatedResponse,
  errorResponse,
  notFound,
  forbidden,
  serverError,
} = require('../utils/apiResponse');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the public avatar URL from a filename.
 * Pattern: http://<HOST>:<PORT>/uploads/users/<filename>
 */
const buildAvatarUrl = (req, filename) => {
  const protocol = req.protocol;
  const host     = req.get('host'); // e.g. 172.17.0.1:5000
  return `${protocol}://${host}/uploads/users/${filename}`;
};

/**
 * Delete the old avatar file from disk when a user uploads a new one.
 * Silently ignores errors (file may already be absent).
 */
const deleteOldAvatar = (avatarUrl) => {
  if (!avatarUrl) return;
  try {
    // URL → filename extraction
    const filename = avatarUrl.split('/uploads/users/').pop();
    if (!filename) return;
    const filepath = path.join(__dirname, '..', 'uploads', 'users', filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (_) {
    // non-critical — log but don't throw
    console.warn('[deleteOldAvatar] Could not remove old avatar:', avatarUrl);
  }
};

/**
 * Grant-ceiling check: the requester cannot grant permissions they don't own.
 */
const checkGrantCeiling = (managerPerms, requestedPerms) =>
  requestedPerms.every((p) => managerPerms.includes(p));

// ─── GET /api/users/me ────────────────────────────────────────────────────────
// @desc  Get own profile
// @access Private (any authenticated user)
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken');
    if (!user) return notFound(res, 'User not found');
    return successResponse(res, 'Profile fetched successfully', user);
  } catch (err) {
    return serverError(res, err);
  }
};

// ─── PUT /api/users/me ────────────────────────────────────────────────────────
// @desc  Update own profile (name, phone, location) + optional avatar upload
// @access Private (any authenticated user)
// @body  multipart/form-data  { name?, phone?, location? }
// @file  field: avatar  (image file, optional)
const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return notFound(res, 'User not found');

    const { name, phone, location } = req.body;

    if (name     !== undefined) user.name     = name.trim();
    if (phone    !== undefined) user.phone    = phone.trim();
    if (location !== undefined) user.location = location.trim();

    // Avatar upload handling
    if (req.file) {
      // Remove previous avatar from disk (cleanup)
      deleteOldAvatar(user.avatar);
      // Build the canonical public URL for this file
      user.avatar = buildAvatarUrl(req, req.file.filename);
    }

    const updated = await user.save();

    return successResponse(res, 'Profile updated successfully', {
      _id:      updated._id,
      name:     updated.name,
      email:    updated.email,
      phone:    updated.phone,
      location: updated.location,
      avatar:   updated.avatar,
      role:     updated.role,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

// ─── PUT /api/users/me/change-password ────────────────────────────────────────
// @desc  Change own password
// @access Private (any authenticated user)
// @body  { current_password, new_password, confirm_password }
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    // ── Validation ──
    if (!current_password || !new_password || !confirm_password) {
      return errorResponse(res, 'All password fields are required', 400);
    }

    if (new_password !== confirm_password) {
      return errorResponse(res, 'New password and confirm password do not match', 400);
    }

    if (new_password.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters', 400);
    }

    if (current_password === new_password) {
      return errorResponse(res, 'New password must be different from the current password', 400);
    }

    // Fetch user with password field
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return notFound(res, 'User not found');

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 401);
    }

    // Hash & save
    const salt         = await bcrypt.genSalt(10);
    user.password      = await bcrypt.hash(new_password, salt);
    user.refreshToken  = ''; // invalidate existing refresh tokens
    await user.save();

    return successResponse(res, 'Password changed successfully');
  } catch (err) {
    return serverError(res, err);
  }
};

// ─── GET /api/users ───────────────────────────────────────────────────────────
// @desc  Get all users — Admin only
//        Supports: search (name/email), filter by role/status, pagination
// @access Private — Admin
// @query { search, role, status, page, limit, sortBy, sortOrder }
const getAllUsers = async (req, res) => {
  try {
    const {
      search    = '',
      role      = '',
      status    = '',
      page      = 1,
      limit     = 10,
      sortBy    = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page,  10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip     = (pageNum - 1) * limitNum;

    // ── Build filter ──
    const filter = { role: { $ne: 'admin' } };

    if (search.trim()) {
      filter.$or = [
        { name:  { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (role.trim())   filter.role   = role.trim();
    if (status.trim()) filter.status = status.trim();

    // ── Sort ──
    const allowedSortFields = ['createdAt', 'name', 'email', 'role', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDir   = sortOrder === 'asc' ? 1 : -1;

    // ── Execute query ──
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken -resetPasswordOtp -resetPasswordExpires -verificationOtp -verificationExpires')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    return paginatedResponse(res, 'Users fetched successfully', users, {
      page:  pageNum,
      limit: limitNum,
      total,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
// @desc  Delete a user by ID — Admin only
// @access Private — Admin
const deleteUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, 'User not found');

    // Admin cannot delete themselves
    if (req.user._id.toString() === user._id.toString()) {
      return forbidden(res, 'Admins cannot delete their own account');
    }

    // Cleanup avatar from disk
    deleteOldAvatar(user.avatar);

    await User.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      user:    req.user._id,
      action:  'DELETE_USER',
      target:  user._id,
      details: { deletedEmail: user.email, deletedRole: user.role },
    });

    return successResponse(res, `User '${user.name}' deleted successfully`);
  } catch (err) {
    return serverError(res, err);
  }
};

// ─── GET /api/users/:id ─────────────────────────────────────────────────────
// @desc  Get single user by ID — Admin only
// @access Private — Admin
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken -resetPasswordOtp -resetPasswordExpires -verificationOtp -verificationExpires');
    if (!user) return notFound(res, 'User not found');
    return successResponse(res, 'User fetched successfully', user);
  } catch (err) {
    return serverError(res, err);
  }
};

// ─── PUT /api/users/:id ──────────────────────────────────────────────────────
// @desc  Admin update any user (role, status, permissions, etc.)
// @access Private — Admin
const updateUserById = async (req, res) => {
  const { name, role, permissions, status, phone, location } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, 'User not found');

    // Non-admins can only edit users they manage
    if (
      req.user.role !== 'admin' &&
      (!user.managedBy || user.managedBy.toString() !== req.user._id.toString())
    ) {
      return forbidden(res, 'Not authorized to edit this user');
    }

    // Grant-ceiling check for non-admins
    if (req.user.role !== 'admin' && permissions) {
      if (!checkGrantCeiling(req.user.permissions || [], permissions)) {
        return forbidden(res, 'Grant ceiling violation: you cannot grant permissions you do not own');
      }
    }

    if (name        !== undefined) user.name        = name;
    if (phone       !== undefined) user.phone       = phone;
    if (location    !== undefined) user.location    = location;
    if (permissions !== undefined) user.permissions = permissions;
    if (status      !== undefined) user.status      = status;

    // Only Admin can change role
    if (role !== undefined && req.user.role === 'admin') user.role = role;

    const updated = await user.save();

    await AuditLog.create({
      user:    req.user._id,
      action:  'UPDATE_USER',
      target:  updated._id,
      details: { updatedFields: req.body },
    });

    return successResponse(res, 'User updated successfully', {
      _id:         updated._id,
      name:        updated.name,
      email:       updated.email,
      role:        updated.role,
      status:      updated.status,
      phone:       updated.phone,
      location:    updated.location,
      permissions: updated.permissions,
      avatar:      updated.avatar,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

// ─── POST /api/users ─────────────────────────────────────────────────────────
// @desc  Admin / Manager creates a new user
// @access Private — Admin / Manager (manage_users permission)
const createUser = async (req, res) => {
  const { name, email, password, role, permissions, phone, location } = req.body;

  try {
    const exists = await User.findOne({ email });
    if (exists) return errorResponse(res, 'A user with this email already exists', 409);

    // Role hierarchy guard for non-admins
    if (req.user.role !== 'admin') {
      if (role === 'admin' || (req.user.role === 'manager' && role === 'manager')) {
        return forbidden(res, 'Cannot create a user with a higher or equal role');
      }
      if (permissions && !checkGrantCeiling(req.user.permissions || [], permissions)) {
        return forbidden(res, 'Grant ceiling violation: you cannot grant permissions you do not own');
      }
    }

    const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const user = await User.create({
      name,
      email,
      password:  hashed,
      role:      role || 'user',
      permissions: permissions || [],
      managedBy: req.user.role !== 'admin' ? req.user._id : null,
      phone,
      location,
    });

    await AuditLog.create({
      user:    req.user._id,
      action:  'CREATE_USER',
      target:  user._id,
      details: { role: user.role, permissions: user.permissions },
    });

    return createdResponse(res, 'User created successfully', {
      _id:         user._id,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      permissions: user.permissions,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  changePassword,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  createUser,
};
