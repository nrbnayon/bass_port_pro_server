const mongoose = require('mongoose');

/**
 * BassPorn — Trophy catch/photo entries (called "catches" in frontend)
 * FK: user → User._id
 * FK: lake → Lake._id  (loose ref; lakeId may be null if user typed a lake name)
 */
const bassPornSchema = new mongoose.Schema({
  // ── Relationships ─────────────────────────────────────────────────────────
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lake:    { type: mongoose.Schema.Types.ObjectId, ref: 'Lake', default: null },
  lakeName:{ type: String, required: true, trim: true }, // denormalized for display

  // ── Catch Details ─────────────────────────────────────────────────────────
  species:   { type: String, required: true, trim: true },
  weight:    { type: Number, required: true },  // lbs as number
  weightUnit:{ type: String, enum: ['lbs', 'kg'], default: 'lbs' },
  length:    { type: Number, default: null },   // inches as number
  technique: { type: String, required: true, trim: true },
  bait:      { type: String, default: '' },
  depth:     { type: String, default: '' },     // e.g. "15ft"
  description:{ type: String, default: '' },

  // ── Date / Location ───────────────────────────────────────────────────────
  caughtAt:  { type: Date, required: true, default: Date.now },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },

  // ── Weather at time of catch ──────────────────────────────────────────────
  weatherSnapshot: {
    temp:    { type: String, default: '' },
    weather: { type: String, default: '' },
    wind:    { type: String, default: '' },
  },

  // ── Media ─────────────────────────────────────────────────────────────────
  image:    { type: String, required: true },   // primary photo URL
  images:   [{ type: String }],                 // additional photos

  // ── Social ────────────────────────────────────────────────────────────────
  likes:      { type: Number, default: 0 },
  likedBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0 },

  // ── Moderation ────────────────────────────────────────────────────────────
  status:     { type: String, enum: ['active', 'pending', 'rejected', 'flagged'], default: 'active' },
  featured:   { type: Boolean, default: false },
  flagCount:  { type: Number, default: 0 },
  flaggedBy:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

}, { timestamps: true });

// Indexes
bassPornSchema.index({ user: 1, createdAt: -1 });
bassPornSchema.index({ lake: 1, createdAt: -1 });
bassPornSchema.index({ status: 1, likes: -1 });
bassPornSchema.index({ species: 1 });
bassPornSchema.index({ caughtAt: -1 });

module.exports = mongoose.model('BassPorn', bassPornSchema);
