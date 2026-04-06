const express = require('express');
const router  = express.Router();
const {
  getReports, getReportById, createReport, updateReport, deleteReport,
  toggleHelpful, getMyReports, getReportLakeNames,
} = require('../controllers/fishingReportController');
const { protect, optionalProtect, authProtected } = require('../middleware/authMiddleware');

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/lakes', getReportLakeNames);   // unique lake names for dropdown
router.get('/',         optionalProtect, getReports);

// ── Named authenticated routes (before /:id) ─────────────────────────────────
router.get('/my', protect, getMyReports);

router.get('/:id',  getReportById);

// ── Authenticated mutations ───────────────────────────────────────────────────
router.post('/',               protect, createReport);
router.post('/:id/helpful',    protect, toggleHelpful);

// ── Owner or Admin ────────────────────────────────────────────────────────────
router.put('/:id',    protect, updateReport);
router.delete('/:id', protect, deleteReport);

module.exports = router;
