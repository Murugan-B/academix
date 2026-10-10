const express = require('express');
const router = express.Router();
const multer = require('multer');
const publicController = require('../controllers/publicController');
const publicEcosystemController = require('../controllers/publicEcosystemController');
const authMiddleware = require('../middlewares/authMiddleware');
const optionalAuthMiddleware = require('../middlewares/optionalAuthMiddleware');

// Memory storage for chat file attachments and contributions
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

// 1. Global Normal Search (Web + Image + Approved Public Resources)
router.get('/search', optionalAuthMiddleware, publicController.normalSearch);

// 2. Featured Public Community Resources (Strictly is_public = TRUE AND status = 'APPROVED')
router.get('/featured-resources', publicController.getFeaturedResources);

// 3. Conversational AI Assistant & Search (Multi-turn, Multimodal Vision, Document Attachment, Web Grounding)
router.post('/ai-search', optionalAuthMiddleware, upload.single('file'), publicController.aiChat);

// 4. Persistent Search History (Normal Search) - Authenticated Only
router.get('/history/normal', authMiddleware, publicController.getNormalSearchHistory);
router.delete('/history/normal/:id', authMiddleware, publicController.deleteNormalSearchHistoryItem);
router.delete('/history/normal', authMiddleware, publicController.clearNormalSearchHistory);

// 5. Persistent Search History (AI Conversations) - Authenticated Only
router.get('/history/ai-conversations', authMiddleware, publicController.getAiConversations);
router.get('/history/ai-conversations/:id', authMiddleware, publicController.getAiConversationDetails);
router.delete('/history/ai-conversations/:id', authMiddleware, publicController.deleteAiConversation);
router.delete('/history/ai-conversations', authMiddleware, publicController.clearAiConversations);

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUBLIC COMMUNITY COURSE FOLDERS & LIBRARY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/courses', publicEcosystemController.getPublicCourses);
router.post('/courses', authMiddleware, publicEcosystemController.createPublicCourse);
router.get('/courses/:id', publicEcosystemController.getPublicCourseDetails);

// ─────────────────────────────────────────────────────────────────────────────
// 7. COMMUNITY CONTRIBUTION SYSTEM (Uploads, Google Drive, YouTube)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/contribute', authMiddleware, upload.single('file'), publicEcosystemController.contributeMaterial);
router.get('/my-contributions', authMiddleware, publicEcosystemController.getMyContributions);
router.delete('/my-contributions/:id', authMiddleware, publicEcosystemController.deleteMyContribution);

// ─────────────────────────────────────────────────────────────────────────────
// 8. SAVED MATERIALS (Bookmarks)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/saved-resources', authMiddleware, publicEcosystemController.getSavedResources);
router.post('/saved-resources/:resourceId', authMiddleware, publicEcosystemController.saveResource);
router.delete('/saved-resources/:resourceId', authMiddleware, publicEcosystemController.unsaveResource);

// ─────────────────────────────────────────────────────────────────────────────
// 9. PERSONAL STUDY NOTES
// ─────────────────────────────────────────────────────────────────────────────
router.get('/notes', authMiddleware, publicEcosystemController.getNotes);
router.post('/notes', authMiddleware, publicEcosystemController.createNote);
router.put('/notes/:id', authMiddleware, publicEcosystemController.updateNote);
router.delete('/notes/:id', authMiddleware, publicEcosystemController.deleteNote);
router.post('/notes/ai-generate', authMiddleware, publicEcosystemController.aiGenerateNote);

// ─────────────────────────────────────────────────────────────────────────────
// 10. AI PRACTICE TEST GENERATOR & TEST ATTEMPTS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tests/generate', authMiddleware, publicEcosystemController.generatePracticeTest);
router.get('/tests', authMiddleware, publicEcosystemController.getSavedTests);
router.get('/tests/:id', authMiddleware, publicEcosystemController.getTestById);
router.post('/tests/:id/attempt', authMiddleware, publicEcosystemController.submitTestAttempt);
router.get('/tests/:id/attempts', authMiddleware, publicEcosystemController.getTestAttempts);

// ─────────────────────────────────────────────────────────────────────────────
// 11. MY HUB PERSONAL WORKSPACE AGGREGATOR
// ─────────────────────────────────────────────────────────────────────────────
router.get('/hub-overview', authMiddleware, publicEcosystemController.getMyHubOverview);

module.exports = router;
