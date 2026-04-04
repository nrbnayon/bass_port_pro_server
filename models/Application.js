const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please provide your full name']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email address'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  portfolio: {
    type: String,
    default: ''
  },
  resumeUrl: {
    type: String,
    required: [true, 'Please provide a link to your resume'],
    match: [
      /^(https?|chrome):\/\/[^\s$.?#].[^\s]*$/,
      'Please use a valid URL with HTTP or HTTPS'
    ]
  },
  coverNote: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Create virtual id and remove _id to match frontend
ApplicationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Application', ApplicationSchema);
