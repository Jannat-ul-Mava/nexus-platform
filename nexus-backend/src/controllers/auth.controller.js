const crypto = require('crypto');
const User = require('../models/User.model');
const { sendTokenResponse, generateOTP } = require('../utils/jwt.utils');
const { sendPasswordResetEmail, sendOTPEmail } = require('../utils/email.utils');

// ─── Register ────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, ...profileData } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({ name, email, password, role, ...profileData });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ email, role }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email, password, or role.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated.' });
    }

    // If 2FA enabled, send OTP instead of token
    if (user.twoFactorEnabled) {
      const otp = generateOTP();
      user.twoFactorOTP = otp;
      user.twoFactorOTPExpires = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY) || 300) * 1000);
      await user.save({ validateBeforeSave: false });
      await sendOTPEmail(user, otp);
      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        message: 'OTP sent to your email. Please verify.',
        userId: user._id
      });
    }

    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─── Verify 2FA OTP ──────────────────────────────────────────────────────────
exports.verifyOTP = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.twoFactorOTP !== otp || user.twoFactorOTPExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    user.twoFactorOTP = undefined;
    user.twoFactorOTPExpires = undefined;
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─── Logout ──────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isOnline: false, refreshToken: null });
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─── Get Me ──────────────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
};

// ─── Forgot Password ─────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      // Security: don't reveal if email exists
      return res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 min
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(user, resetToken);
    res.status(200).json({ success: true, message: 'If this email exists, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

// ─── Reset Password ──────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─── Change Password ─────────────────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(req.body.currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    user.password = req.body.newPassword;
    await user.save();
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─── Toggle 2FA ──────────────────────────────────────────────────────────────
exports.toggle2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.twoFactorEnabled = !user.twoFactorEnabled;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({
      success: true,
      message: `2FA ${user.twoFactorEnabled ? 'enabled' : 'disabled'}.`,
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch (error) {
    next(error);
  }
};

// ─── Refresh Token ───────────────────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const { verifyRefreshToken, generateAccessToken } = require('../utils/jwt.utils');
    const decoded = verifyRefreshToken(req.body.refreshToken);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    const accessToken = generateAccessToken(user._id);
    res.status(200).json({ success: true, accessToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};
