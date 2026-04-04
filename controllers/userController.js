const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcrypt');

// Helper to check grant ceiling
const checkGrantCeiling = (managerPermissions, requestedPermissions) => {
  for (let perm of requestedPermissions) {
    if (!managerPermissions.includes(perm)) {
      return false; // Found a permission the manager doesn't have
    }
  }
  return true;
};

// @desc    Get all users (scoping: Admin sees all, Manager sees their agents/customers, Agent sees none/customers if permitted)
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  try {
    let users;
    if (req.user.role === 'admin') {
      users = await User.find({}).select('-password');
    } else {
      // Return users managed by this user
      users = await User.find({ managedBy: req.user._id }).select('-password');
    }
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register a new user (or Admin/Manager creating a lower role)
// @route   POST /api/users
// @access  Private
const createUser = async (req, res) => {
  const { name, email, password, role, permissions, avatar, phone, location } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Role hierarchy checking
    if (req.user.role !== 'admin') {
      if (role === 'admin' || (req.user.role === 'manager' && role === 'manager')) {
        return res.status(403).json({ message: 'Cannot create a user with a higher or equal role' });
      }
      
      // Check grant ceiling
      if (permissions && !checkGrantCeiling(req.user.permissions || [], permissions)) {
        return res.status(403).json({ message: 'Grant Ceiling Error: You cannot grant permissions you do not have.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      permissions: permissions || [],
      managedBy: req.user.role !== 'admin' ? req.user._id : null,
      avatar, phone, location
    });

    await AuditLog.create({
        user: req.user._id,
        action: 'CREATE_USER',
        target: user._id,
        details: { role: user.role, permissions: user.permissions }
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a user
// @route   PUT /api/users/:id
// @access  Private
const updateUser = async (req, res) => {
  const { name, role, permissions, status, avatar, phone, location } = req.body;

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Checking if requester can edit this user
    if (req.user.role !== 'admin' && (!user.managedBy || user.managedBy.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to edit this user' });
    }

    if (req.user.role !== 'admin' && permissions) {
      // Check grant ceiling
      if (!checkGrantCeiling(req.user.permissions || [], permissions)) {
        return res.status(403).json({ message: 'Grant Ceiling Error: You cannot grant permissions you do not have.' });
      }
    }

    if (name) user.name = name;
    if (role && req.user.role === 'admin') user.role = role; // Only Admin can change role strings
    if (permissions) user.permissions = permissions;
    if (status) user.status = status;
    if (avatar) user.avatar = avatar;
    if (phone) user.phone = phone;
    if (location) user.location = location;

    const updatedUser = await user.save();

    await AuditLog.create({
        user: req.user._id,
        action: 'UPDATE_USER',
        target: updatedUser._id,
        details: { updatedFields: req.body }
    });

    res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        permissions: updatedUser.permissions,
        status: updatedUser.status
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.user.role !== 'admin' && (!user.managedBy || user.managedBy.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to delete this user' });
    }

    await User.findByIdAndDelete(req.params.id);
    
    await AuditLog.create({
        user: req.user._id,
        action: 'DELETE_USER',
        target: user._id,
        details: { deletedEmail: user.email }
    });

    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
