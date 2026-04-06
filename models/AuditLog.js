const mongoose = require('mongoose');

// Re-use existing schema structure
const auditLogSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:    { type: String, required: true },
  target:    { type: mongoose.Schema.Types.ObjectId },
  targetType:{ type: String, enum: ['user', 'lake', 'catch', 'report', 'review', 'comment', 'contact', 'settings', ''], default: '' },
  details:   { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
