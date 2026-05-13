const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'transfer', 'payment'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  currency: { type: String, default: 'USD' },

  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },

  description: { type: String },
  reference: { type: String }, // internal ref

  // Stripe fields
  stripePaymentIntentId: { type: String },
  stripeChargeId: { type: String },
  stripeTransferId: { type: String },

  // For investment deals
  dealId: { type: String },
  relatedStartup: { type: String },

  metadata: { type: mongoose.Schema.Types.Mixed },
  failureReason: { type: String },
  processedAt: { type: Date }

}, { timestamps: true });

transactionSchema.index({ sender: 1, createdAt: -1 });
transactionSchema.index({ recipient: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
