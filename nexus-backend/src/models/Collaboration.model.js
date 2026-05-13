const mongoose = require('mongoose');

const collaborationSchema = new mongoose.Schema({
  investor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  entrepreneur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
    default: 'pending'
  },
  responseMessage: { type: String },
  respondedAt: { type: Date }

}, { timestamps: true });

collaborationSchema.index({ investor: 1, entrepreneur: 1 }, { unique: true });

module.exports = mongoose.model('Collaboration', collaborationSchema);
