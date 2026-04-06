const mongoose = require('mongoose');

/**
 * ContactMessage — user-submitted contact/support forms
 * FK: user → User._id  (nullable for guest submissions)
 */
const contactMessageSchema = new mongoose.Schema({
  // ── Sender info ──────────────────────────────────────────────────────────
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, trim: true, lowercase: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },

  // ── Category ─────────────────────────────────────────────────────────────
  category: {
    type: String,
    enum: ['general', 'bug', 'feature', 'lake_correction', 'catch_dispute', 'account', 'other'],
    default: 'general',
  },

  // ── Status / Admin ────────────────────────────────────────────────────────
  status:      { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  priority:    { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt:  { type: Date },
  adminNotes:  { type: String, default: '' },
  repliedAt:   { type: Date },

  // ── Metadata ──────────────────────────────────────────────────────────────
  ipAddress: { type: String, default: '' },
}, { timestamps: true });

contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ user: 1 });
contactMessageSchema.index({ email: 1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
