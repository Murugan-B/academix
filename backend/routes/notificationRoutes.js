const express = require('express');
const router = express.Router();
const { createNotification, getNotifications, markAsRead, getSentNotifications } = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// FACULTY is included because the role value in the DB is 'FACULTY', not 'MENTOR'.
// The notification controller's inner logic validates what Faculty can actually send.
router.post('/', authMiddleware, roleMiddleware(['INSTITUTE_ADMIN', 'SUPER_ADMIN', 'HOD', 'MENTOR', 'FACULTY']), upload.single('image'), createNotification);
router.get('/', authMiddleware, getNotifications);
router.get('/sent', authMiddleware, roleMiddleware(['INSTITUTE_ADMIN', 'SUPER_ADMIN', 'HOD', 'MENTOR', 'FACULTY']), getSentNotifications);
router.patch('/:id/read', authMiddleware, markAsRead);

module.exports = router;
