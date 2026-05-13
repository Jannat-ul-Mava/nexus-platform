const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meeting.controller');
const { protect } = require('../middleware/auth.middleware');
const { meetingValidation, validate } = require('../middleware/validation.middleware');

router.post('/', protect, meetingValidation, validate, meetingController.createMeeting);
router.get('/', protect, meetingController.getMyMeetings);
router.get('/:id', protect, meetingController.getMeeting);
router.get('/:id/room', protect, meetingController.getMeetingRoom);
router.patch('/:id/respond', protect, meetingController.respondToMeeting);
router.patch('/:id/cancel', protect, meetingController.cancelMeeting);

module.exports = router;
