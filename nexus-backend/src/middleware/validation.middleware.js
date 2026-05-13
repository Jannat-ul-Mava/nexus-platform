const { body, validationResult } = require('express-validator');

// Handle validation errors
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// Auth validators
exports.registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('role').isIn(['entrepreneur', 'investor']).withMessage('Role must be entrepreneur or investor')
];

exports.loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('role').isIn(['entrepreneur', 'investor']).withMessage('Role must be entrepreneur or investor')
];

// Meeting validators
exports.meetingValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('scheduledAt').isISO8601().withMessage('Valid date/time required'),
  body('participants').isArray({ min: 1 }).withMessage('At least one participant required'),
  body('duration').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be 15-480 minutes'),
  body('type').optional().isIn(['video', 'in-person', 'phone'])
];

// Payment validators
exports.paymentValidation = [
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least $1'),
  body('type').isIn(['deposit', 'withdrawal', 'transfer']).withMessage('Invalid transaction type')
];

// Profile validators
exports.profileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('bio').optional().isLength({ max: 1000 }),
  body('location').optional().trim(),
  body('website').optional().isURL().withMessage('Valid URL required')
];
