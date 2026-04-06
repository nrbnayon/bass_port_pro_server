const mongoose = require('mongoose');

/**
 * FishingReport — angler-submitted fishing condition reports
 * FK: user → User._id
 * FK: lake → Lake._id
 */
const fishingReportSchema = new mongoose.Schema({
  // ── Relationships ─────────────────────────────────────────────────────────
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lake:     { type: mongoose.Schema.Types.ObjectId, ref: 'Lake', required: true },
  lakeName: { type: String, required: true, trim: true }, // denormalized

  // ── Report Content ────────────────────────────────────────────────────────
  title:    { type: String, default: '' },
  text:     { type: String, required: true },
  tags:     [{ type: String }],

  // ── Fishing Conditions ────────────────────────────────────────────────────
  conditions: {
    temp:       { type: String, default: '' },
    weather:    { type: String, enum: ['Sunny', 'Partly Cloudy', 'Overcast', 'Rainy', 'Windy', 'Stormy', ''], default: '' },
    wind:       { type: String, default: '' },
    waterLevel: { type: String, enum: ['Normal', 'High', 'Low', 'Rising', 'Falling', ''], default: '' },
    clarity:    { type: String, enum: ['Clear', 'Stained', 'Muddy', ''], default: '' },
    pressure:   { type: String, enum: ['Stable', 'Rising', 'Falling', ''], default: '' },
  },

  // ── Catch Summary ─────────────────────────────────────────────────────────
  catchCount:   { type: Number, default: 0 },   // e.g. 18 (total catches that day)
  biggestCatch: { type: Number, default: null }, // lbs as number
  score:        { type: Number, default: 0 },    // activity score 0-100

  // ── Date of Fishing Trip ──────────────────────────────────────────────────
  fishedAt:   { type: Date, required: true, default: Date.now },

  // ── Social ────────────────────────────────────────────────────────────────
  likes:       { type: Number, default: 0 },
  likedBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentCount:{ type: Number, default: 0 },
  helpfulCount:{ type: Number, default: 0 },
  helpfulBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // ── Moderation ────────────────────────────────────────────────────────────
  status:    { type: String, enum: ['active', 'pending', 'rejected', 'flagged'], default: 'active' },
  featured:  { type: Boolean, default: false },

}, { timestamps: true });

// Indexes
fishingReportSchema.index({ user: 1, createdAt: -1 });
fishingReportSchema.index({ lake: 1, createdAt: -1 });
fishingReportSchema.index({ status: 1, fishedAt: -1 });
fishingReportSchema.index({ 'conditions.weather': 1 });

module.exports = mongoose.model('FishingReport', fishingReportSchema);
