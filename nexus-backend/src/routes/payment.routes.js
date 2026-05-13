const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');
const { paymentValidation, validate } = require('../middleware/validation.middleware');

router.post('/webhook', paymentController.stripeWebhook); // raw body, no auth
router.get('/wallet', protect, paymentController.getWallet);
router.get('/transactions', protect, paymentController.getTransactions);
router.post('/deposit', protect, paymentValidation, validate, paymentController.createDeposit);
router.patch('/deposit/:transactionId/confirm', protect, paymentController.confirmDeposit);
router.post('/withdrawal', protect, paymentValidation, validate, paymentController.createWithdrawal);
router.post('/transfer', protect, paymentController.createTransfer);

module.exports = router;
