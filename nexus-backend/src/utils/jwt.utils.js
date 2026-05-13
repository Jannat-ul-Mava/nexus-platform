const jwt = require('jsonwebtoken');

exports.generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

exports.generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  });
};

exports.verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
};

exports.sendTokenResponse = (user, statusCode, res) => {
  const accessToken = exports.generateAccessToken(user._id);
  const refreshToken = exports.generateRefreshToken(user._id);

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    user: user.toPublicProfile ? user.toPublicProfile() : user
  });
};
