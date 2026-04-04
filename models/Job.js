const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a job title']
  },
  company: {
    type: String,
    required: [true, 'Please add a company name']
  },
  location: {
    type: String,
    required: [true, 'Please add a location']
  },
  type: {
    type: String,
    required: [true, 'Please specify job type']
  },
  category: {
    type: String,
    required: [true, 'Please specify a category']
  },
  salary: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  responsibilities: {
    type: [String],
    default: []
  },
  requirements: {
    type: [String],
    default: []
  },
  tags: {
    type: [String],
    default: []
  },
  logo: {
    type: String,
    default: 'J'
  },
  logoUrl: {
    type: String,
    default: ''
  },
  logoColor: {
    type: String,
    default: '#4640DE'
  },
  logoBg: {
    type: String,
    default: '#F8F8FD'
  },
  featured: {
    type: Boolean,
    default: false
  },
  companySize: {
    type: String,
    default: ''
  },
  industry: {
    type: String,
    default: ''
  }
}, {
  timestamps: true // Automatically creates createdAt and updatedAt
});

// Create a virtual 'id' field to match frontend expectations
JobSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
JobSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Job', JobSchema);
