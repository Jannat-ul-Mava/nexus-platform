const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: 200
  },
  description: { type: String, maxlength: 1000 },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  scheduledAt: {
    type: Date,
    required: [true, 'Meeting date/time is required']
  },
  duration: {
    type: Number, // in minutes
    default: 30,
    min: 15,
    max: 480
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['video', 'in-person', 'phone'],
    default: 'video'
  },
  // Video room info
  roomId: { type: String, unique: true, sparse: true },
  roomToken: { type: String },
  meetingLink: { type: String },

  // Response tracking per participant
  responses: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['accepted', 'rejected', 'pending'], default: 'pending' },
    message: { type: String },
    respondedAt: { type: Date }
  }],

  notes: { type: String },
  agenda: [{ type: String }],
  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// Index for conflict detection
meetingSchema.index({ organizer: 1, scheduledAt: 1 });
meetingSchema.index({ participants: 1, scheduledAt: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
