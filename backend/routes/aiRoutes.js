const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/summarize', authMiddleware, aiController.generateSummary);
router.get('/summaries/:materialId', authMiddleware, aiController.getSummaries);
router.post('/chat', authMiddleware, aiController.askQuestion);
router.get('/chat/:materialId', authMiddleware, aiController.getChatHistory);
router.get('/health', authMiddleware, aiController.getHealth);

module.exports = router;
