const Job = require('../models/Job');
const { z } = require('zod');

// Validation schema for creating/updating a job
const jobSchemaZod = z.object({
  title: z.string().min(1, 'Title is required'),
  company: z.string().min(1, 'Company is required'),
  location: z.string().min(1, 'Location is required'),
  type: z.string().min(1, 'Type is required'),
  category: z.string().min(1, 'Category is required'),
  salary: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  responsibilities: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  logo: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  logoColor: z.string().optional(),
  logoBg: z.string().optional(),
  featured: z.boolean().optional(),
  companySize: z.string().optional(),
  industry: z.string().optional()
});

// @desc    Get all jobs with filtering and pagination
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      type, 
      location, 
      search,
      featured
    } = req.query;

    const query = {};

    // Build filters dynamically
    if (category) query.category = category;
    if (type) query.type = type;
    if (location) query.location = { $regex: location, $options: 'i' };
    
    // Fuzzy search across multiple fields (e.g. title or company)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (featured !== undefined) {
      query.featured = featured === 'true';
    }

    // Pagination calculations
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;

    // Execute generic query with pagination and sorting
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
                          .sort({ createdAt: -1 })
                          .skip(startIndex)
                          .limit(limitNum);

    res.status(200).json({
      success: true,
      count: jobs.length,
      pagination: {
        current: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      data: jobs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
exports.getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(200).json(job);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Public (in real app: Admin)
exports.createJob = async (req, res) => {
  try {
    // Validate request body
    const validatedData = jobSchemaZod.parse(req.body);

    const job = await Job.create(validatedData);
    res.status(201).json(job);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation Error', errors: error.errors });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Public (in real app: Admin)
exports.updateJob = async (req, res) => {
  try {
    const validatedData = jobSchemaZod.parse(req.body);
    
    const job = await Job.findByIdAndUpdate(req.params.id, validatedData, {
      new: true,
      runValidators: true
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.status(200).json(job);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation Error', errors: error.errors });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Public (in real app: Admin)
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    await job.deleteOne();

    res.status(200).json({ message: 'Job removed', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
