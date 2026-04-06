const mongoose = require('mongoose');

/**
 * AuditLog Schema
 * uses refPath for dynamic population of the 'target' field.
 * targetType must match the Mongoose model names (User, Lake, BassPorn, etc.)
 */
const auditLogSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:    { type: String, required: true },
  target:    { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'targetType',
    required: false
  },
  targetType: { 
    type: String, 
    required: true,
    enum: ['User', 'Lake', 'BassPorn', 'FishingReport', 'Review', 'Comment', 'ContactMessage', 'Settings', 'None'], 
    default: 'None',
    set: function(v) {
      if (!v || v === "" || v === "null") return 'None';
      // Capitalize first letter (e.g., 'lake' -> 'Lake')
      return v.charAt(0).toUpperCase() + v.slice(1);
    }
  },
  details:   { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Avoid "Schema hasn't been registered for model ''" by ensuring we never have an empty string
// Also, dummy 'None' model to prevent crashes on legacy logs without a type
if (!mongoose.models.None) {
  mongoose.model('None', new mongoose.Schema({}));
}

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
