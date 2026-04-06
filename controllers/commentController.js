const Comment   = require('../models/Comment');
const BassPorn  = require('../models/BassPorn');
const FishingReport = require('../models/FishingReport');
const Lake      = require('../models/Lake');
const {
  success, created, notFound, badRequest, serverError, forbidden
} = require('../utils/apiResponse');

// ── Helper: validate target and return the model ──────────────────────────────
const resolveTarget = async (targetType, targetId) => {
  if (targetType === 'catch')  return BassPorn.findById(targetId);
  if (targetType === 'report') return FishingReport.findById(targetId);
  if (targetType === 'lake')   return Lake.findById(targetId);
  return null;
};

// ── Helper: increment commentCount on parent doc ──────────────────────────────
const incrementCommentCount = async (targetType, targetId, delta = 1) => {
  if (targetType === 'catch')  await BassPorn.findByIdAndUpdate(targetId, { $inc: { commentCount: delta } });
  if (targetType === 'report') await FishingReport.findByIdAndUpdate(targetId, { $inc: { commentCount: delta } });
  if (targetType === 'lake')   await Lake.findByIdAndUpdate(targetId, { $inc: { reviewCount: delta } });
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get comments for a target (catch / report / lake)
// @route   GET /api/comments?targetType=catch&targetId=xxx&page=1&limit=10
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
exports.getComments = async (req, res) => {
  try {
    const { targetType, targetId, page = 1, limit = 10, parent = null } = req.query;

    if (!targetType || !targetId) return badRequest(res, 'targetType and targetId are required');
    if (!['catch', 'report', 'lake'].includes(targetType)) return badRequest(res, 'Invalid targetType');

    const query = { targetType, status: 'active', parent: parent || null };
    query[targetType] = targetId;

    const skip = (Number(page) - 1) * Number(limit);
    const [comments, total] = await Promise.all([
      Comment.find(query)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('user', 'name avatar')
        .lean(),
      Comment.countDocuments(query),
    ]);

    // Inject isLiked
    let likedIds = new Set();
    if (req.user) {
      const liked = comments.filter(c => c.likedBy?.some(id => id.toString() === req.user._id.toString()));
      likedIds = new Set(liked.map(c => c._id.toString()));
    }

    const result = comments.map(c => ({
      ...c, isLiked: likedIds.has(c._id.toString()), likedBy: undefined
    }));

    return success(res, {
      comments: result,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Post a comment
// @route   POST /api/comments
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.createComment = async (req, res) => {
  try {
    const { targetType, targetId, text, parentId } = req.body;

    if (!targetType || !targetId || !text) return badRequest(res, 'targetType, targetId and text are required');
    if (!['catch', 'report', 'lake'].includes(targetType)) return badRequest(res, 'Invalid targetType');

    const target = await resolveTarget(targetType, targetId);
    if (!target) return notFound(res, 'Target not found');

    // Verify parent comment exists if replying
    let parentComment = null;
    if (parentId) {
      parentComment = await Comment.findById(parentId);
      if (!parentComment) return notFound(res, 'Parent comment not found');
    }

    const commentData = {
      user: req.user._id,
      targetType,
      text: text.trim(),
      parent: parentId || null,
      status: 'active',
    };
    commentData[targetType] = targetId;

    const comment = await Comment.create(commentData);

    // Increment parent replyCount if replying
    if (parentComment) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    } else {
      // Only count top-level comments in the target's counter
      await incrementCommentCount(targetType, targetId, 1);
    }

    const populated = await Comment.findById(comment._id).populate('user', 'name avatar').lean();
    return created(res, { comment: { ...populated, likedBy: undefined } }, 'Comment posted successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Edit own comment
// @route   PUT /api/comments/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.updateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return notFound(res, 'Comment not found');

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = comment.user.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to edit this comment');

    const { text } = req.body;
    if (!text || !text.trim()) return badRequest(res, 'Comment text is required');

    comment.text     = text.trim();
    comment.edited   = true;
    comment.editedAt = new Date();
    await comment.save();

    const updated = await Comment.findById(comment._id).populate('user', 'name avatar').lean();
    return success(res, { comment: { ...updated, likedBy: undefined } }, 'Comment updated successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a comment (own or admin)
// @route   DELETE /api/comments/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return notFound(res, 'Comment not found');

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = comment.user.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return forbidden(res, 'Not authorized to delete this comment');

    // Remove child replies
    await Comment.deleteMany({ parent: comment._id });

    const targetId = comment[comment.targetType];
    await comment.deleteOne();

    if (!comment.parent) {
      await incrementCommentCount(comment.targetType, targetId, -1);
    } else {
      await Comment.findByIdAndUpdate(comment.parent, { $inc: { replyCount: -1 } });
    }

    return success(res, null, 'Comment deleted successfully');
  } catch (error) {
    return serverError(res, error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Like / unlike a comment
// @route   POST /api/comments/:id/like
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleLikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return notFound(res, 'Comment not found');

    const userId   = req.user._id;
    const hasLiked = comment.likedBy.some(id => id.toString() === userId.toString());

    if (hasLiked) {
      comment.likedBy = comment.likedBy.filter(id => id.toString() !== userId.toString());
      comment.likes   = Math.max(0, comment.likes - 1);
    } else {
      comment.likedBy.push(userId);
      comment.likes += 1;
    }
    await comment.save();

    return success(res, { likes: comment.likes, isLiked: !hasLiked });
  } catch (error) {
    return serverError(res, error.message);
  }
};
