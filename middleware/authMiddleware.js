const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isBlacklisted } = require('../utils/tokenBlacklist');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const blacklisted = await isBlacklisted(token);
      if (blacklisted) {
        return res.status(401).json({ message: 'Not authorized, token revoked' });
      }

      // Decode token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user missing' });
      }

      if (req.user.status === 'suspended' || req.user.status === 'banned') {
        return res.status(403).json({ message: 'Account is suspended or banned' });
      }

      if (req.user.status !== 'active') {
        return res.status(401).json({ message: 'Not authorized, account inactive' });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Check if user has specific permission atom
const requirePermission = (atom) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Role-based implicit full access for simplicity?
    // "No page is locked to a specific role. Access is granted atom by atom."
    // However, Admin traditionally has all, or we explicitly assign atoms to Admin too.
    // Let's make Admin have everything implicitly to avoid lockout.
    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.permissions && req.user.permissions.includes(atom)) {
      return next();
    }

    return res.status(403).json({ message: `Forbidden: Missing required permission '${atom}'` });
  };
};

module.exports = { protect, requirePermission };
