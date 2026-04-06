const express  = require('express');
const router   = express.Router();
const {
  getLakes, getLakeById, createLake, updateLake, deleteLake,
  toggleFavouriteLake, getLakeReviews, createOrUpdateLakeReview,
  deleteLakeReview, updateLakeStatus, getLakeReports, getFeaturedLakes,
} = require('../controllers/lakeController');
const { protect }          = require('../middleware/authMiddleware');
const { authProtected }    = require('../middleware/authMiddleware');
const createUpload         = require('../middleware/uploadMiddleware');
const lakeUpload           = createUpload('lakes');

// ── Public ───────────────────────────────────────────────────────────────────
router.get('/featured', getFeaturedLakes);
router.get('/',         getLakes);
router.get('/:id',      getLakeById);
router.get('/:id/reviews', getLakeReviews);
router.get('/:id/reports', getLakeReports);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.post('/', protect,
  lakeUpload.single('image'),
  createLake
);

router.post('/:id/favourite', protect, toggleFavouriteLake);

router.post('/:id/reviews', protect, createOrUpdateLakeReview);
router.delete('/:id/reviews/:reviewId', protect, deleteLakeReview);

// ── Admin / Manager ───────────────────────────────────────────────────────────
router.put('/:id',
  protect, authProtected('admin', 'manager'),
  lakeUpload.single('image'),
  updateLake
);
router.patch('/:id/status', protect, authProtected('admin', 'manager'), updateLakeStatus);
router.delete('/:id',       protect, authProtected('admin'),           deleteLake);

module.exports = router;
