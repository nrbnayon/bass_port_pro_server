const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isBlacklisted } = require('../utils/tokenBlacklist');
const { unauthorized, forbidden } = require('../utils/apiResponse');

// ─── optionalProtect ─────────────────────────────────────────────────────────
// Tries to attach req.user from JWT if provided, but never blocks the request.
// Use on public routes that should behave differently for logged-in users.
// ─────────────────────────────────────────────────────────────────────────────
const optionalProtect = async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const blacklisted = await isBlacklisted(token);
    if (blacklisted) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id).select('-password');

    if (user) {
      req.user = user;
    }
  } catch (_error) {
    // Ignore invalid/missing token errors for optional auth.
  }

  return next();
};

// ─── protect ─────────────────────────────────────────────────────────────────
// Verifies the JWT, checks blacklist & account status, attaches req.user.
// Use on every authenticated route.
// ─────────────────────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization || '';

  if (authHeader && authHeader.toLowerCase().startsWith('bearer')) {
    try {
      token = authHeader.split(' ')[1];

      // Blacklist check
      const blacklisted = await isBlacklisted(token);
      if (blacklisted) {
        return unauthorized(res, 'Not authorized, token revoked');
      }

      // Verify & decode
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return unauthorized(res, 'Not authorized, user not found');
      }

      // Account status guard
      if (req.user.status === 'suspended' || req.user.status === 'banned') {
        return forbidden(res, 'Oh no! Your account is suspended or banned');
      }

      if (req.user.status !== 'active') {
        return unauthorized(res, 'Not authorized, account inactive');
      }

      return next();
    } catch (error) {
      console.error('[AuthMiddleware]', error.message);
      return unauthorized(res, 'Not authorized, token invalid');
    }
  }

  if (!token) {
    return unauthorized(res, 'Not authorized, no token provided');
  }
};

// ─── authProtected ────────────────────────────────────────────────────────────
// Role-based guard. Call AFTER protect().
//
// Usage examples:
//   router.get('/admin-only', protect, authProtected('admin'), handler);
//   router.get('/staff',      protect, authProtected('admin', 'manager'), handler);
//   router.get('/any-role',   protect, authProtected(), handler);  // same as protect alone
// ─────────────────────────────────────────────────────────────────────────────
const authProtected = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Not authorized');
    }

    // If no roles specified → any authenticated user passes
    if (roles.length === 0) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return forbidden(
        res,
        `Access denied. Required role: [${roles.join(', ')}]. Your role: ${req.user.role}`
      );
    }

    return next();
  };
};

// ─── requirePermission ────────────────────────────────────────────────────────
// Atom-level permission guard. Admins bypass implicitly.
// ─────────────────────────────────────────────────────────────────────────────
const requirePermission = (atom) => {
  return (req, res, next) => {
    if (!req.user) {
      return unauthorized(res, 'Not authorized');
    }

    // Admin has everything
    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.permissions && req.user.permissions.includes(atom)) {
      return next();
    }

    return forbidden(res, `Forbidden: missing required permission '${atom}'`);
  };
};

module.exports = { protect, optionalProtect, authProtected, requirePermission };
