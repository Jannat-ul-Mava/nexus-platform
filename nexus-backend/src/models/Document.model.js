const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  signatureImageUrl: { type: String, required: true },
  signedAt: { type: Date, default: Date.now },
  ipAddress: { type: String }
});

const documentVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  publicId: { type: String }, // Cloudinary public_id
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
  fileSize: { type: Number },
  changeNote: { type: String }
});

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Document name is required'],
    trim: true
  },
  description: { type: String },
  fileType: { type: String }, // mime type
  fileExtension: { type: String }, // pdf, docx, etc.
  currentVersion: { type: Number, default: 1 },
  versions: [documentVersionSchema],

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPublic: { type: Boolean, default: false },

  category: {
    type: String,
    enum: ['pitch-deck', 'contract', 'term-sheet', 'nda', 'financial', 'other'],
    default: 'other'
  },

  status: {
    type: String,
    enum: ['draft', 'pending-review', 'approved', 'rejected', 'signed'],
    default: 'draft'
  },

  signatures: [signatureSchema],
  requiresSignature: { type: Boolean, default: false },
  signatureRequestedFrom: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  tags: [{ type: String }],
  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ sharedWith: 1 });

module.exports = mongoose.model('Document', documentSchema);
