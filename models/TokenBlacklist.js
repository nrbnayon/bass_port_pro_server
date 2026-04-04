const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['access', 'refresh'], required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
