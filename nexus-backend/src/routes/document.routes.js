const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { protect } = require('../middleware/auth.middleware');
const { uploadDocument, uploadSignature, handleUploadError } = require('../middleware/upload.middleware');

router.post('/', protect, uploadDocument, handleUploadError, documentController.uploadDocument);
router.get('/', protect, documentController.getMyDocuments);
router.get('/:id', protect, documentController.getDocument);
router.post('/:id/version', protect, uploadDocument, handleUploadError, documentController.uploadNewVersion);
router.post('/:id/sign', protect, uploadSignature, handleUploadError, documentController.signDocument);
router.post('/:id/share', protect, documentController.shareDocument);
router.delete('/:id', protect, documentController.deleteDocument);

module.exports = router;
