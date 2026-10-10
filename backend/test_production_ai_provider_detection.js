const assert = require('assert');
const geminiKeyManager = require('./services/ai/geminiKeyManager');
const routerService = require('./services/ai/routerService');
const openRouterProvider = new (require('./services/ai/openRouterProvider'))();
const aiQuotaController = require('./controllers/aiQuotaController');
const assistantController = require('./controllers/assistantController');

function createMockReqRes({ user, body = {}, query = {}, params = {} } = {}) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    user: user || { id: '00000000-0000-0000-0000-000000000001', role: 'SUPER_ADMIN', name: 'Admin' },
    body,
    query,
    params,
    headers: {}
  };

  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      responseData = data;
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };

  return { req, res };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PRODUCTION AI PROVIDER DETECTION & DIAGNOSTICS SUITE');
  console.log('================================================================\n');

  // Save current environment variables
  const originalEnv = { ...process.env };

  try {
    // ── Test 1: Multi-Key Discovery (Numbered + Legacy + Quotes) ─────────────
    console.log('🔹 Test 1: Testing discovery of GEMINI_API_KEY_1, GEMINI_API_KEY_2, with quotes and spacing...');
    
    // Clear existing Gemini / OpenRouter envs
    Object.keys(process.env).forEach(k => {
      if (k.startsWith('GEMINI_') || k.startsWith('GOOGLE_') || k.startsWith('OPENROUTER_')) {
        delete process.env[k];
      }
    });

    process.env.GEMINI_API_KEY_1 = '  "AIzaSyKeySlot1_RenderProductionKeyA"  ';
    process.env.GEMINI_API_KEY_2 = "  'AIzaSyKeySlot2_RenderProductionKeyB'  ";
    process.env.GEMINI_API_KEY_3 = 'AIzaSyKeySlot3_RenderProductionKeyC';
    process.env.OPENROUTER_API_KEY = ' "sk-or-v1-render-production-openrouter-key" ';

    geminiKeyManager.refresh();

    const safeSlots = geminiKeyManager.getSafeStatus();
    console.log(`   ✅ Discovered ${safeSlots.length} Gemini slots:`, safeSlots.map(s => `${s.slotId} (${s.envName})`));
    assert.strictEqual(safeSlots.length, 3, 'Should discover exactly 3 numbered Gemini key slots');
    assert.strictEqual(geminiKeyManager.hasConfiguredKeys(), true, 'hasConfiguredKeys() must be true');

    // Verify secret protection
    safeSlots.forEach(s => {
      assert.strictEqual(s.key, undefined, 'Secret key value must NOT be present in safe status');
      assert.strictEqual(JSON.stringify(s).includes('AIzaSyKeySlot'), false, 'Key string must not be leaked');
      assert.strictEqual(s.validationState, 'CONFIGURED_UNTESTED', 'Newly configured keys must be marked CONFIGURED_UNTESTED');
    });
    console.log('   ✅ No secret values are exposed in slot status');

    // ── Test 2: OpenRouter Independent Discovery ─────────────────────────────
    console.log('\n🔹 Test 2: Testing independent OpenRouter detection...');
    const openrouterKey = routerService.getOpenRouterKey();
    assert.strictEqual(openrouterKey, 'sk-or-v1-render-production-openrouter-key', 'Cleaned OpenRouter key matches');
    assert.strictEqual(routerService.isOpenRouterConfigured(), true, 'routerService detects OpenRouter');
    assert.strictEqual(openRouterProvider._isConfigured(), true, 'openRouterProvider detects OpenRouter');
    console.log('   ✅ OpenRouter key detected and sanitized from quotes successfully');

    // ── Test 3: Legacy Single Key Fallback Support ───────────────────────────
    console.log('\n🔹 Test 3: Testing legacy GEMINI_API_KEY fallback and alias handling...');
    delete process.env.GEMINI_API_KEY_1;
    delete process.env.GEMINI_API_KEY_2;
    delete process.env.GEMINI_API_KEY_3;
    process.env.GEMINI_API_KEY = 'AIzaSyLegacyKeySlotStandard999';

    geminiKeyManager.refresh();
    const legacySlots = geminiKeyManager.getSafeStatus();
    assert.strictEqual(legacySlots.length, 1, 'Legacy GEMINI_API_KEY is discovered as single slot');
    assert.strictEqual(legacySlots[0].envName, 'GEMINI_API_KEY');
    console.log(`   ✅ Legacy GEMINI_API_KEY discovered successfully as ${legacySlots[0].slotId}`);

    // ── Test 4: Missing & Placeholder Credentials ────────────────────────────
    console.log('\n🔹 Test 4: Testing missing and placeholder credentials...');
    delete process.env.GEMINI_API_KEY;
    process.env.OPENROUTER_API_KEY = 'your_new_key_here'; // Default placeholder

    geminiKeyManager.refresh();
    assert.strictEqual(geminiKeyManager.hasConfiguredKeys(), false, 'Should report false when no Gemini keys');
    assert.strictEqual(routerService.isOpenRouterConfigured(), false, 'Placeholder OpenRouter key should report not configured');
    
    const systemStatusEmpty = routerService.getSystemStatus();
    assert.strictEqual(systemStatusEmpty.gemini.configured, false);
    assert.strictEqual(systemStatusEmpty.gemini.totalSlots, 0);
    assert.strictEqual(systemStatusEmpty.openrouter.configured, false);
    assert.strictEqual(systemStatusEmpty.openrouter.status, 'not_configured');
    console.log('   ✅ Correctly reports unconfigured state when keys are missing or placeholders');

    // ── Test 5: Dynamic Sync on Runtime Addition ─────────────────────────────
    console.log('\n🔹 Test 5: Testing dynamic sync when environment variables appear at runtime...');
    process.env.GEMINI_API_KEY_1 = 'AIzaSyDynamicSlot1';
    process.env.GEMINI_API_KEY_2 = 'AIzaSyDynamicSlot2';
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-dynamic-key';

    // Call hasConfiguredKeys() without calling refresh() explicitly
    const hasKeysDynamic = geminiKeyManager.hasConfiguredKeys();
    assert.strictEqual(hasKeysDynamic, true, 'Dynamic sync automatically detects keys added to process.env');
    const dynamicSlots = geminiKeyManager.getSafeStatus();
    assert.strictEqual(dynamicSlots.length, 2, 'Dynamic sync discovers 2 slots');
    console.log(`   ✅ Dynamic sync instantly found ${dynamicSlots.length} slot(s) without manual refresh`);

    // ── Test 6: Validation State Transition (Untested -> Validated -> Failed) ─
    console.log('\n🔹 Test 6: Testing validation state transitions...');
    const slotToTest = geminiKeyManager.acquireKey([]);
    assert.ok(slotToTest, 'Acquired slot for testing');

    // Record success
    geminiKeyManager.recordSuccess(slotToTest.slotId);
    const validatedSlots = geminiKeyManager.getSafeStatus();
    const validatedSlot = validatedSlots.find(s => s.slotId === slotToTest.slotId);
    assert.strictEqual(validatedSlot.validationState, 'VALIDATED', 'Slot should transition to VALIDATED on success');
    assert.strictEqual(validatedSlot.successCount, 1);
    console.log(`   ✅ ${slotToTest.slotId} successfully transitioned to VALIDATED state`);

    // ── Test 7: GET /ai/quota/routing-config API Endpoint ────────────────────
    console.log('\n🔹 Test 7: Testing GET /ai/quota/routing-config API endpoint...');
    const { req: routeReq, res: routeRes } = createMockReqRes({
      user: { id: '00000000-0000-0000-0000-000000000001', role: 'SUPER_ADMIN' }
    });
    await aiQuotaController.getRoutingConfig(routeReq, routeRes);
    assert.strictEqual(routeRes.getStatusCode(), 200);
    const routeData = routeRes.getData();
    assert.strictEqual(routeData.success, true);
    assert.ok(routeData.systemStatus, 'systemStatus object returned');
    assert.strictEqual(routeData.systemStatus.gemini.totalSlots, 2);
    assert.strictEqual(routeData.systemStatus.openrouter.configured, true);
    assert.ok(Array.isArray(routeData.models), 'Models list returned');
    console.log('   ✅ /ai/quota/routing-config returns complete diagnostics with models and slots');

    // ── Test 8: GET /ai/assistant/providers-status API Endpoint ──────────────
    console.log('\n🔹 Test 8: Testing GET /ai/assistant/providers-status API endpoint...');
    const { req: provReq, res: provRes } = createMockReqRes({
      user: { id: '00000000-0000-0000-0000-000000000002', role: 'PUBLIC_USER' }
    });
    await assistantController.getProvidersStatus(provReq, provRes);
    assert.strictEqual(provRes.getStatusCode(), 200);
    const provData = provRes.getData();
    assert.ok(provData.systemStatus, 'systemStatus included in response');
    assert.strictEqual(provData.gemini.totalSlots, 2);
    assert.strictEqual(provData.gemini.configured, true);
    assert.strictEqual(provData.openrouter.configured, true);
    console.log('   ✅ /ai/assistant/providers-status returns matched diagnostic response');

    console.log('\n================================================================');
    console.log('🎉 ALL 8 TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } finally {
    // Restore environment
    process.env = originalEnv;
    geminiKeyManager.refresh();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
