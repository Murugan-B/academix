const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/material/:materialId', authMiddleware, quizController.getQuiz);
router.post('/material/:materialId/generate', authMiddleware, quizController.generateQuiz);
router.post('/:quizId/attempt', authMiddleware, quizController.startAttempt);
router.post('/attempt/:attemptId/submit', authMiddleware, quizController.submitAttempt);
router.get('/material/:materialId/history', authMiddleware, quizController.getAttemptHistory);
router.get('/attempt/:attemptId', authMiddleware, quizController.getAttemptDetails);

module.exports = router;
