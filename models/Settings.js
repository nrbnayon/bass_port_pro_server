const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true,
    default: 'system_config'
  },
  autoApproveMode: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  twoFactorAuth: { type: Boolean, default: false },
  maintenanceMode: { type: Boolean, default: false },
  lastUpdatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
