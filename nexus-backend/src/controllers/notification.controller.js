const Notification = require('../models/Notification.model');

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const query = { recipient: req.user._id };
    if (unreadOnly === 'true') query.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
      Notification.countDocuments(query)
    ]);

    res.status(200).json({ success: true, notifications, unreadCount, total });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    const query = { recipient: req.user._id };
    if (notificationIds?.length) {
      query._id = { $in: notificationIds };
    }
    await Notification.updateMany(query, { isRead: true, readAt: new Date() });
    res.status(200).json({ success: true, message: 'Notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    next(error);
  }
};
