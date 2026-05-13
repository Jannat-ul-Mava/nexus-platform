// collaboration.routes.js
const express = require('express');
const router = express.Router();
const collaborationController = require('../controllers/collaboration.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, collaborationController.sendRequest);
router.get('/', protect, collaborationController.getMyCollaborations);
router.patch('/:id/respond', protect, collaborationController.respondToRequest);

module.exports = router;
