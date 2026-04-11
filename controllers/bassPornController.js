const BassPorn      = require('../models/BassPorn');
const Lake          = require('../models/Lake');
const UserFavourite = require('../models/UserFavourite');
const AuditLog      = require('../models/AuditLog');
const Comment       = require('../models/Comment');
const {
  success, created, notFound, badRequest, serverError, forbidden
} = require('../utils/apiResponse');
const { MAX_LIKES, getToggleArrayUpdate } = require('../utils/boundedArrays');
const path = require('path');
const fs   = require('fs');

const buildFileUrl = (req, filename, subdir = 'catches') =>
  `${req.protocol}://${req.get('host')}/uploads/${subdir}/${filename}`;

const toTitleCase = (str = '') =>
  str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const parseTechniqueList = (value = '') =>
  Array.from(
    new Set(
      String(value)
        .split(',')
        .map(t => toTitleCase(t))
        .filter(Boolean)
    )
  );

// Helper to inject isFavourite and isLiked status into a list of catches
const injectUserFlags = async (catches, user) => {
  if (!user || !catches.length) {
    return catches.map(c => ({
      ...c,
      isFavourite: false,
      isLiked: false,
      likedBy: undefined
    }));
  }

  const catchIds = catches.map(c => c._id.toString());
  
  // Fetch favourites
  const favs = await UserFavourite.find({ 
    user: user._id, 
    targetType: 'catch',
    catch: { $in: catchIds }
  }).select('catch').lean();
  const favouriteIds = new Set(favs.map(f => f.catch?.toString()));

  // Map results
  return catches.map(c => ({
    ...c,
    isFavourite: favouriteIds.has(c._id.toString()),
    isLiked: c.likedBy?.some(id => id.toString() === user._id.toString()) ?? false,
    likedBy: undefined, // don't expose full array to client
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all catches (paginated, sortable, filterable)
// @route   GET /api/bassporn
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getCatches = async (req, res) => {
  try {
    const {
      page = 1, limit = 12,
      search = '', species = '', lake = '',
      sortBy = 'createdAt', order = 'desc',
      user: userId, featured, status: queryStatus
    } = req.query;

    const query = {};

    // ── Admin Recognition ──────────────────────────────────────────
    const userRole = req.user?.role?.toLowerCase() || '';
    const isAdmin = ['admin', 'manager'].includes(userRole);
    
    if (isAdmin) {
      if (queryStatus && queryStatus !== 'all') {
        query.status = queryStatus;
      }
      // If queryStatus is empty or 'all', admin sees everything
    } else {
      // Non-admins (public) can ONLY see active catches
      query.status = 'active';
    }

    if (search) {
      query.$or = [
        { species:   { $regex: search, $options: 'i' } },
        { lakeName:  { $regex: search, $options: 'i' } },
        { technique: { $regex: search, $options: 'i' } },
        { bait:      { $regex: search, $options: 'i' } },
      ];
    }
    if (species)  query.species  = { $regex: species, $options: 'i' };
    if (lake)     query.lakeName = { $regex: lake,    $options: 'i' };
    if (userId)   query.user     = userId;
    if (featured === 'true') query.featured = true;

    const SORT_WHITELIST = ['createdAt', 'caughtAt', 'weight', 'likes', 'length'];
    const sortField = SORT_WHITELIST.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);
    const [catches, total] = await Promise.all([
      BassPorn.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .populate('user', 'name avatar')
        .populate('lake', 'name slug')
        .lean(),
      BassPorn.countDocuments(query),
    ]);

    // For admin users, fetch status counts for the dashboard stats
    let statusCounts = null;
    if (isAdmin) {
      const countsGroup = await BassPorn.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      statusCounts = {
        active:  countsGroup.find(g => g._id === 'active')?.count  || 0,
        pending: countsGroup.find(g => g._id === 'pending')?.count || 0,
        total:   countsGroup.reduce((acc, curr) => acc + curr.count, 0)
      };
    }

    const updatedCatches = await injectUserFlags(catches, req.user);

    return success(res, {
      catches: updatedCatches,
      statusCounts,
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
// @desc    Get a single catch by ID
// @route   GET /api/bassporn/:id
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getCatchById = async (req, res) => {
  try {
    const catchItem = await BassPorn.findById(req.params.id)
      .populate('user', 'name avatar location')
      .populate('lake', 'name slug state')
      .lean();

    if (!catchItem) return notFound(res, 'Catch not found');

    const isAdmin = ['admin', 'manager'].includes(req.user?.role?.toLowerCase() || '');
    const isOwner = req.user && catchItem.user?._id?.toString() === req.user._id.toString();
    if (['pending', 'rejected', 'flagged'].includes(catchItem.status) && !isAdmin && !isOwner) {
      return notFound(res, 'Catch not found');
    }

    let isFavourite = false;
    let isLiked     = false;
    if (req.user) {
      isFavourite = !!(await UserFavourite.findOne({ user: req.user._id, targetType: 'catch', catch: catchItem._id }));
      isLiked     = catchItem.likedBy?.some(id => id.toString() === req.user._id.toString()) ?? false;
    }

    return success(res, {
      catch: { ...catchItem, isFavourite, isLiked, likedBy: undefined }
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upload (create) a new catch
// @route   POST /api/bassporn
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.createCatch = async (req, res) => {
  try {
    const {
      species, weight, weightUnit, length, technique, bait, depth,
      description, lakeName, lakeId, caughtAt,
      weatherSnapshot, coordinates
    } = req.body;

    if (!species || !weight || !technique || !lakeName) {
      return badRequest(res, 'species, weight, technique and lakeName are required');
    }

    const parsedTechniques = parseTechniqueList(technique);
    if (!parsedTechniques.length) {
      return badRequest(res, 'At least one valid technique is required');
    }

    // Image is required
    if (!req.file && !req.body.image) {
      return badRequest(res, 'A catch photo is required');
    }

    const imageUrl = req.file ? buildFileUrl(req, req.file.filename) : req.body.image;

    // Resolve lake FK if ID provided
    let resolvedLake = null;
    if (lakeId) {
      resolvedLake = await Lake.findById(lakeId);
    } else {
      // Try to find by name
      resolvedLake = await Lake.findOne({ name: { $regex: new RegExp(`^${lakeName}$`, 'i') }, status: 'active' });
    }

    const catchDoc = await BassPorn.create({
      user:            req.user._id,
      lake:            resolvedLake?._id || null,
      lakeName:        resolvedLake?.name || lakeName,
      species,
      weight:          Number(weight),
      weightUnit:      weightUnit  || 'lbs',
      length:          length      ? Number(length)  : null,
      technique:       parsedTechniques.join(', '),
      bait:            bait         || '',
      depth:           depth        || '',
      description:     description  || '',
      caughtAt:        caughtAt     ? new Date(caughtAt) : new Date(),
      coordinates:     coordinates  || {},
      weatherSnapshot: weatherSnapshot || {},
      image:           imageUrl,
      status:          'pending',
    });

    // Keep lake top techniques enriched from catch uploads.
    if (resolvedLake) {
      await Lake.findByIdAndUpdate(resolvedLake._id, {
        $addToSet: { topTechniques: { $each: parsedTechniques } }
      });
    }

    await AuditLog.create({
      user: req.user._id, action: 'CATCH_CREATE',
      target: catchDoc._id, 
      targetType: 'BassPorn',
      details: { species, weight, lakeName: catchDoc.lakeName }
    });

    const populated = await BassPorn.findById(catchDoc._id)
      .populate('user', 'name avatar')
      .populate('lake', 'name slug')
      .lean();

    return created(res, { catch: populated }, 'Catch uploaded successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a catch
// @route   PUT /api/bassporn/:id
// @access  Private (Owner or Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.updateCatch = async (req, res) => {
  try {
    const catchDoc = await BassPorn.findById(req.params.id);
    if (!catchDoc) return notFound(res, 'Catch not found');

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = catchDoc.user.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to update this catch');

    const oldStatus = catchDoc.status;
    const oldLake   = catchDoc.lake;

    const updatable = ['species', 'weight', 'weightUnit', 'length', 'technique', 'bait', 'depth', 'description', 'caughtAt', 'weatherSnapshot', 'coordinates', 'featured', 'status', 'lake', 'lakeName'];
    updatable.forEach(f => { if (req.body[f] !== undefined) catchDoc[f] = req.body[f]; });

    const newStatus = catchDoc.status;
    const newLake   = catchDoc.lake;

    if (req.file) {
      if (catchDoc.image && catchDoc.image.includes('/uploads/')) {
        try {
          const fn = catchDoc.image.split('/uploads/catches/').pop();
          const fp = path.join(__dirname, '..', 'uploads', 'catches', fn);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch (_) {}
      }
      catchDoc.image = buildFileUrl(req, req.file.filename);
    }

    await catchDoc.save();

    const normalizedTechniques = parseTechniqueList(catchDoc.technique);
    if (newLake && normalizedTechniques.length) {
      await Lake.findByIdAndUpdate(newLake, {
        $addToSet: { topTechniques: { $each: normalizedTechniques } }
      });
    }

    // Side-effects on Lake counters
    const lakeChanged = oldLake?.toString() !== newLake?.toString();
    const statusChanged = oldStatus !== newStatus;

    if (statusChanged || lakeChanged) {
      // 1. Decrement old lake if it was active
      if (oldLake && oldStatus === 'active') {
        await Lake.findByIdAndUpdate(oldLake, { $inc: { catchCount: -1 } });
      }
      // 2. Increment new lake if it is now active
      if (newLake && newStatus === 'active') {
        await Lake.findByIdAndUpdate(newLake, { $inc: { catchCount: 1 } });
      }
    }

    const updated = await BassPorn.findById(catchDoc._id).populate('user', 'name avatar').populate('lake', 'name slug').lean();
    return success(res, { catch: updated }, 'Catch updated successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a catch
// @route   DELETE /api/bassporn/:id
// @access  Private (Owner or Admin)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteCatch = async (req, res) => {
  try {
    const catchDoc = await BassPorn.findById(req.params.id);
    if (!catchDoc) return notFound(res, 'Catch not found');

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = catchDoc.user.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to delete this catch');

    // Clean up image
    if (catchDoc.image && catchDoc.image.includes('/uploads/')) {
      try {
        const fn = catchDoc.image.split('/uploads/catches/').pop();
        const fp = path.join(__dirname, '..', 'uploads', 'catches', fn);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (_) {}
    }

    // Decrement lake counter ONLY IF it was active
    if (catchDoc.lake && catchDoc.status === 'active') {
      await Lake.findByIdAndUpdate(catchDoc.lake, { $inc: { catchCount: -1 } });
    }

    await catchDoc.deleteOne();
    await Comment.deleteMany({ targetType: 'catch', catch: catchDoc._id });
    await UserFavourite.deleteMany({ targetType: 'catch', catch: catchDoc._id });

    await AuditLog.create({
      user: req.user._id, action: 'CATCH_DELETE',
      target: catchDoc._id, 
      targetType: 'BassPorn',
    });

    return success(res, null, 'Catch deleted successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Like / Unlike a catch
// @route   POST /api/bassporn/:id/like
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleLikeCatch = async (req, res) => {
  try {
    const catchDoc = await BassPorn.findById(req.params.id);
    if (!catchDoc) return notFound(res, 'Catch not found');

    const userId   = req.user._id;
    const hasLiked = catchDoc.likedBy.some(id => id.toString() === userId.toString());

    if (hasLiked) {
      // Remove like - use atomic $pull operation
      const updated = await BassPorn.findByIdAndUpdate(
        req.params.id,
        {
          $pull: { likedBy: userId },
          $inc: { likes: -1 }
        },
        { new: true }
      );
      return success(res, { likes: updated.likes, isLiked: false });
    } else {
      // Add like - use atomic $push with $slice to cap array size
      const updated = await BassPorn.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            likedBy: {
              $each: [userId],
              $slice: -MAX_LIKES  // Keep only last MAX_LIKES items
            }
          },
          $inc: { likes: 1 }
        },
        { new: true }
      );
      return success(res, { likes: updated.likes, isLiked: true });
    }
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Favourite / Unfavourite a catch
// @route   POST /api/bassporn/:id/favourite
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleFavouriteCatch = async (req, res) => {
  try {
    const catchDoc = await BassPorn.findById(req.params.id);
    if (!catchDoc) return notFound(res, 'Catch not found');

    const query = { user: req.user._id, catch: catchDoc._id, targetType: 'catch' };

    let isFavourite;
    const deleted = await UserFavourite.findOneAndDelete(query);

    if (deleted) {
      isFavourite = false;
      await BassPorn.findByIdAndUpdate(catchDoc._id, { $inc: { favouriteCount: -1 } });
    } else {
      await UserFavourite.updateOne(
        query,
        { $setOnInsert: query },
        { upsert: true },
      );
      isFavourite = true;
      await BassPorn.findByIdAndUpdate(catchDoc._id, { $inc: { favouriteCount: 1 } });
    }

    return success(res, { isFavourite, favouriteCount: catchDoc.favouriteCount + (isFavourite ? 1 : -1) }, isFavourite ? 'Added to favourites' : 'Removed from favourites');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get user's own catches
// @route   GET /api/bassporn/my
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyCatches = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [catches, total] = await Promise.all([
      BassPorn.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('lake', 'name slug')
        .lean(),
      BassPorn.countDocuments({ user: req.user._id }),
    ]);

    const updatedCatches = await injectUserFlags(catches, req.user);

    return success(res, {
      catches: updatedCatches,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get user's favourited catches
// @route   GET /api/bassporn/favourites
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyFavouriteCatches = async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [favs, total] = await Promise.all([
      UserFavourite.find({ user: req.user._id, targetType: 'catch' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate({ path: 'catch', populate: [{ path: 'user', select: 'name avatar' }, { path: 'lake', select: 'name slug' }] })
        .lean(),
      UserFavourite.countDocuments({ user: req.user._id, targetType: 'catch' }),
    ]);

    const catches = favs.map(f => f.catch);
    const updatedCatches = await injectUserFlags(catches, req.user);

    return success(res, {
      catches: updatedCatches,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};
