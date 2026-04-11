const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const BassPorn = require('../models/BassPorn');
const FishingReport = require('../models/FishingReport');
const UserFavourite = require('../models/UserFavourite');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { blacklistToken, isBlacklisted } = require('../utils/tokenBlacklist');

const ACCESS_TOKEN_TTL = '1y';
const REFRESH_TOKEN_TTL = '5y';
const ACCESS_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 5 * 365 * 24 * 60 * 60 * 1000;

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: ACCESS_TOKEN_TTL,
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || 'refresh_secret', {
    expiresIn: REFRESH_TOKEN_TTL,
  });
};

const isProduction = process.env.NODE_ENV === 'production';

const normalizeDomain = (domain = '') => domain.trim().replace(/^\./, '').toLowerCase();

const getMatchedDomain = (req, configuredDomains) => {
  if (!configuredDomains) return null;

  const domains = configuredDomains
    .split(',')
    .map(d => normalizeDomain(d))
    .filter(Boolean);

  const requestHost = (req?.hostname || req?.get?.('host') || '')
    .toString()
    .split(':')[0]
    .toLowerCase();

  if (!requestHost) return null;

  // Find the first domain that the request host is a part of
  return domains.find(d => requestHost === d || requestHost.endsWith(`.${d}`)) || null;
};

const buildCookieOptions = ({ req, httpOnly, maxAge }) => {
  const options = {
    httpOnly,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };

  if (typeof maxAge === 'number') {
    options.maxAge = maxAge;
  }

  const matchedDomain = getMatchedDomain(req, process.env.COOKIE_DOMAIN);
  if (matchedDomain) {
    options.domain = matchedDomain;
  }

  if (isProduction) {
    options.partitioned = true;
  }

  return options;
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');

    if (user && (await bcrypt.compare(password, user.password))) {
      // Robust status check
      const status = (user.status || '').toString().trim().toLowerCase();
      
      if (status === 'pending') {
        return res.status(403).json({ message: 'Oh no! Your account is pending verification. Please verify your email first.' });
      }
      
      if (status !== 'active') {
        return res.status(403).json({ message: 'Oh no! Your account is suspended or banned' });
      }

      const accessToken = generateAccessToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Save refresh token to user
      user.refreshToken = refreshToken;
      await user.save();

      // Log action
      await AuditLog.create({
        user: user._id,
        action: 'LOGIN',
        target: user._id,
        targetType: 'User',
        details: { ip: req.ip }
      });

      // Send refresh token in httpOnly cookie
      const refreshCookieOptions = buildCookieOptions({
        req,
        httpOnly: true,
        maxAge: REFRESH_TOKEN_TTL_MS,
      });

      res.cookie('refreshToken', refreshToken, refreshCookieOptions);

      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        permissions: user.permissions,
        accessToken: accessToken,
        refreshToken: refreshToken,
      });

    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register a public user (Customer)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate 6-digit OTP for verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expireDate = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    const hashedOtp = await bcrypt.hash(otp, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user',
      status: 'pending', // Force verification
      permissions: ['view_applications', 'view_notifications', 'customer'],
      verificationOtp: hashedOtp,
      verificationExpires: expireDate
    });

    if (user) {
      // Send email
      try {
        const sendEmail = require('../utils/sendEmail');
        await sendEmail({
          email: user.email,
          subject: 'Welcome to BassInsight - Verify Your Account',
          message: `Your verification OTP is ${otp}. It is valid for 10 minutes.`
        });
      } catch (err) {
        console.error('Email sending failed during registration:', err);
      }

      res.status(201).json({
         message: 'Registration successful. OTP sent to email.',
         email: user.email,
         status: 'pending'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  const cookies = req.cookies;
  const rToken = cookies?.refreshToken;

  if (!rToken) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const blacklisted = await isBlacklisted(rToken);
    if (blacklisted) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    let decoded;
    try {
      decoded = jwt.verify(rToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret');
    } catch (verifyError) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(403).json({ message: 'Forbidden' });

    if (user.status === 'suspended' || user.status === 'banned' || user.status === 'pending') {
      return res.status(403).json({ message: 'Oh no! Your account is not active' });
    }

    if (user.refreshToken && user.refreshToken !== rToken) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (!user.refreshToken) {
      user.refreshToken = rToken;
      await user.save();
    }

    const accessToken = generateAccessToken(user._id);
    const expires_at = Date.now() + ACCESS_TOKEN_TTL_MS;

    res.json({ 
      message: "Token refreshed successfully",
      access_token: accessToken,
      expires_in: ACCESS_TOKEN_TTL_MS,
      expires_at 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = async (req, res) => {
  const cookies = req.cookies;
  const rToken = cookies?.refreshToken;
  const authorization = req.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.split(' ')[1] : null;

  if (rToken) {
    try {
      await blacklistToken(rToken, 'refresh');
      const user = await User.findOne({ refreshToken: rToken });
      if (user) {
        user.refreshToken = '';
        await user.save();
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (accessToken) {
    try {
      await blacklistToken(accessToken, 'access');
    } catch (error) {
      console.error(error);
    }
  }

  const refreshCookieOptions = buildCookieOptions({ req, httpOnly: true });
  const contextCookieOptions = buildCookieOptions({ req, httpOnly: false });

  res.clearCookie('refreshToken', refreshCookieOptions);
  res.clearCookie('userRole', contextCookieOptions);
  res.clearCookie('userEmail', contextCookieOptions);
  res.clearCookie('userName', contextCookieOptions);
  res.clearCookie('userPermissions', contextCookieOptions);

  res.status(200).json({ message: 'Logged out successfully' });
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [catchAgg, reportCount, favouriteLakeDocs, recentCatches] = await Promise.all([
      BassPorn.aggregate([
        { $match: { user: req.user._id } },
        {
          $group: {
            _id: null,
            catches: { $sum: 1 },
            biggestCatch: { $max: '$weight' },
            totalWeight: { $sum: '$weight' },
          },
        },
      ]),
      FishingReport.countDocuments({ user: req.user._id }),
      UserFavourite.find({ user: req.user._id, targetType: 'lake' })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate({
          path: 'lake',
          select: 'name slug state image rating reviewCount description species status',
          match: { status: { $in: ['active', 'closed'] } },
        })
        .lean(),
      BassPorn.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('lake', 'name slug')
        .lean(),
    ]);

    const stats = catchAgg[0] || { catches: 0, biggestCatch: 0, totalWeight: 0 };
    const favouriteLakes = favouriteLakeDocs
      .map((f) => f.lake)
      .filter(Boolean)
      .map((lake) => ({ ...lake, isFavourite: true }));

    return res.json({
      success: true,
      message: 'Profile fetched successfully',
      data: {
        ...user,
        stats: {
          catches: Number(stats.catches || 0),
          biggestCatch: Number(stats.biggestCatch || 0),
          totalWeight: Number(stats.totalWeight || 0),
          favorites: favouriteLakes.length,
          reports: Number(reportCount || 0),
        },
        favouriteLakes,
        myCatches: recentCatches,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update own profile
// @route   PUT /api/auth/me
// @access  Private
const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { name, phone, location } = req.body;

    if (name     !== undefined) user.name     = name.trim();
    if (phone    !== undefined) user.phone    = phone.trim();
    if (location !== undefined) user.location = location.trim();

    // Re-use logic from userController if needed, but here's the combined version:
    if (req.file) {
      // old avatar cleanup
      if (user.avatar) {
        try {
          const path = require('path');
          const fs = require('fs');
          const filename = user.avatar.split('/uploads/users/').pop();
          if (filename) {
            const filepath = path.join(__dirname, '..', 'uploads', 'users', filename);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
          }
        } catch (_) {}
      }

      // Build external URL
      const protocol = req.protocol;
      const host = req.get('host');
      user.avatar = `${protocol}://${host}/uploads/users/${req.file.filename}`;
    }

    await user.save();

    // Fetch safe copy without password or refresh token
    const safeUser = await User.findById(user._id).select('-password -refreshToken');

    res.json({
      success: true,
      data: safeUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change own password
// @route   PUT /api/auth/me/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect current password' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(new_password, salt);
    const currentRefreshToken = req.cookies?.refreshToken;
    if (currentRefreshToken) {
      await blacklistToken(currentRefreshToken, 'refresh');
    }
    user.refreshToken = '';
    await user.save();

    if (currentRefreshToken) {
      const refreshCookieOptions = buildCookieOptions({ req, httpOnly: true });
      res.clearCookie('refreshToken', refreshCookieOptions);
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No user found with that email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expireDate = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordExpires = expireDate;
    await user.save();

    // Send email
    const message = `Your password reset OTP is ${otp}. It is valid for 10 minutes.`;
    const sendEmail = require('../utils/sendEmail');
    await sendEmail({
      email: user.email,
      subject: 'Password Reset OTP',
      message
    });

    res.json({ message: 'OTP sent to email', success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    // Check if user is pending (verification flow) or active (reset flow)
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.resetPasswordOtp && await bcrypt.compare(otp, user.resetPasswordOtp)) {
      if (user.resetPasswordExpires < new Date()) {
        return res.status(400).json({ message: 'Reset OTP has expired' });
      }
      // Valid reset OTP. Returns early. DO NOT save() as nothing changed.
      return res.json({ message: 'OTP verified successfully', verified: true, flow: 'reset' });
    } 
    
    if (user.verificationOtp && await bcrypt.compare(otp, user.verificationOtp)) {
      if (user.verificationExpires < new Date()) {
        return res.status(400).json({ message: 'Verification OTP has expired' });
      }
      // Valid verification OTP
      user.status = 'active';
      user.verificationOtp = undefined;
      user.verificationExpires = undefined;

      await user.save();
      return res.json({ message: 'OTP verified successfully', verified: true, flow: 'signup' });
    }

    return res.status(400).json({ message: 'Invalid OTP' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({ email });
    
    if (!user) return res.status(400).json({ message: 'Invalid OTP or Email' });
    
    if (!user.resetPasswordOtp || !(await bcrypt.compare(otp, user.resetPasswordOtp))) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    if (user.resetPasswordExpires < new Date()) return res.status(400).json({ message: 'OTP has expired' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // reset OTP flags
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful', success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  loginUser,
  registerUser,
  refreshToken,
  logoutUser,
  getMyProfile,
  updateMyProfile,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword
};
