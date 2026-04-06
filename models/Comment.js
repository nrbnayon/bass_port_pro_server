const mongoose = require('mongoose');

/**
 * Comment — threaded comments on catches, reports, lakes
 * FK: user → User._id
 * FK: parent → Comment._id  (for nested replies, depth 1)
 * FK: lake / catch / report → respective models
 */
const commentSchema = new mongoose.Schema({
  // ── Author ────────────────────────────────────────────────────────────────
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── Target (polymorphic) ──────────────────────────────────────────────────
  targetType: { type: String, enum: ['catch', 'report', 'lake'], required: true },
  catch:      { type: mongoose.Schema.Types.ObjectId, ref: 'BassPorn',      default: null },
  report:     { type: mongoose.Schema.Types.ObjectId, ref: 'FishingReport', default: null },
  lake:       { type: mongoose.Schema.Types.ObjectId, ref: 'Lake',          default: null },

  // ── Content ───────────────────────────────────────────────────────────────
  text:    { type: String, required: true, trim: true, maxlength: 1000 },

  // ── Threading ─────────────────────────────────────────────────────────────
  parent:    { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  replyCount:{ type: Number, default: 0 },

  // ── Social ────────────────────────────────────────────────────────────────
  likes:   { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // ── Moderation ────────────────────────────────────────────────────────────
  status:    { type: String, enum: ['active', 'pending', 'rejected', 'flagged'], default: 'active' },
  flagCount: { type: Number, default: 0 },
  flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  edited:    { type: Boolean, default: false },
  editedAt:  { type: Date },

}, { timestamps: true });

commentSchema.index({ targetType: 1, catch: 1,  createdAt: 1 });
commentSchema.index({ targetType: 1, report: 1, createdAt: 1 });
commentSchema.index({ targetType: 1, lake: 1,   createdAt: 1 });
commentSchema.index({ user: 1, createdAt: -1 });
commentSchema.index({ parent: 1 });

module.exports = mongoose.model('Comment', commentSchema);
