const multer = require('multer');
const path = require('path');

// Use memory storage (for Cloudinary upload or local fallback)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Allowed: PDF, Word, PowerPoint, Images`), false);
  }
};

exports.uploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
}).single('file');

exports.uploadAvatar = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed for avatar'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
}).single('avatar');

exports.uploadSignature = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Signature must be an image'), false);
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
}).single('signature');

// Multer error handler
exports.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};
