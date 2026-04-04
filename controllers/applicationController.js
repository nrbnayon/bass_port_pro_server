const Application = require('../models/Application');
const Job = require('../models/Job');
const { z } = require('zod');

const applicationSchemaZod = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  portfolio: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  resumeUrl: z.string().url('Must provide a valid resume URL').min(1, 'Resume is required'),
  coverNote: z.string().optional().or(z.literal(''))
});

// @desc    Submit new job application
// @route   POST /api/applications
// @access  Public
exports.submitApplication = async (req, res) => {
  try {
    // Validate request body
    const validatedData = applicationSchemaZod.parse(req.body);

    // Ensure job exists
    const jobExists = await Job.findById(validatedData.jobId);
    if (!jobExists) {
      return res.status(404).json({ success: false, message: 'The referenced Job does not exist.' });
    }

    const application = await Application.create(validatedData);

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation Error', errors: error.errors });
    }
    // Handle Mongoose cast errors
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid Job ID format.' });
    }
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get applications (Optional: Admin only)
// @route   GET /api/applications
// @access  Private 
exports.getApplications = async (req, res) => {
  try {
    const { jobId, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (jobId) query.jobId = jobId;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;

    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .populate('jobId', 'title company') // Bring in minimal job data
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: applications.length,
      pagination: {
        current: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      data: applications
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
