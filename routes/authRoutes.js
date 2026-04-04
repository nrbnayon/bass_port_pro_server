const express = require('express');
const router = express.Router();
const { loginUser, registerUser, refreshToken, logoutUser, getUserProfile, forgotPassword, verifyOtp, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, loginLimiter, passwordResetLimiter } = require('../middleware/rateLimitMiddleware');

router.use(authLimiter);

router.post('/login', loginLimiter, loginUser);
router.post('/register', registerUser);
router.post('/refresh', refreshToken);
router.post('/logout', logoutUser);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/verify-otp', passwordResetLimiter, verifyOtp);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router.get('/me', protect, getUserProfile);

module.exports = router;
