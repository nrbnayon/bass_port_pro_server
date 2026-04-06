const FishingReport = require('../models/FishingReport');
const Lake          = require('../models/Lake');
const AuditLog      = require('../models/AuditLog');
const {
  success, created, notFound, badRequest, serverError, forbidden
} = require('../utils/apiResponse');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all fishing reports (paginated, filterable)
// @route   GET /api/reports
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getReports = async (req, res) => {
  try {
    const {
      page = 1, limit = 6,
      search = '', lake = '', lakeId = '',
      weather = '', clarity = '', waterLevel = '',
      sortBy = 'fishedAt', order = 'desc',
      user: userId, featured, status = 'active'
    } = req.query;

    const query = {};
    const isAdmin = req.user && ['admin', 'manager'].includes(req.user.role);
    query.status = isAdmin && status ? status : 'active';

    if (search) {
      query.$or = [
        { text:     { $regex: search, $options: 'i' } },
        { lakeName: { $regex: search, $options: 'i' } },
        { tags:     { $regex: search, $options: 'i' } },
        { title:    { $regex: search, $options: 'i' } },
      ];
    }
    if (lake)       query.lakeName = { $regex: lake, $options: 'i' };
    if (lakeId)     query.lake = lakeId;
    if (weather)    query['conditions.weather'] = weather;
    if (clarity)    query['conditions.clarity'] = clarity;
    if (waterLevel) query['conditions.waterLevel'] = waterLevel;
    if (userId)     query.user = userId;
    if (featured === 'true') query.featured = true;

    const SORT_WHITELIST = ['fishedAt', 'createdAt', 'catchCount', 'biggestCatch', 'likes', 'score'];
    const sortField = SORT_WHITELIST.includes(sortBy) ? sortBy : 'fishedAt';
    const sortOrder = order === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      FishingReport.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .populate('user', 'name avatar location')
        .populate('lake', 'name slug state')
        .lean(),
      FishingReport.countDocuments(query),
    ]);

    // Check helpful/liked for current user
    let helpfulIds = new Set();
    if (req.user) {
      const withHelp = reports.filter(r => r.helpfulBy?.some(id => id.toString() === req.user._id.toString()));
      helpfulIds = new Set(withHelp.map(r => r._id.toString()));
    }

    const result = reports.map(r => ({
      ...r,
      isHelpful: helpfulIds.has(r._id.toString()),
      helpfulBy: undefined,
      likedBy:   undefined,
    }));

    return success(res, {
      reports: result,
      pagination: {
        page: Number(page), limit: Number(limit), total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get single fishing report
// @route   GET /api/reports/:id
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getReportById = async (req, res) => {
  try {
    const report = await FishingReport.findById(req.params.id)
      .populate('user', 'name avatar location')
      .populate('lake', 'name slug state image')
      .lean();

    if (!report || report.status === 'rejected') return notFound(res, 'Report not found');

    let isHelpful = false;
    let isLiked   = false;
    if (req.user) {
      isHelpful = report.helpfulBy?.some(id => id.toString() === req.user._id.toString()) ?? false;
      isLiked   = report.likedBy?.some(id => id.toString() === req.user._id.toString()) ?? false;
    }

    return success(res, { report: { ...report, isHelpful, isLiked, helpfulBy: undefined, likedBy: undefined } });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit a new fishing report
// @route   POST /api/reports
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.createReport = async (req, res) => {
  try {
    const {
      lakeName, lakeId,
      title, text, tags, conditions,
      catchCount, biggestCatch, score, fishedAt
    } = req.body;

    if (!text || !lakeName) return badRequest(res, 'Report text and lake name are required');

    // Resolve lake FK
    let resolvedLake = null;
    if (lakeId) {
      resolvedLake = await Lake.findById(lakeId);
    } else {
      resolvedLake = await Lake.findOne({ name: { $regex: new RegExp(`^${lakeName}$`, 'i') }, status: 'active' });
    }

    const report = await FishingReport.create({
      user:        req.user._id,
      lake:        resolvedLake?._id || null,
      lakeName:    resolvedLake?.name || lakeName,
      title:       title || '',
      text,
      tags:        Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      conditions:  conditions || {},
      catchCount:  Number(catchCount)   || 0,
      biggestCatch:biggestCatch ? Number(biggestCatch) : null,
      score:       Number(score)        || 0,
      fishedAt:    fishedAt ? new Date(fishedAt) : new Date(),
      status:      'active',
    });

    // Increment lake reportCount
    if (resolvedLake) {
      await Lake.findByIdAndUpdate(resolvedLake._id, { $inc: { reportCount: 1 } });
    }

    await AuditLog.create({
      user: req.user._id, action: 'REPORT_CREATE',
      target: report._id, 
      targetType: 'FishingReport',
      details: { lakeName: report.lakeName }
    });

    const populated = await FishingReport.findById(report._id)
      .populate('user', 'name avatar')
      .populate('lake', 'name slug')
      .lean();

    return created(res, { report: populated }, 'Fishing report submitted successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a fishing report
// @route   PUT /api/reports/:id
// @access  Private (Owner or Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateReport = async (req, res) => {
  try {
    const report = await FishingReport.findById(req.params.id);
    if (!report) return notFound(res, 'Report not found');

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = report.user.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to update this report');

    const updatable = ['title', 'text', 'tags', 'conditions', 'catchCount', 'biggestCatch', 'score', 'fishedAt', 'featured', 'status'];
    updatable.forEach(f => { if (req.body[f] !== undefined) report[f] = req.body[f]; });

    await report.save();
    const updated = await FishingReport.findById(report._id).populate('user', 'name avatar').populate('lake', 'name slug').lean();
    return success(res, { report: updated }, 'Report updated successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a fishing report
// @route   DELETE /api/reports/:id
// @access  Private (Owner or Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteReport = async (req, res) => {
  try {
    const report = await FishingReport.findById(req.params.id);
    if (!report) return notFound(res, 'Report not found');

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = report.user.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to delete this report');

    // Decrement lake counter
    if (report.lake) {
      await Lake.findByIdAndUpdate(report.lake, { $inc: { reportCount: -1 } });
    }

    await report.deleteOne();

    await AuditLog.create({
      user: req.user._id, action: 'REPORT_DELETE',
      target: report._id, 
      targetType: 'FishingReport',
    });

    return success(res, null, 'Report deleted successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Mark a report as helpful / unhelpful
// @route   POST /api/reports/:id/helpful
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleHelpful = async (req, res) => {
  try {
    const report   = await FishingReport.findById(req.params.id);
    if (!report)   return notFound(res, 'Report not found');

    const userId   = req.user._id;
    const hasVoted = report.helpfulBy.some(id => id.toString() === userId.toString());

    if (hasVoted) {
      report.helpfulBy     = report.helpfulBy.filter(id => id.toString() !== userId.toString());
      report.helpfulCount  = Math.max(0, report.helpfulCount - 1);
    } else {
      report.helpfulBy.push(userId);
      report.helpfulCount += 1;
    }
    await report.save();

    return success(res, { helpfulCount: report.helpfulCount, isHelpful: !hasVoted });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current user's reports
// @route   GET /api/reports/my
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyReports = async (req, res) => {
  try {
    const { page = 1, limit = 6 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [reports, total] = await Promise.all([
      FishingReport.find({ user: req.user._id })
        .sort({ fishedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('lake', 'name slug')
        .lean(),
      FishingReport.countDocuments({ user: req.user._id }),
    ]);

    return success(res, {
      reports,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get unique lake names for filter dropdown
// @route   GET /api/reports/lakes
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getReportLakeNames = async (req, res) => {
  try {
    const names = await FishingReport.distinct('lakeName', { status: 'active' });
    return success(res, { lakes: names.sort() });
  } catch (error) {
    return serverError(res, error.message);
  }
};
