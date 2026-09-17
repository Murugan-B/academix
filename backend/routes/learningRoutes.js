const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const learningController = require('../controllers/learningController');

// Student personalized learning endpoints
router.get('/topics', authMiddleware, roleMiddleware(['STUDENT']), learningController.getStudentWeakTopics);
router.post('/generate', authMiddleware, roleMiddleware(['STUDENT']), learningController.generateLearningContent);
router.post('/flashcards', authMiddleware, roleMiddleware(['STUDENT']), learningController.generateFlashcards);
router.post('/study-plan', authMiddleware, roleMiddleware(['STUDENT']), learningController.generateStudyPlan);
router.post('/revision', authMiddleware, roleMiddleware(['STUDENT']), learningController.generateSmartRevision);
router.get('/search', authMiddleware, learningController.semanticSearch);

module.exports = router;
