const usageLedgerService = require('../services/ai/usageLedgerService');

/**
 * Get AI Quota Dashboard Analytics (Admin Only)
 */
exports.getQuotaDashboard = async (req, res) => {
  try {
    const data = await usageLedgerService.getDashboardMetrics();
    res.json(data);
  } catch (err) {
    console.error('Get quota dashboard error:', err);
    res.status(500).json({ message: 'Failed to retrieve AI quota dashboard.' });
  }
};

/**
 * Get Current User's AI Usage (For authenticated users)
 */
exports.getUserUsage = async (req, res) => {
  try {
    const userId = req.user?.id;
    const data = await usageLedgerService.getUserUsage(userId);
    res.json(data);
  } catch (err) {
    console.error('Get user AI usage error:', err);
    res.status(500).json({ message: 'Failed to retrieve user AI usage.' });
  }
};

/**
 * Get Paginated AI Usage Ledger Log (Admin Only)
 */
exports.getUsageLedger = async (req, res) => {
  try {
    const { page = 1, limit = 20, featureCategory, provider, status } = req.query;
    const data = await usageLedgerService.getUsageLedger({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      featureCategory,
      provider,
      status
    });
    res.json(data);
  } catch (err) {
    console.error('Get usage ledger error:', err);
    res.status(500).json({ message: 'Failed to retrieve AI usage ledger.' });
  }
};

/**
 * Update Feature Quota Config (Admin Only)
 */
exports.updateQuotaConfig = async (req, res) => {
  try {
    const { featureCategory } = req.params;
    const adminUserId = req.user?.id;
    const updated = await usageLedgerService.updateQuotaConfig(featureCategory, req.body, adminUserId);
    res.json({ success: true, message: 'Quota limit configuration updated.', config: updated });
  } catch (err) {
    console.error('Update quota config error:', err);
    res.status(500).json({ message: err.message || 'Failed to update quota configuration.' });
  }
};

/**
 * Get AI Model Routing & Key Slots Diagnostic (Admin Only)
 */
exports.getRoutingConfig = async (req, res) => {
  try {
    const routerService = require('../services/ai/routerService');
    const systemStatus = routerService.getSystemStatus();
    const models = routerService.getAvailableModels();

    res.json({
      success: true,
      systemStatus,
      models
    });
  } catch (err) {
    console.error('Get routing config error:', err);
    res.status(500).json({ message: 'Failed to retrieve AI routing configuration.' });
  }
};

/**
 * Trigger Live Safe AI Routing Health Check (Admin Only)
 */
exports.testRoutingHealth = async (req, res) => {
  const { model = 'auto' } = req.body;
  const start = Date.now();

  try {
    const routerService = require('../services/ai/routerService');
    const result = await routerService.generateContent({
      systemPrompt: 'You are an automated diagnostic health checker. Respond in exactly 3 words.',
      messages: [{ role: 'user', content: 'Health check ping.' }],
      preferredModel: model,
      temperature: 0.1
    });

    const duration = Date.now() - start;

    res.json({
      success: true,
      healthStatus: 'HEALTHY',
      durationMs: duration,
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      slotUsed: result.slotUsed,
      fallbackOccurred: result.fallbackOccurred,
      fallbackReason: result.fallbackReason,
      sampleResponse: result.text.substring(0, 100).trim()
    });
  } catch (err) {
    const duration = Date.now() - start;
    res.status(500).json({
      success: false,
      healthStatus: 'UNHEALTHY',
      durationMs: duration,
      error: err.message
    });
  }
};
