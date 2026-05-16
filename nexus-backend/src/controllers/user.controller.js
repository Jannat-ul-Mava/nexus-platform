const User = require('../models/User.model');
const path = require('path');
const fs = require('fs');

let useCloudinary = false;
let cloudinaryUtils = null;
try {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'placeholder') {
    cloudinaryUtils = require('../utils/cloudinary.utils');
    useCloudinary = true;
  }
} catch {}

const uploadFile = async (buffer, folder, originalname) => {
  if (useCloudinary && cloudinaryUtils) {
    const result = await cloudinaryUtils.uploadToCloudinary(buffer, { folder: `nexus/${folder}`, resource_type: 'image' });
    return result.secure_url;
  }
  const uploadsDir = path.join(process.cwd(), 'uploads', folder);
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = path.extname(originalname || '.jpg');
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/uploads/${folder}/${filename}`;
};

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
    res.status(200).json({ success: true, users, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) { next(error); }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -passwordResetToken -twoFactorOTP -refreshToken');
    if (!user || !user.isActive) return res.status(404).json({ success: false, message: 'User not found.' });
    res.status(200).json({ success: true, user });
  } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name','bio','location','website','linkedIn','startupName','pitchSummary','fundingNeeded','industry','foundedYear','teamSize','investmentInterests','investmentStage','portfolioCompanies','minimumInvestment','maximumInvestment','firmName'];
    const updates = {};
    allowedFields.forEach(field => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
      .select('-password -passwordResetToken -twoFactorOTP -refreshToken');
    res.status(200).json({ success: true, user });
  } catch (error) { next(error); }
};

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const avatarUrl = await uploadFile(req.file.buffer, 'avatars', req.file.originalname);
    const user = await User.findByIdAndUpdate(req.user._id, { avatarUrl }, { new: true }).select('-password');
    res.status(200).json({ success: true, avatarUrl, user });
  } catch (error) { next(error); }
};

exports.getInvestors = async (req, res, next) => { req.query.role = 'investor'; return exports.getUsers(req, res, next); };
exports.getEntrepreneurs = async (req, res, next) => { req.query.role = 'entrepreneur'; return exports.getUsers(req, res, next); };
exports.deactivateAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    res.status(200).json({ success: true, message: 'Account deactivated.' });
  } catch (error) { next(error); }
};
