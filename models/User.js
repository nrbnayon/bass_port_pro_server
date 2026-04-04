const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'agent', 'customer', "user", "creator"], 
    default: 'user' 
  },
  status: { 
    type: String, 
    enum: ['active', 'suspended', 'banned', "pending"], 
    default: 'active' 
  },
  managedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  permissions: [{ type: String }],
  avatar: { type: String, default: '' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  refreshToken: { type: String, default: '' },
  resetPasswordOtp: { type: String },
  resetPasswordExpires: { type: Date },
  verificationOtp: { type: String },
  verificationExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
