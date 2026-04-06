const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
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
    const { 
      autoApproveMode, emailNotifications, twoFactorAuth, maintenanceMode,
      privacyPolicy, termsOfService 
    } = req.body;

    let settings = await Settings.findOne({ key: 'system_config' });
    
    if (!settings) {
      settings = new Settings({ key: 'system_config' });
    }

    if (autoApproveMode !== undefined)    settings.autoApproveMode = autoApproveMode;
    if (emailNotifications !== undefined) settings.emailNotifications = emailNotifications;
    if (twoFactorAuth !== undefined)      settings.twoFactorAuth = twoFactorAuth;
    if (maintenanceMode !== undefined)    settings.maintenanceMode = maintenanceMode;
    if (privacyPolicy !== undefined)      settings.privacyPolicy = privacyPolicy;
    if (termsOfService !== undefined)     settings.termsOfService = termsOfService;
    
    settings.lastUpdatedBy = req.user._id;

    await settings.save();

    // Log the change
    await AuditLog.create({
      user: req.user._id,
      action: 'SETTINGS_UPDATE',
      target: settings._id,
      targetType: 'Settings',
      details: { updatedFields: req.body }
    });

    return successResponse(res, 'System settings updated successfully', settings);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get public privacy/terms
// @route   GET /api/settings/legal
// @access  Public
const getPublicLegalInfo = async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'system_config' }).select('privacyPolicy termsOfService updatedAt');
    return successResponse(res, 'Legal information fetched successfully', settings || {});
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  getSystemSettings,
  updateSystemSettings,
  getPublicLegalInfo
};
