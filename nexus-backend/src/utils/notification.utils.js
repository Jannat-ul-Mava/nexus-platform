const Notification = require('../models/Notification.model');

exports.createNotification = async ({ recipient, type, title, message, actionUrl, relatedId, metadata }) => {
  try {
    const notification = await Notification.create({
      recipient, type, title, message, actionUrl, relatedId, metadata
    });
    return notification;
  } catch (error) {
    console.error('Notification creation error:', error);
    // Don't throw — notifications failing shouldn't break main flow
  }
};

// Emit real-time notification via socket if user is online
exports.sendRealTimeNotification = (io, userId, notification) => {
  io.to(`user:${userId}`).emit('notification', notification);
};
