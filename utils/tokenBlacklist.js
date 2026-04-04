const jwt = require('jsonwebtoken');
const TokenBlacklist = require('../models/TokenBlacklist');

const decodeExpiry = (token, fallbackMs = 15 * 60 * 1000) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) {
      return new Date(decoded.exp * 1000);
    }
  } catch (error) {
    // ignore decode errors and use fallback
  }
  return new Date(Date.now() + fallbackMs);
};

const blacklistToken = async (token, type) => {
  if (!token) return;

  const expiresAt = decodeExpiry(token, type === 'refresh' ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000);

  await TokenBlacklist.updateOne(
    { token },
    { $set: { token, type, expiresAt } },
    { upsert: true }
  );
};

const isBlacklisted = async (token) => {
  if (!token) return false;
  const found = await TokenBlacklist.findOne({ token }).lean();
  return !!found;
};

const cleanupBlacklist = async () => {
  await TokenBlacklist.deleteMany({ expiresAt: { $lt: new Date() } });
};

module.exports = {
  blacklistToken,
  isBlacklisted,
  cleanupBlacklist,
};
