const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false // never returned in queries by default
  },
  role: {
    type: String,
    enum: ['entrepreneur', 'investor'],
    required: true
  },
  avatarUrl: {
    type: String,
    default: function () {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=random`;
    }
  },
  bio: { type: String, default: '', maxlength: 1000 },
  isOnline: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },

  // Entrepreneur-specific fields
  startupName: { type: String },
  pitchSummary: { type: String, maxlength: 500 },
  fundingNeeded: { type: String },
  industry: { type: String },
  location: { type: String },
  foundedYear: { type: Number },
  teamSize: { type: Number },
  website: { type: String },
  linkedIn: { type: String },

  // Investor-specific fields
  investmentInterests: [{ type: String }],
  investmentStage: [{ type: String }],
  portfolioCompanies: [{ type: String }],
  totalInvestments: { type: Number, default: 0 },
  minimumInvestment: { type: String },
  maximumInvestment: { type: String },
  firmName: { type: String },

  // Auth & Security
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOTP: String,
  twoFactorOTPExpires: Date,
  refreshToken: String,

  // Stripe
  stripeCustomerId: { type: String },
  walletBalance: { type: Number, default: 0 }

}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Public profile (no sensitive fields)
userSchema.methods.toPublicProfile = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.twoFactorOTP;
  delete obj.twoFactorOTPExpires;
  delete obj.refreshToken;
  delete obj.stripeCustomerId;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
