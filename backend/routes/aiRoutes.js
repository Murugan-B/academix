const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const aiQuotaController = require('../controllers/aiQuotaController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Standard AI Operations
router.post('/summarize', authMiddleware, aiController.generateSummary);
router.get('/summaries/:materialId', authMiddleware, aiController.getSummaries);
router.post('/chat', authMiddleware, aiController.askQuestion);
router.get('/chat/:materialId', authMiddleware, aiController.getChatHistory);
router.get('/health', authMiddleware, aiController.getHealth);

// AI Quota & Usage Ledger Endpoints (Section 21)
// 1. Admin Quota Dashboard
router.get('/quota/dashboard', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'INSTITUTE_ADMIN']), aiQuotaController.getQuotaDashboard);

// 2. Personal User Quota & Usage
router.get('/quota/my-usage', authMiddleware, aiQuotaController.getUserUsage);

// 3. Admin Paginated Usage Ledger
router.get('/quota/ledger', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'INSTITUTE_ADMIN']), aiQuotaController.getUsageLedger);

// 4. Admin Update Quota Limits
router.put('/quota/configs/:featureCategory', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'INSTITUTE_ADMIN']), aiQuotaController.updateQuotaConfig);

// 5. AI Model Routing & Key Slots Diagnostic (Safe for all authenticated users)
router.get('/quota/routing-config', authMiddleware, aiQuotaController.getRoutingConfig);

// 6. Trigger Live AI Routing Health Check (Admin & Faculty)
router.post('/quota/health-check', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'HOD', 'FACULTY']), aiQuotaController.testRoutingHealth);

// 7. Public & Authenticated Available Models
router.get('/models', (req, res) => {
  const routerService = require('../services/ai/routerService');
  res.json({ success: true, models: routerService.getAvailableModels() });
});

module.exports = router;
