const express = require('express');
const router = express.Router();
const multer = require('multer');
const assistantController = require('../controllers/assistantController');
const authMiddleware = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max limit
});

router.post('/conversations', authMiddleware, assistantController.createConversation);
router.get('/conversations', authMiddleware, assistantController.getConversations);
router.get('/conversations/:id', authMiddleware, assistantController.getConversationDetails);
router.delete('/conversations/:id', authMiddleware, assistantController.deleteConversation);
router.post('/conversations/:id/messages', authMiddleware, assistantController.sendMessage);
router.post('/conversations/:id/attachments', authMiddleware, upload.single('file'), assistantController.uploadAttachment);
router.get('/providers-status', authMiddleware, assistantController.getProvidersStatus);

module.exports = router;
