const express = require('express');
const router  = express.Router();
const {
  getCatches, getCatchById, createCatch, updateCatch, deleteCatch,
  toggleLikeCatch, toggleFavouriteCatch, getMyCatches, getMyFavouriteCatches,
} = require('../controllers/bassPornController');
const { protect, optionalProtect, authProtected } = require('../middleware/authMiddleware');

// ── Upload middleware for catch images ───────────────────────────────────────
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'catches');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?._id?.toString() || 'guest';
    const ext    = path.extname(file.originalname).toLowerCase();
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

const catchUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Admin management ─────────────────────────────────────────────────────────
router.get('/admin', protect, authProtected('admin', 'manager'), getCatches);

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/', optionalProtect, getCatches);

// ── Authenticated-only named routes (MUST come before /:id) ─────────────────
router.get('/my',         protect, getMyCatches);
router.get('/favourites', protect, getMyFavouriteCatches);

router.get('/:id', optionalProtect, getCatchById);

// ── Authenticated mutations ───────────────────────────────────────────────────
router.post('/',         protect, catchUpload.single('image'), createCatch);
router.post('/:id/like',      protect, toggleLikeCatch);
router.post('/:id/favourite', protect, toggleFavouriteCatch);

// ── Owner or Admin ────────────────────────────────────────────────────────────
router.put('/:id',    protect, catchUpload.single('image'), updateCatch);
router.delete('/:id', protect, deleteCatch);

module.exports = router;
