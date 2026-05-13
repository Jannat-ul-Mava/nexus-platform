const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { registerValidation, loginValidation, validate } = require('../middleware/validation.middleware');

router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);
router.post('/verify-otp', authController.verifyOTP);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);
router.patch('/change-password', protect, authController.changePassword);
router.patch('/toggle-2fa', protect, authController.toggle2FA);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
