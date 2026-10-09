const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Normal Search (Approved internal student resources + external Wikipedia/DDG references)
router.get('/search', publicController.normalSearch);

// AI Search (Gemini / OpenRouter with grounding & source distinction)
router.post('/ai-search', publicController.aiSearch);

// Featured public resources
router.get('/featured-resources', publicController.getFeaturedResources);

module.exports = router;
