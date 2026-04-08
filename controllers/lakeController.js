const Lake         = require('../models/Lake');
const AuditLog     = require('../models/AuditLog');
const Review       = require('../models/Review');
const UserFavourite= require('../models/UserFavourite');
const FishingReport= require('../models/FishingReport');
const BassPorn     = require('../models/BassPorn');
const { success, created, notFound, badRequest, serverError, forbidden } = require('../utils/apiResponse');
const path  = require('path');
const fs    = require('fs');

// ── Helper: resolves photo URL from uploaded file ─────────────────────────────
const buildFileUrl = (req, filename, subdir = 'lakes') =>
  `${req.protocol}://${req.get('host')}/uploads/${subdir}/${filename}`;

// ── Helper: recalculate and patch lake rating ──────────────────────────────
const recalcLakeRating = async (lakeId) => {
  const agg = await Review.aggregate([
    { $match: { lake: lakeId, status: 'active', targetType: 'lake' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg   = agg[0]?.avg   ?? 0;
  const count = agg[0]?.count ?? 0;
  await Lake.findByIdAndUpdate(lakeId, {
    rating:      Math.round(avg * 10) / 10,
    ratingCount: count,
    reviewCount: count,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all public lakes (paginated, filterable, searchable)
// @route   GET /api/lakes
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getLakes = async (req, res) => {
  try {
    const {
      page = 1, limit = 12, search = '', state = '',
      species = '', condition = '', clarity = '',
      minRating = 0, sortBy = 'rating', order = 'desc',
      featured, status = ''
    } = req.query;

    const query = {};

    // Status filter:
    // - admin/manager: see all by default, optional status query can narrow results
    // - user/public: only active + closed
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'manager');
    if (isAdmin) {
      if (status && status !== 'all') {
        query.status = status;
      }
    } else {
      const visibleStatuses = ['active', 'closed'];
      if (status && visibleStatuses.includes(status)) {
        query.status = status;
      } else {
        query.status = { $in: visibleStatuses };
      }
    }

    // Text search
    if (search) query.$text = { $search: search };

    // Filters
    if (state)     query.state = { $regex: state, $options: 'i' };
    if (species)   query.species = { $regex: species, $options: 'i' };
    if (condition) query['conditions.condition'] = condition;
    if (clarity)   query['conditions.clarity'] = clarity;
    if (Number(minRating) > 0) query.rating = { $gte: Number(minRating) };
    if (featured === 'true') query.featured = true;

    // Sort
    const sortField = ['rating', 'name', 'size', 'catchRate', 'createdAt'].includes(sortBy) ? sortBy : 'rating';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };
    if (search) sort.score = { $meta: 'textScore' };

    const skip = (Number(page) - 1) * Number(limit);
    const [lakes, total] = await Promise.all([
      Lake.find(query)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .select('-seasonalPatterns -__v')
          .lean(),
      Lake.countDocuments(query),
    ]);

    // Populate isFavourite for each lake if user is logged in
    let finalLakes = lakes;
    if (req.user) {
      const lakeIds = lakes.map(l => l._id);
      const favourites = await UserFavourite.find({
        user: req.user._id,
        lake: { $in: lakeIds },
        targetType: 'lake'
      });
      const favouriteSet = new Set(favourites.map(f => f.lake.toString()));
      finalLakes = lakes.map(l => ({
        ...l,
        isFavourite: favouriteSet.has(l._id.toString())
      }));
    }

    return success(res, {
      lakes: finalLakes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get unique lake names
// @route   GET /api/lakes/names
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getLakeNames = async (req, res) => {
  try {
    const isAdmin = req.user && ['admin', 'manager'].includes(req.user.role);

    const query = isAdmin
      ? {}
      : { status: { $in: ['active', 'closed'] } };

    const names = await Lake.distinct('name', query);

    return success(res, {
      lakes: names
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get authenticated user's favourited lakes
// @route   GET /api/lakes/favourites
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyFavouriteLakes = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 12);
    const skip = (pageNum - 1) * limitNum;

    const [favourites, total] = await Promise.all([
      UserFavourite.find({ user: req.user._id, targetType: 'lake' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({
          path: 'lake',
          select: '-seasonalPatterns -__v',
        })
        .lean(),
      UserFavourite.countDocuments({ user: req.user._id, targetType: 'lake' }),
    ]);

    const lakes = favourites
      .map((f) => f.lake)
      .filter(Boolean)
      .map((lake) => ({ ...lake, isFavourite: true }));

    return success(res, {
      lakes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get single lake by ID or slug
// @route   GET /api/lakes/:id
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getLakeById = async (req, res) => {
  try {
    const { id } = req.params;
    const lake = await Lake.findOne(
      id.match(/^[a-f\d]{24}$/i) ? { _id: id } : { slug: id }
    )
      .populate('submittedBy', 'name avatar')
      .populate('approvedBy',  'name')
      .lean();

    if (!lake) return notFound(res, 'Lake not found');

    // Public can see active/closed lakes. Pending/rejected are restricted.
    if (!['active', 'closed'].includes(lake.status)) {
      const isAdmin = req.user && ['admin', 'manager'].includes(req.user.role);
      const isOwner = req.user && lake.submittedBy?._id?.toString() === req.user._id.toString();
      if (!isAdmin && !isOwner) return notFound(res, 'Lake not found');
    }

    // Check if current user has favourited this lake
    let isFavourite = false;
    if (req.user) {
      isFavourite = !!(await UserFavourite.findOne({ user: req.user._id, lake: lake._id, targetType: 'lake' }));
    }

    return success(res, { lake: { ...lake, isFavourite } });
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new lake (Admin) or request a lake (User)
// @route   POST /api/lakes
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.createLake = async (req, res) => {
  try {
    const isAdmin = req.user && ['admin', 'manager'].includes(req.user.role);

    const toTitleCase = (str) => typeof str === 'string' ? str.trim().toLowerCase().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

    const {
      name, state, description, size, elevation, maxDepth, avgDepth,
      species, topTechniques, nearestCity, facilities,
      catchRate, recordBass, color, seasonalPatterns,
      conditions, coordinates, featured, bestSeason
    } = req.body;

    if (!name || !state) return badRequest(res, 'Name and state are required');

    // Build slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Check for duplicate slug
    const exists = await Lake.findOne({ slug });
    if (exists) return badRequest(res, 'A lake with this name already exists');

    // Image handling
    let imageUrl = req.body.image || '';
    if (req.file) {
      imageUrl = buildFileUrl(req, req.file.filename);
    }

    const lake = await Lake.create({
      name, slug, state,
      description: description || '',
      size:        Number(size)      || 0,
      elevation:   Number(elevation) || 0,
      maxDepth:    Number(maxDepth)  || 0,
      avgDepth:    Number(avgDepth)  || 0,
      species:     Array.isArray(species) ? species : (species ? [species] : []),
      topTechniques: Array.from(new Set(
        (Array.isArray(topTechniques) ? topTechniques : (topTechniques ? [topTechniques] : []))
        .map(tTitle => toTitleCase(tTitle)).filter(Boolean)
      )),
      nearestCity: nearestCity || '',
      facilities:  facilities  || {},
      catchRate:   Number(catchRate)  || 0,
      recordBass:  Number(recordBass) || 0,
      color:       color || 'from-cyan-700/80 to-sky-900/80',
      seasonalPatterns: seasonalPatterns || [],
      conditions:  conditions || {},
      coordinates: coordinates || {},
      image:       imageUrl,
      featured:    featured === 'true' || featured === true || false,
      status:      isAdmin ? 'active' : 'pending',
      submittedBy: req.user._id,
      approvedBy:  isAdmin ? req.user._id : null,
      approvedAt:  isAdmin ? new Date() : null,
      bestSeason:  bestSeason || '',
    });

    await AuditLog.create({
      user: req.user._id, action: 'LAKE_CREATE',
      target: lake._id, 
      targetType: 'Lake',
      details: { name: lake.name, status: lake.status }
    });

    return created(res, { lake }, isAdmin ? 'Lake created successfully' : 'Lake submitted for review');
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update lake
// @route   PUT /api/lakes/:id
// @access  Private (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateLake = async (req, res) => {
  try {
    const lake = await Lake.findById(req.params.id);
    if (!lake) return notFound(res, 'Lake not found');

    const isAdmin = req.user && ['admin', 'manager'].includes(req.user.role);
    const isOwner = lake.submittedBy?.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to update this lake');

    // Allowed update fields
    const updatable = [
      'name', 'state', 'description', 'size', 'elevation', 'maxDepth', 'avgDepth',
      'species', 'topTechniques', 'nearestCity', 'facilities', 'catchRate', 'recordBass', 'color',
      'seasonalPatterns', 'conditions', 'coordinates', 'featured', 'status', 'bestSeason',
    ];

    const toTitleCase = (str) => typeof str === 'string' ? str.trim().toLowerCase().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'topTechniques') {
          const rawTechs = Array.isArray(req.body[field]) ? req.body[field] : [req.body[field]];
          lake[field] = Array.from(new Set(rawTechs.map(tTitle => toTitleCase(tTitle)).filter(Boolean)));
        } else {
          lake[field] = req.body[field];
        }
      }
    });

    // Image handling
    if (req.file) {
      // Delete old image
      if (lake.image && lake.image.includes('/uploads/')) {
        try {
          const filename = lake.image.split('/uploads/lakes/').pop();
          const filepath = path.join(__dirname, '..', 'uploads', 'lakes', filename);
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        } catch (_) {}
      }
      lake.image = buildFileUrl(req, req.file.filename);
    }

    // Approval tracking
    if (req.body.status === 'active' && lake.status !== 'active' && isAdmin) {
      lake.approvedBy = req.user._id;
      lake.approvedAt = new Date();
    }

    // Recalc slug if name changed
    if (req.body.name && req.body.name !== lake.name) {
      lake.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    await lake.save();

    await AuditLog.create({
      user: req.user._id, action: 'LAKE_UPDATE',
      target: lake._id, 
      targetType: 'Lake',
      details: { name: lake.name }
    });

    return success(res, { lake }, 'Lake updated successfully');
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete lake
// @route   DELETE /api/lakes/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteLake = async (req, res) => {
  try {
    const lake = await Lake.findById(req.params.id);
    if (!lake) return notFound(res, 'Lake not found');

    if (!['admin'].includes(req.user.role)) return forbidden(res, 'Only admins can delete lakes');

    // Clean up image
    if (lake.image && lake.image.includes('/uploads/')) {
      try {
        const filename = lake.image.split('/uploads/lakes/').pop();
        const filepath = path.join(__dirname, '..', 'uploads', 'lakes', filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch (_) {}
    }

    await lake.deleteOne();

    await AuditLog.create({
      user: req.user._id, action: 'LAKE_DELETE',
      target: lake._id, 
      targetType: 'Lake',
      details: { name: lake.name }
    });

    return success(res, null, 'Lake deleted successfully');
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Toggle favourite a lake for authenticated user
// @route   POST /api/lakes/:id/favourite
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleFavouriteLake = async (req, res) => {
  try {
    const lake = await Lake.findById(req.params.id);
    if (!lake) return notFound(res, 'Lake not found');

    const query = { user: req.user._id, lake: lake._id, targetType: 'lake' };

    let isFavourite;
    const deleted = await UserFavourite.findOneAndDelete(query);

    if (deleted) {
      await Lake.findByIdAndUpdate(lake._id, { $inc: { favouriteCount: -1 } });
      isFavourite = false;
    } else {
      const upsertResult = await UserFavourite.updateOne(
        query,
        { $setOnInsert: query },
        { upsert: true },
      );

      if (upsertResult.upsertedCount > 0) {
        await Lake.findByIdAndUpdate(lake._id, { $inc: { favouriteCount: 1 } });
      }

      isFavourite = true;
    }

    return success(res, { isFavourite }, isFavourite ? 'Added to favourites' : 'Removed from favourites');
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get lake reviews
// @route   GET /api/lakes/:id/reviews
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getLakeReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const lake = await Lake.findById(req.params.id);
    if (!lake) return notFound(res, 'Lake not found');

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      Review.find({ lake: lake._id, targetType: 'lake', status: 'active' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('user', 'name avatar')
            .lean(),
      Review.countDocuments({ lake: lake._id, targetType: 'lake', status: 'active' }),
    ]);

    // Check if current user has already reviewed
    let userReview = null;
    if (req.user) {
      userReview = await Review.findOne({ user: req.user._id, lake: lake._id, targetType: 'lake' }).lean();
    }

    return success(res, {
      reviews, userReview,
      pagination: {
        page: Number(page), limit: Number(limit), total,
        pages: Math.ceil(total / Number(limit)),
      },
      stats: {
        avgRating: lake.rating,
        totalReviews: lake.ratingCount,
      }
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create / update lake review (1 per user per lake)
// @route   POST /api/lakes/:id/reviews
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrUpdateLakeReview = async (req, res) => {
  try {
    const { rating, text, title } = req.body;
    if (!rating || !text) return badRequest(res, 'Rating and text are required');
    if (Number(rating) < 1 || Number(rating) > 5) return badRequest(res, 'Rating must be between 1 and 5');

    const lake = await Lake.findById(req.params.id);
    if (!lake) return notFound(res, 'Lake not found');

    const existing = await Review.findOne({ user: req.user._id, lake: lake._id, targetType: 'lake' });

    let review;
    let isNew = false;
    if (existing) {
      existing.rating = Number(rating);
      existing.text   = text;
      existing.title  = title || '';
      await existing.save();
      review = existing;
    } else {
      review = await Review.create({
        user: req.user._id,
        lake: lake._id,
        targetType: 'lake',
        rating: Number(rating),
        text,
        title: title || '',
      });
      isNew = true;
    }

    // Recalculate lake rating
    await recalcLakeRating(lake._id);

    const populatedReview = await Review.findById(review._id).populate('user', 'name avatar').lean();

    return isNew
      ? created(res, { review: populatedReview }, 'Review submitted successfully')
      : success(res, { review: populatedReview }, 'Review updated successfully');
  } catch (error) {
    if (error.code === 11000) return badRequest(res, 'You have already reviewed this lake');
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a lake review (own or admin)
// @route   DELETE /api/lakes/:id/reviews/:reviewId
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteLakeReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return notFound(res, 'Review not found');

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = review.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to delete this review');

    await review.deleteOne();
    await recalcLakeRating(review.lake);

    return success(res, null, 'Review deleted successfully');
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Approve / Reject a lake (Admin)
// @route   PATCH /api/lakes/:id/status
// @access  Private (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateLakeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'pending', 'rejected'].includes(status)) {
      return badRequest(res, 'Invalid status. Must be active, pending, or rejected');
    }

    const lake = await Lake.findById(req.params.id);
    if (!lake) return notFound(res, 'Lake not found');

    lake.status = status;
    if (status === 'active') {
      lake.approvedBy = req.user._id;
      lake.approvedAt = new Date();
    }
    await lake.save();

    await AuditLog.create({
      user: req.user._id, action: `LAKE_${status.toUpperCase()}`,
      target: lake._id, 
      targetType: 'Lake',
      details: { name: lake.name, status }
    });

    return success(res, { lake }, `Lake ${status === 'active' ? 'approved' : status} successfully`);
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get lake reports (linked fishing reports)
// @route   GET /api/lakes/:id/reports
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getLakeReports = async (req, res) => {
  try {
    const { page = 1, limit = 6 } = req.query;
    const lake = await Lake.findById(req.params.id);
    if (!lake) return notFound(res, 'Lake not found');

    let query = { lake: lake._id, status: 'active' };
    
    if (req.user) {
      if (['admin', 'manager'].includes(req.user.role)) {
        query = { lake: lake._id, status: { $in: ['active', 'pending'] } };
      } else {
        query = {
          lake: lake._id,
          $or: [
            { status: 'active' },
            { user: req.user._id, status: 'pending' }
          ]
        };
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      FishingReport.find(query)
                   .sort({ fishedAt: -1 })
                   .skip(skip)
                   .limit(Number(limit))
                   .populate('user', 'name avatar')
                   .lean(),
      FishingReport.countDocuments(query),
    ]);

    return success(res, {
      reports,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get featured / home-page lakes
// @route   GET /api/lakes/featured
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getFeaturedLakes = async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const lakes = await Lake.find({ status: 'active' })
      .sort({ featured: -1, rating: -1 })
      .limit(Number(limit))
      .select('-seasonalPatterns -__v')
      .lean();

    // Populate isFavourite for each lake if user is logged in
    let finalLakes = lakes;
    if (req.user) {
      const lakeIds = lakes.map(l => l._id);
      const favourites = await UserFavourite.find({
        user: req.user._id,
        lake: { $in: lakeIds },
        targetType: 'lake'
      });
      const favouriteSet = new Set(favourites.map(f => f.lake.toString()));
      finalLakes = lakes.map(l => ({
        ...l,
        isFavourite: favouriteSet.has(l._id.toString())
      }));
    }

    return success(res, { lakes: finalLakes });
  } catch (error) {
    return serverError(res, error);
  }
};
