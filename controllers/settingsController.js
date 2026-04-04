const Settings = require('../models/Settings');
const { successResponse, serverError, forbidden, notFound } = require('../utils/apiResponse');

// @desc    Get system settings
// @route   GET /api/settings
// @access  Private (Admin only)
const getSystemSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'system_config' });
    
    // Seed default if not found
    if (!settings) {
      settings = await Settings.create({ key: 'system_config' });
    }

    return successResponse(res, 'System settings fetched successfully', settings);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private (Admin only)
const updateSystemSettings = async (req, res) => {
  try {
    const { autoApproveMode, emailNotifications, twoFactorAuth, maintenanceMode } = req.body;

    let settings = await Settings.findOne({ key: 'system_config' });
    
    if (!settings) {
      settings = new Settings({ key: 'system_config' });
    }

    if (autoApproveMode !== undefined) settings.autoApproveMode = autoApproveMode;
    if (emailNotifications !== undefined) settings.emailNotifications = emailNotifications;
    if (twoFactorAuth !== undefined) settings.twoFactorAuth = twoFactorAuth;
    if (maintenanceMode !== undefined) settings.maintenanceMode = maintenanceMode;
    
    settings.lastUpdatedBy = req.user._id;

    await settings.save();

    return successResponse(res, 'System settings updated successfully', settings);
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  getSystemSettings,
  updateSystemSettings
};
