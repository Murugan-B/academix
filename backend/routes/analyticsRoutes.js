const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const mentorOnly = roleMiddleware(['HOD', 'FACULTY']);

router.get('/student', authMiddleware, analyticsController.getStudentAnalytics);
router.get('/mentor/student/:studentId', authMiddleware, mentorOnly, analyticsController.getMentorAnalytics);

module.exports = router;
