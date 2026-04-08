const express  = require('express');
const router   = express.Router();
const {
  getLakes, getLakeById, createLake, updateLake, deleteLake,
  toggleFavouriteLake, getLakeReviews, createOrUpdateLakeReview,
  deleteLakeReview, updateLakeStatus, getLakeReports, getFeaturedLakes, getLakeNames,
} = require('../controllers/lakeController');
const { protect }          = require('../middleware/authMiddleware');
const { optionalProtect }  = require('../middleware/authMiddleware');
const { authProtected }    = require('../middleware/authMiddleware');
const createUpload         = require('../middleware/uploadMiddleware');
const lakeUpload           = createUpload('lakes');

// ── Public ───────────────────────────────────────────────────────────────────
router.get('/featured', optionalProtect, getFeaturedLakes);
router.get('/names',    optionalProtect, getLakeNames);
router.get('/',         optionalProtect, getLakes);
router.get('/:id',      optionalProtect, getLakeById);
router.get('/:id/reviews', optionalProtect, getLakeReviews);
router.get('/:id/reports', optionalProtect, getLakeReports);

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
