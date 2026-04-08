const express = require('express');
const router  = express.Router();
const {
  getReports, getReportById, createReport, updateReport, deleteReport,
  toggleHelpful, getMyReports, getReportLakeNames,
  uploadReportImage,
} = require('../controllers/fishingReportController');
const { protect, optionalProtect, requirePermission } = require('../middleware/authMiddleware');
const createUploadMiddleware = require('../middleware/uploadMiddleware');
const reportUpload = createUploadMiddleware('fishingReport');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/lakes', optionalProtect, getReportLakeNames);   // unique lake names for dropdown
router.get('/',         optionalProtect, getReports);

// ── Admin listing (permission protected) ────────────────────────────────────
router.get('/admin', protect, requirePermission('view_reports'), getReports);

// ── Named authenticated routes (before /:id) ─────────────────────────────────
router.get('/my', protect, getMyReports);
router.post('/upload-image', protect, reportUpload.single('image'), uploadReportImage);

router.get('/:id', optionalProtect, getReportById);

// ── Authenticated mutations ───────────────────────────────────────────────────
router.post('/',               protect, reportUpload.single('image'), createReport);
router.post('/:id/helpful',    protect, toggleHelpful);

// ── Owner or Admin ────────────────────────────────────────────────────────────
router.put('/:id',    protect, reportUpload.single('image'), updateReport);
router.delete('/:id', protect, deleteReport);

module.exports = router;
