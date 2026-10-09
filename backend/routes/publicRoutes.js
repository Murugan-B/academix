const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const authMiddleware = require('../middlewares/authMiddleware');
const optionalAuthMiddleware = require('../middlewares/optionalAuthMiddleware');

// 1. Global Normal Search (Web + Image + Approved Public Resources)
router.get('/search', optionalAuthMiddleware, publicController.normalSearch);

// 2. Featured Public Community Resources (Strictly is_public = TRUE AND status = 'APPROVED')
router.get('/featured-resources', publicController.getFeaturedResources);

// 3. Conversational AI Assistant & Search (Multi-turn, Web-grounded, Citation-backed)
router.post('/ai-search', optionalAuthMiddleware, publicController.aiChat);

// 4. Persistent Search History (Normal Search) - Authenticated Only
router.get('/history/normal', authMiddleware, publicController.getNormalSearchHistory);
router.delete('/history/normal/:id', authMiddleware, publicController.deleteNormalSearchHistoryItem);
router.delete('/history/normal', authMiddleware, publicController.clearNormalSearchHistory);

// 5. Persistent Search History (AI Conversations) - Authenticated Only
router.get('/history/ai-conversations', authMiddleware, publicController.getAiConversations);
router.get('/history/ai-conversations/:id', authMiddleware, publicController.getAiConversationDetails);
router.delete('/history/ai-conversations/:id', authMiddleware, publicController.deleteAiConversation);
router.delete('/history/ai-conversations', authMiddleware, publicController.clearAiConversations);

module.exports = router;
