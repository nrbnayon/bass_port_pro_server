const mongoose = require('mongoose');

/**
 * Review — lake ratings and comments (separate reusable model)
 * FK: user → User._id  (author)
 * FK: lake → Lake._id  (target)
 *
 * Intentionally kept generic so the same schema could be reused
 * for catch reviews by changing targetType.
 */
const reviewSchema = new mongoose.Schema({
  // ── Target (polymorphic-ready, defaults to Lake) ───────────────────────
  targetType:  { type: String, enum: ['lake', 'catch', 'report'], default: 'lake' },
  lake:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lake', default: null },
  catch:       { type: mongoose.Schema.Types.ObjectId, ref: 'BassPorn', default: null },
  report:      { type: mongoose.Schema.Types.ObjectId, ref: 'FishingReport', default: null },

  // ── Author ────────────────────────────────────────────────────────────────
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── Content ───────────────────────────────────────────────────────────────
  rating:  { type: Number, required: true, min: 1, max: 5 },
  text:    { type: String, required: true, trim: true, maxlength: 2000 },
  title:   { type: String, default: '', maxlength: 150 },

  // ── Social ────────────────────────────────────────────────────────────────
  helpfulCount: { type: Number, default: 0 },
  helpfulBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // ── Moderation ────────────────────────────────────────────────────────────
  status:    { type: String, enum: ['active', 'pending', 'rejected', 'flagged'], default: 'active' },
  flagCount: { type: Number, default: 0 },
  flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

}, { timestamps: true });

// One review per user per lake (or catch / report)
reviewSchema.index({ user: 1, lake: 1 }, { unique: true, sparse: true });
reviewSchema.index({ lake: 1, status: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
