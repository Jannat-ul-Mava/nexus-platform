const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'meeting_request', 'meeting_accepted', 'meeting_rejected', 'meeting_cancelled',
      'collaboration_request', 'collaboration_accepted', 'collaboration_rejected',
      'document_shared', 'document_signed', 'signature_requested',
      'payment_received', 'payment_sent',
      'message_received',
      'system'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  actionUrl: { type: String }, // frontend link
  relatedId: { type: String }, // ID of related entity
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
