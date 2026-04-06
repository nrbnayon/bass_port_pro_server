const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
require('../models/Lake');
require('../models/BassPorn');
require('../models/FishingReport');

// @desc    Get audit logs (Admin: all, Manager/Agent: scoped)
// @route   GET /api/audit-logs
// @access  Private (view_audit_logs)
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    if (req.user.role !== 'admin') {
      const managedUsers = await User.find({ managedBy: req.user._id }).select('_id').lean();
      const managedIds = managedUsers.map((u) => u._id);

      query = {
        $or: [
          { user: req.user._id },
          { target: { $in: managedIds } },
        ],
      };
    }

    const total = await AuditLog.countDocuments(query);
    let data = await AuditLog.find(query)
      .populate('user', 'name email role avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Manually handle target population to avoid crashes on models with empty names
    // This is more resilient than Mongoose's refPath for legacy records
    const populatedData = await Promise.all(data.map(async (log) => {
      if (log.target && log.targetType && log.targetType !== 'None' && log.targetType !== '') {
        try {
          const Model = mongoose.model(log.targetType);
          if (Model) {
            log.target = await Model.findById(log.target).select('name email role avatar').lean();
          }
        } catch (e) {
          console.warn(`[AuditLog] Manual population failed for targetType: ${log.targetType}`, e.message);
        }
      }
      return log;
    }));

    res.json({
      success: true,
      count: populatedData.length,
      pagination: {
        current: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      data: populatedData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAuditLogs,
};
