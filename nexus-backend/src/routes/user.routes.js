const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { uploadAvatar, handleUploadError } = require('../middleware/upload.middleware');
const { profileValidation, validate } = require('../middleware/validation.middleware');

router.get('/', protect, userController.getUsers);
router.get('/investors', protect, userController.getInvestors);
router.get('/entrepreneurs', protect, userController.getEntrepreneurs);
router.get('/:id', protect, userController.getUserById);
router.patch('/me', protect, profileValidation, validate, userController.updateProfile);
router.post('/me/avatar', protect, uploadAvatar, handleUploadError, userController.uploadAvatar);
router.delete('/me', protect, userController.deactivateAccount);

module.exports = router;
