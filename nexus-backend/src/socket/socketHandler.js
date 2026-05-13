const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { Message, Conversation } = require('../models/Message.model');

// Map: userId → socketId
const onlineUsers = new Map();

// Map: roomId → Set of socket IDs
const videoRooms = new Map();

exports.initializeSocket = (io) => {

  // ── Auth middleware for sockets ──────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🔌 User connected: ${socket.user.name} (${userId})`);

    // Track online status
    onlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`); // personal room for notifications

    // Update online status in DB
    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit('user:online', { userId, isOnline: true });

    // ── CHAT EVENTS ─────────────────────────────────────────────────────────────

    socket.on('chat:send', async ({ receiverId, content, type = 'text' }) => {
      try {
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          content,
          type
        });

        const populated = await message.populate('sender', 'name avatarUrl');

        // Update conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [userId, receiverId], $size: 2 }
        });
        if (!conversation) {
          conversation = await Conversation.create({ participants: [userId, receiverId] });
        }
        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        // Emit to sender
        socket.emit('chat:message', populated);

        // Emit to receiver if online
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(`user:${receiverId}`).emit('chat:message', populated);
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('chat:typing', ({ receiverId, isTyping }) => {
      io.to(`user:${receiverId}`).emit('chat:typing', {
        senderId: userId,
        senderName: socket.user.name,
        isTyping
      });
    });

    socket.on('chat:read', async ({ senderId }) => {
      await Message.updateMany(
        { sender: senderId, receiver: userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
      io.to(`user:${senderId}`).emit('chat:read', { readBy: userId });
    });

    // ── VIDEO CALL / WebRTC SIGNALING ────────────────────────────────────────────

    socket.on('video:join-room', ({ roomId }) => {
      if (!videoRooms.has(roomId)) videoRooms.set(roomId, new Set());
      const room = videoRooms.get(roomId);

      // Notify others in room
      socket.to(roomId).emit('video:user-joined', {
        userId,
        userName: socket.user.name,
        avatarUrl: socket.user.avatarUrl,
        socketId: socket.id
      });

      room.add(socket.id);
      socket.join(roomId);
      socket.currentRoom = roomId;

      // Send list of existing participants to new joiner
      const participants = Array.from(room).filter(id => id !== socket.id);
      socket.emit('video:room-participants', { participants });

      console.log(`📹 ${socket.user.name} joined room ${roomId}`);
    });

    // WebRTC offer (sent from one peer to another)
    socket.on('video:offer', ({ offer, targetSocketId }) => {
      io.to(targetSocketId).emit('video:offer', {
        offer,
        fromSocketId: socket.id,
        fromUser: { userId, name: socket.user.name, avatarUrl: socket.user.avatarUrl }
      });
    });

    // WebRTC answer
    socket.on('video:answer', ({ answer, targetSocketId }) => {
      io.to(targetSocketId).emit('video:answer', { answer, fromSocketId: socket.id });
    });

    // ICE Candidates
    socket.on('video:ice-candidate', ({ candidate, targetSocketId }) => {
      io.to(targetSocketId).emit('video:ice-candidate', { candidate, fromSocketId: socket.id });
    });

    // Toggle audio/video state
    socket.on('video:toggle-media', ({ roomId, type, enabled }) => {
      socket.to(roomId).emit('video:media-toggle', {
        userId,
        type, // 'audio' | 'video'
        enabled
      });
    });

    // Leave video room
    socket.on('video:leave-room', ({ roomId }) => {
      handleLeaveRoom(socket, io, roomId, userId);
    });

    // ── NOTIFICATIONS ────────────────────────────────────────────────────────────

    socket.on('notification:read', async ({ notificationId }) => {
      const Notification = require('../models/Notification.model');
      await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { isRead: true, readAt: new Date() }
      );
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.user.name}`);
      onlineUsers.delete(userId);

      // Leave any video room
      if (socket.currentRoom) {
        handleLeaveRoom(socket, io, socket.currentRoom, userId);
      }

      await User.findByIdAndUpdate(userId, { isOnline: false });
      io.emit('user:online', { userId, isOnline: false });
    });
  });

  return io;
};

function handleLeaveRoom(socket, io, roomId, userId) {
  const room = videoRooms.get(roomId);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) videoRooms.delete(roomId);
  }
  socket.leave(roomId);
  socket.to(roomId).emit('video:user-left', { userId, socketId: socket.id });
  console.log(`📴 User left room ${roomId}`);
}
