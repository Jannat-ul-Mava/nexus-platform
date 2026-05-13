const { v4: uuidv4 } = require('uuid');
const Meeting = require('../models/Meeting.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const { sendMeetingInviteEmail } = require('../utils/email.utils');
const { createNotification } = require('../utils/notification.utils');

// ─── Check for conflicts ──────────────────────────────────────────────────────
const hasConflict = async (userId, scheduledAt, duration, excludeMeetingId = null) => {
  const startTime = new Date(scheduledAt);
  const endTime = new Date(startTime.getTime() + duration * 60000);

  const query = {
    $or: [{ organizer: userId }, { participants: userId }],
    status: { $in: ['pending', 'accepted'] },
    $and: [
      { scheduledAt: { $lt: endTime } },
      {
        $expr: {
          $gt: [
            { $add: ['$scheduledAt', { $multiply: ['$duration', 60000] }] },
            startTime.getTime()
          ]
        }
      }
    ]
  };

  if (excludeMeetingId) query._id = { $ne: excludeMeetingId };

  const conflict = await Meeting.findOne(query);
  return conflict;
};

// ─── Create Meeting ───────────────────────────────────────────────────────────
exports.createMeeting = async (req, res, next) => {
  try {
    const { title, description, scheduledAt, duration = 30, participants, type = 'video', agenda } = req.body;

    // Conflict check for organizer
    const organizerConflict = await hasConflict(req.user._id, scheduledAt, duration);
    if (organizerConflict) {
      return res.status(409).json({
        success: false,
        message: `You already have a meeting at this time: "${organizerConflict.title}"`
      });
    }

    // Validate participants exist
    const participantUsers = await User.find({ _id: { $in: participants } });
    if (participantUsers.length !== participants.length) {
      return res.status(400).json({ success: false, message: 'One or more participants not found.' });
    }

    const roomId = uuidv4();
    const meeting = await Meeting.create({
      title,
      description,
      scheduledAt,
      duration,
      participants,
      organizer: req.user._id,
      type,
      agenda,
      roomId,
      responses: participants.map(pId => ({ user: pId, status: 'pending' }))
    });

    const populated = await meeting.populate(['organizer', 'participants']);

    // Send invites
    for (const participant of participantUsers) {
      await createNotification({
        recipient: participant._id,
        type: 'meeting_request',
        title: 'New Meeting Invitation',
        message: `${req.user.name} invited you to "${title}"`,
        actionUrl: `/meetings/${meeting._id}`,
        relatedId: meeting._id.toString()
      });

      // Send email invite (non-blocking)
      sendMeetingInviteEmail(participant, meeting, req.user).catch(console.error);
    }

    res.status(201).json({ success: true, meeting: populated });
  } catch (error) {
    next(error);
  }
};

// ─── Get all meetings for current user ────────────────────────────────────────
exports.getMyMeetings = async (req, res, next) => {
  try {
    const { status, from, to } = req.query;
    const query = {
      $or: [{ organizer: req.user._id }, { participants: req.user._id }],
      isDeleted: false
    };

    if (status) query.status = status;
    if (from || to) {
      query.scheduledAt = {};
      if (from) query.scheduledAt.$gte = new Date(from);
      if (to) query.scheduledAt.$lte = new Date(to);
    }

    const meetings = await Meeting.find(query)
      .populate('organizer', 'name avatarUrl role')
      .populate('participants', 'name avatarUrl role')
      .sort({ scheduledAt: 1 });

    res.status(200).json({ success: true, meetings });
  } catch (error) {
    next(error);
  }
};

// ─── Get single meeting ───────────────────────────────────────────────────────
exports.getMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('organizer', 'name avatarUrl email role')
      .populate('participants', 'name avatarUrl email role')
      .populate('responses.user', 'name avatarUrl');

    if (!meeting || meeting.isDeleted) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }

    const isParticipant = meeting.participants.some(p => p._id.equals(req.user._id));
    const isOrganizer = meeting.organizer._id.equals(req.user._id);
    if (!isParticipant && !isOrganizer) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
};

// ─── Respond to meeting (accept/reject) ───────────────────────────────────────
exports.respondToMeeting = async (req, res, next) => {
  try {
    const { status, message: responseMessage } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be accepted or rejected.' });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting || meeting.isDeleted) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }

    const isParticipant = meeting.participants.some(p => p.equals(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'You are not a participant of this meeting.' });
    }

    // Check for conflict if accepting
    if (status === 'accepted') {
      const conflict = await hasConflict(req.user._id, meeting.scheduledAt, meeting.duration, meeting._id);
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Cannot accept - you have a conflicting meeting: "${conflict.title}"`
        });
      }
    }

    const responseIndex = meeting.responses.findIndex(r => r.user.equals(req.user._id));
    if (responseIndex !== -1) {
      meeting.responses[responseIndex].status = status;
      meeting.responses[responseIndex].message = responseMessage;
      meeting.responses[responseIndex].respondedAt = new Date();
    }

    // If all accepted → mark meeting accepted; if any rejected → keep pending
    const allAccepted = meeting.responses.every(r => r.status === 'accepted');
    if (allAccepted) meeting.status = 'accepted';

    await meeting.save();

    // Notify organizer
    await createNotification({
      recipient: meeting.organizer,
      type: status === 'accepted' ? 'meeting_accepted' : 'meeting_rejected',
      title: `Meeting ${status}`,
      message: `${req.user.name} has ${status} the meeting "${meeting.title}"`,
      actionUrl: `/meetings/${meeting._id}`,
      relatedId: meeting._id.toString()
    });

    res.status(200).json({ success: true, message: `Meeting ${status} successfully.`, meeting });
  } catch (error) {
    next(error);
  }
};

// ─── Cancel meeting (organizer only) ─────────────────────────────────────────
exports.cancelMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id).populate('participants', 'name');
    if (!meeting || meeting.isDeleted) {
      return res.status(404).json({ success: false, message: 'Meeting not found.' });
    }
    if (!meeting.organizer.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the organizer can cancel the meeting.' });
    }

    meeting.status = 'cancelled';
    await meeting.save();

    // Notify all participants
    for (const participant of meeting.participants) {
      await createNotification({
        recipient: participant._id,
        type: 'meeting_cancelled',
        title: 'Meeting Cancelled',
        message: `"${meeting.title}" has been cancelled by the organizer.`,
        relatedId: meeting._id.toString()
      });
    }

    res.status(200).json({ success: true, message: 'Meeting cancelled.', meeting });
  } catch (error) {
    next(error);
  }
};

// ─── Get meeting room token (for video call) ──────────────────────────────────
exports.getMeetingRoom = async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found.' });

    const isParticipant = meeting.participants.some(p => p.equals(req.user._id));
    const isOrganizer = meeting.organizer.equals(req.user._id);
    if (!isParticipant && !isOrganizer) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.status(200).json({
      success: true,
      roomId: meeting.roomId,
      meetingTitle: meeting.title,
      userId: req.user._id,
      userName: req.user.name
    });
  } catch (error) {
    next(error);
  }
};
