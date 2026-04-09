const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const TokenBlacklist = require('../models/TokenBlacklist');

const isMongoConnected = () => mongoose.connection.readyState === 1;

const isRetryableMongoError = (error) => {
  const name = error?.name || '';
  const message = error?.message || '';
  const labels = Array.from(error?.errorLabelSet || []);

  return (
    name === 'MongoNetworkTimeoutError' ||
    message.includes('PoolClearedOnNetworkError') ||
    labels.includes('PoolRequestedRetry') ||
    labels.includes('ResetPool') ||
    labels.includes('InterruptInUseConnections')
  );
};

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
  if (!isMongoConnected()) return;

  const expiresAt = decodeExpiry(token, type === 'refresh' ? 7 * 24 * 60 * 60 * 1000 : 15 * 60 * 1000);

  try {
    await TokenBlacklist.updateOne(
      { token },
      { $set: { token, type, expiresAt } },
      { upsert: true }
    );
  } catch (error) {
    if (isRetryableMongoError(error)) return;
    throw error;
  }
};

const isBlacklisted = async (token) => {
  if (!token) return false;
  if (!isMongoConnected()) return false;

  try {
    const found = await TokenBlacklist.findOne({ token }).lean();
    return !!found;
  } catch (error) {
    if (isRetryableMongoError(error)) return false;
    throw error;
  }
};

const cleanupBlacklist = async () => {
  if (!isMongoConnected()) {
    return { skipped: true, reason: 'db_not_connected' };
  }

  try {
    const result = await TokenBlacklist.deleteMany({ expiresAt: { $lt: new Date() } });
    return { skipped: false, deletedCount: result.deletedCount || 0 };
  } catch (error) {
    if (isRetryableMongoError(error)) {
      return { skipped: true, reason: 'transient_mongo_error' };
    }
    throw error;
  }
};

module.exports = {
  blacklistToken,
  isBlacklisted,
  cleanupBlacklist,
};
