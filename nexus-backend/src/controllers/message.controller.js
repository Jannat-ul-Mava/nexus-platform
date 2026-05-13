const { Message, Conversation } = require('../models/Message.model');
const User = require('../models/User.model');

// Get or create conversation between two users
const getOrCreateConversation = async (user1, user2) => {
  let conversation = await Conversation.findOne({
    participants: { $all: [user1, user2], $size: 2 }
  });

  if (!conversation) {
    conversation = await Conversation.create({ participants: [user1, user2], unreadCount: { [user2.toString()]: 0 } });
  }
  return conversation;
};

// ─── Get conversations list ────────────────────────────────────────────────────
exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'name avatarUrl isOnline role')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
};

// ─── Get messages in a conversation ───────────────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const conversation = await getOrCreateConversation(req.user._id, userId);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ],
      isDeleted: false
    })
      .populate('sender', 'name avatarUrl')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      { sender: userId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, messages, conversationId: conversation._id });
  } catch (error) {
    next(error);
  }
};

// ─── Send a message ────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiverId, content, type = 'text' } = req.body;

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ success: false, message: 'Receiver not found.' });

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content,
      type
    });

    // Update conversation
    const conversation = await getOrCreateConversation(req.user._id, receiverId);
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populated = await message.populate('sender', 'name avatarUrl');

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    next(error);
  }
};

// ─── Mark messages as read ─────────────────────────────────────────────────────
exports.markAsRead = async (req, res, next) => {
  try {
    const { senderId } = req.params;
    await Message.updateMany(
      { sender: senderId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.status(200).json({ success: true, message: 'Messages marked as read.' });
  } catch (error) {
    next(error);
  }
};
