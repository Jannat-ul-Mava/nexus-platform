// ── Collaboration Controller ────────────────────────────────────────────────
const Collaboration = require('../models/Collaboration.model');
const { createNotification } = require('../utils/notification.utils');

exports.sendRequest = async (req, res, next) => {
  try {
    const { entrepreneurId, message } = req.body;
    if (req.user.role !== 'investor') {
      return res.status(403).json({ success: false, message: 'Only investors can send collaboration requests.' });
    }

    const existing = await Collaboration.findOne({ investor: req.user._id, entrepreneur: entrepreneurId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Collaboration request already sent.' });
    }

    const collab = await Collaboration.create({
      investor: req.user._id,
      entrepreneur: entrepreneurId,
      message
    });

    await createNotification({
      recipient: entrepreneurId,
      type: 'collaboration_request',
      title: 'New Collaboration Request',
      message: `${req.user.name} wants to collaborate with you.`,
      actionUrl: `/collaborations/${collab._id}`,
      relatedId: collab._id.toString()
    });

    res.status(201).json({ success: true, collaboration: collab });
  } catch (error) {
    next(error);
  }
};

exports.respondToRequest = async (req, res, next) => {
  try {
    const { status, responseMessage } = req.body;
    const collab = await Collaboration.findById(req.params.id).populate('investor', 'name');
    if (!collab) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (!collab.entrepreneur.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    collab.status = status;
    collab.responseMessage = responseMessage;
    collab.respondedAt = new Date();
    await collab.save();

    await createNotification({
      recipient: collab.investor._id,
      type: status === 'accepted' ? 'collaboration_accepted' : 'collaboration_rejected',
      title: `Collaboration Request ${status}`,
      message: `${req.user.name} has ${status} your collaboration request.`,
      relatedId: collab._id.toString()
    });

    res.status(200).json({ success: true, collaboration: collab });
  } catch (error) {
    next(error);
  }
};

exports.getMyCollaborations = async (req, res, next) => {
  try {
    const query = req.user.role === 'investor'
      ? { investor: req.user._id }
      : { entrepreneur: req.user._id };

    const collabs = await Collaboration.find(query)
      .populate('investor', 'name avatarUrl role firmName')
      .populate('entrepreneur', 'name avatarUrl role startupName')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, collaborations: collabs });
  } catch (error) {
    next(error);
  }
};

module.exports.collaborationController = { sendRequest: exports.sendRequest, respondToRequest: exports.respondToRequest, getMyCollaborations: exports.getMyCollaborations };
