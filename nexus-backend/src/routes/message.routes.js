const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/conversations', protect, messageController.getConversations);
router.get('/:userId', protect, messageController.getMessages);
router.post('/', protect, messageController.sendMessage);
router.patch('/read/:senderId', protect, messageController.markAsRead);

module.exports = router;
