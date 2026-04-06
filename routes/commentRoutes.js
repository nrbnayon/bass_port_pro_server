const express = require('express');
const router  = express.Router();
const {
  getComments, createComment, updateComment, deleteComment, toggleLikeComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/comments?targetType=catch&targetId=xxx&page=1
router.get('/', getComments);

// Protected
router.post('/',         protect, createComment);
router.put('/:id',       protect, updateComment);
router.delete('/:id',    protect, deleteComment);
router.post('/:id/like', protect, toggleLikeComment);

module.exports = router;
