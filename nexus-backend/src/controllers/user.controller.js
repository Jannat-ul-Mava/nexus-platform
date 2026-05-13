const User = require('../models/User.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary.utils');

// ─── Get all users (with filters) ────────────────────────────────────────────
exports.getUsers = async (req, res, next) => {
  try {
    const { role, industry, investmentStage, search, page = 1, limit = 12 } = req.query;
    const query = { isActive: true };

    if (role) query.role = role;
    if (industry) query.industry = industry;
    if (investmentStage) query.investmentStage = { $in: [investmentStage] };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } },
        { startupName: { $regex: search, $options: 'i' } },
        { firmName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).select('-password -passwordResetToken -twoFactorOTP -refreshToken')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get single user profile ──────────────────────────────────────────────────
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -passwordResetToken -twoFactorOTP -refreshToken');
    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// ─── Update own profile ───────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    // Fields the user can update themselves
    const allowedFields = [
      'name', 'bio', 'location', 'website', 'linkedIn',
      'startupName', 'pitchSummary', 'fundingNeeded', 'industry', 'foundedYear', 'teamSize',
      'investmentInterests', 'investmentStage', 'portfolioCompanies', 'minimumInvestment', 'maximumInvestment', 'firmName'
    ];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true
    }).select('-password -passwordResetToken -twoFactorOTP -refreshToken');

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// ─── Upload avatar ────────────────────────────────────────────────────────────
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'nexus/avatars',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl: result.secure_url },
      { new: true }
    ).select('-password');

    res.status(200).json({ success: true, avatarUrl: result.secure_url, user });
  } catch (error) {
    next(error);
  }
};

// ─── Get investors (for entrepreneur browsing) ────────────────────────────────
exports.getInvestors = async (req, res, next) => {
  req.query.role = 'investor';
  return exports.getUsers(req, res, next);
};

// ─── Get entrepreneurs (for investor browsing) ────────────────────────────────
exports.getEntrepreneurs = async (req, res, next) => {
  req.query.role = 'entrepreneur';
  return exports.getUsers(req, res, next);
};

// ─── Deactivate account ───────────────────────────────────────────────────────
exports.deactivateAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    res.status(200).json({ success: true, message: 'Account deactivated.' });
  } catch (error) {
    next(error);
  }
};
