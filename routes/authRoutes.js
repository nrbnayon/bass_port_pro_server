const express = require('express');
const router = express.Router();
const { loginUser, registerUser, refreshToken, logoutUser, getMyProfile, updateMyProfile, changePassword, forgotPassword, verifyOtp, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const createUpload = require('../middleware/uploadMiddleware');
const { authLimiter, loginLimiter, passwordResetLimiter } = require('../middleware/rateLimitMiddleware');
const userUpload = createUpload('users');

router.use(authLimiter);

router.post('/login', loginLimiter, loginUser);
router.post('/register', registerUser);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/verify-otp', passwordResetLimiter, verifyOtp);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router
  .route('/me')
  .get(protect, getMyProfile)
  .put(protect, userUpload.single('avatar'), updateMyProfile);

router.put('/me/change-password', protect, changePassword);

module.exports = router;
