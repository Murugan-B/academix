const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const learningController = require('../controllers/learningController');

// All endpoints in this router are student-specific
router.get('/topics', authMiddleware, roleMiddleware(['STUDENT']), learningController.getStudentWeakTopics);
router.post('/generate', authMiddleware, roleMiddleware(['STUDENT']), learningController.generateLearningContent);

module.exports = router;
