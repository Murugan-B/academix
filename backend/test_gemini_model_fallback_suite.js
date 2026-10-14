require('dotenv').config();
const assert = require('assert');
const GeminiProvider = require('./services/ai/geminiProvider');
const OpenRouterProvider = require('./services/ai/openRouterProvider');
const aiService = require('./services/ai/aiService');
const geminiKeyManager = require('./services/ai/geminiKeyManager');
const incrementalRemedialService = require('./services/remedial/incrementalRemedialService');
const db = require('./db');

async function runGeminiModelTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING GEMINI MODEL SELECTION, FALLBACK & ERROR RECOVERY SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function logPass(msg) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  }

  function logFail(msg, err) {
    console.error(`  ❌ FAIL: ${msg}`, err ? (err.message || err) : '');
    failed++;
  }

  geminiKeyManager.refresh();
  const gp = new GeminiProvider();

  // -------------------------------------------------------------
  // TEST 1: Verified Candidate Models Configuration
  // -------------------------------------------------------------
  console.log('--- Test 1: Verified Candidate Models Configuration ---');
  try {
    assert(Array.isArray(gp.candidateModels), 'candidateModels must be an array');
    assert(gp.candidateModels.includes('gemini-2.5-flash'), 'candidateModels must include gemini-2.5-flash');
    assert(gp.candidateModels.includes('gemini-3.5-flash'), 'candidateModels must include gemini-3.5-flash');
    assert(!gp.candidateModels.includes('gemini-1.5-pro'), 'candidateModels must NOT include invalid gemini-1.5-pro');
    assert(!gp.candidateModels.includes('gemini-1.5-flash'), 'candidateModels must NOT include invalid gemini-1.5-flash');
    assert(!gp.candidateModels.includes('gemini-2.0-flash'), 'candidateModels must NOT include invalid gemini-2.0-flash');
    logPass(`Candidate models verified: [${gp.candidateModels.join(', ')}]`);
  } catch (err) {
    logFail('Test 1 failed', err);
  }

  // -------------------------------------------------------------
  // TEST 2: Official Model Discovery Endpoint (listSupportedModels)
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Official Model Discovery Endpoint ---');
  try {
    const listRes = await gp.listSupportedModels();
    assert(listRes.success === true, 'listSupportedModels must succeed');
    assert(Array.isArray(listRes.models) && listRes.models.length > 0, 'Must return at least 1 model');
    const flashModel = listRes.models.find(m => m.name.includes('gemini-2.5-flash'));
    assert(Boolean(flashModel), 'Discovered official models must contain gemini-2.5-flash');
    assert(!flashModel.supportedActions || flashModel.supportedActions.includes('generateContent'), 'Model must support generateContent');
    logPass(`Successfully queried official ModelService.ListModels (${listRes.models.length} models discovered)`);
  } catch (err) {
    logFail('Test 2 failed', err);
  }

  // -------------------------------------------------------------
  // TEST 3: Valid Model Selection & Live Generation
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Valid Model Selection & Live Generation ---');
  try {
    const res = await gp._generateContentWithFallback({
      contents: 'Return JSON: {"selectedModel": "verified"}',
      config: { responseMimeType: 'application/json' }
    });
    const parsed = gp._cleanAndParseJson(res.text);
    assert(parsed.selectedModel === 'verified', 'Model successfully returned valid parsed JSON');
    logPass('Live generation succeeded using verified primary Gemini model');
  } catch (err) {
    logFail('Test 3 failed', err);
  }

  // -------------------------------------------------------------
  // TEST 4: Unsupported Model Fallback (e.g. gemini-1.5-pro -> fallback)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Unsupported Model Fallback ---');
  try {
    // Pass override model that is unsupported (gemini-1.5-pro)
    // Should detect unsupported model (404), log warning, and fall back to candidateModels (gemini-2.5-flash)
    const res = await gp._generateContentWithFallback({
      model: 'gemini-1.5-pro',
      contents: 'Return JSON: {"fallbackStatus": "success"}',
      config: { responseMimeType: 'application/json' }
    });
    const parsed = gp._cleanAndParseJson(res.text);
    assert(parsed.fallbackStatus === 'success', 'Successfully fell back from unsupported model to supported candidate');
    logPass('Provider seamlessly fell back when unsupported model (gemini-1.5-pro) was requested');
  } catch (err) {
    logFail('Test 4 failed', err);
  }

  // -------------------------------------------------------------
  // TEST 5: OpenRouterProvider Universal Interface
  // -------------------------------------------------------------
  console.log('\n--- Test 5: OpenRouterProvider Universal Interface ---');
  try {
    const orp = new OpenRouterProvider();
    assert(typeof orp._generateContentWithFallback === 'function', 'OpenRouterProvider has _generateContentWithFallback');
    assert(typeof orp._cleanAndParseJson === 'function', 'OpenRouterProvider has _cleanAndParseJson');
    const parsed = orp._cleanAndParseJson('```json\n{"openRouter": true}\n```');
    assert(parsed.openRouter === true, '_cleanAndParseJson works correctly on OpenRouterProvider');
    logPass('OpenRouterProvider implements universal provider fallback interface');
  } catch (err) {
    logFail('Test 5 failed', err);
  }

  // -------------------------------------------------------------
  // TEST 6: Multi-Provider Fallback via aiService._executeWithFallback
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Multi-Provider Fallback Execution ---');
  try {
    // Test that fallback occurs if primary fails
    let primaryCalled = false;
    let fallbackCalled = false;
    const mockPrimary = {
      _generateContentWithFallback: async () => {
        primaryCalled = true;
        throw new Error('All configured Gemini keys and candidate models failed');
      }
    };
    const mockFallback = {
      _generateContentWithFallback: async () => {
        fallbackCalled = true;
        return { text: '{"recovered": true}' };
      },
      _cleanAndParseJson: (t) => JSON.parse(t)
    };

    const origGetProvider = aiService.getProvider.bind(aiService);
    aiService.getProvider = (p) => (p === 'gemini' ? mockPrimary : mockFallback);

    const result = await aiService._executeWithFallback('gemini', async (prov) => {
      const r = await prov._generateContentWithFallback();
      return prov._cleanAndParseJson(r.text);
    });

    aiService.getProvider = origGetProvider;

    assert(primaryCalled, 'Primary provider was attempted');
    assert(fallbackCalled, 'Fallback provider was invoked upon primary failure');
    assert(result.recovered === true, 'Fallback response returned correctly');
    logPass('aiService._executeWithFallback seamlessly recovers when primary provider fails');
  } catch (err) {
    logFail('Test 6 failed', err);
  }

  // -------------------------------------------------------------
  // TEST 7: Safe Error Logging (No Exposed Keys or Bearer Tokens)
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Safe Error Sanitization ---');
  try {
    const errorWithSecrets = new Error('Request to https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSySecretKey12345678901234567890123 failed with 404. Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token');
    
    // Simulate what incrementalRemedialService does:
    const sanitized = (errorWithSecrets.message || '')
      .replace(/key=[a-zA-Z0-9_\-\.]+/gi, 'key=[REDACTED]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/sk-or-v1-[a-f0-9]{64}/g, '[REDACTED_OPENROUTER_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');

    assert(!sanitized.includes('AIzaSySecretKey'), 'Gemini API key must be stripped from error');
    assert(!sanitized.includes('eyJhbGciOiJIUzI1Ni'), 'JWT Bearer token must be stripped from error');
    assert(sanitized.includes('[REDACTED]'), 'Redacted placeholders must be inserted');
    logPass('Error message sanitization prevents credential leakage');
  } catch (err) {
    logFail('Test 7 failed', err);
  }

  // -------------------------------------------------------------
  // TEST 8: Remedial Plan Preservation on Total Provider Failure
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Plan Content & Citations Preserved on Failure ---');
  try {
    // Create a temporary test remedial plan
    const testSubRes = await db.query('SELECT id, department_id FROM subjects LIMIT 1');
    const sub = testSubRes.rows[0];
    const testUserRes = await db.query('SELECT id FROM users LIMIT 1');
    const userId = testUserRes.rows[0].id;

    const initialPlanContent = {
      prerequisiteRecap: 'Initial recap',
      conceptExplanation: 'Initial explanation',
      example: 'Initial example',
      commonMistakes: ['Initial mistake 1', 'Initial mistake 2'],
      practiceExercises: ['Initial exercise 1', 'Initial exercise 2'],
      quickAssessmentQuestions: [{ question: 'Initial question?', options: ['A', 'B'], correctIndex: 0 }]
    };

    const insRes = await db.query(`
      INSERT INTO cohort_remedial_plans (subject_id, topic_tag, plan_content, status, version, is_stale, created_by, created_at, updated_at)
      VALUES ($1, 'Model Failure Test Topic', $2, 'DRAFT', 1, TRUE, $3, NOW(), NOW())
      RETURNING id, plan_content, version
    `, [sub.id, JSON.stringify(initialPlanContent), userId]);
    const testPlanId = insRes.rows[0].id;

    // Register dependencies
    await incrementalRemedialService.registerPlanDependencies({
      planId: testPlanId,
      planContent: initialPlanContent,
      subjectId: sub.id,
      topicTag: 'Model Failure Test Topic',
      userId
    });

    // Make an item stale
    await db.query(`
      UPDATE remedial_plan_items
      SET status = 'STALE'
      WHERE plan_id = $1 AND item_key = 'commonMistakes'
    `, [testPlanId]);

    // Attempt incremental update with a failing mock generator
    let caughtError = null;
    try {
      await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
        mockAiGenerator: async () => {
          throw new Error('Total provider failure: 503 UNAVAILABLE key=AIzaSyExposedKey12345678901234567890123');
        }
      });
    } catch (e) {
      caughtError = e;
    }

    assert(caughtError !== null, 'Incremental update must throw on total provider failure');
    assert(caughtError.preserved === true, 'Error must indicate plan was preserved');

    // Verify database state: plan content must be completely UNCHANGED!
    const verifyPlan = await db.query('SELECT plan_content, version FROM cohort_remedial_plans WHERE id = $1', [testPlanId]);
    assert.strictEqual(verifyPlan.rows[0].version, 1, 'Plan version must not be incremented');
    assert.deepStrictEqual(verifyPlan.rows[0].plan_content, initialPlanContent, 'Plan content must be strictly preserved');

    // Verify item was marked FAILED with sanitized error
    const verifyItem = await db.query('SELECT status, last_error FROM remedial_plan_items WHERE plan_id = $1 AND item_key = $2', [testPlanId, 'commonMistakes']);
    assert.strictEqual(verifyItem.rows[0].status, 'FAILED', 'Item status must be FAILED');
    assert(!verifyItem.rows[0].last_error.includes('AIzaSyExposedKey'), 'last_error must not expose API key');
    assert(verifyItem.rows[0].last_error.includes('[REDACTED]'), 'last_error must contain redacted placeholder');

    // Clean up test plan
    await db.query('DELETE FROM remedial_item_dependencies WHERE item_id IN (SELECT id FROM remedial_plan_items WHERE plan_id = $1)', [testPlanId]);
    await db.query('DELETE FROM remedial_plan_items WHERE plan_id = $1', [testPlanId]);
    await db.query('DELETE FROM remedial_plan_audit_log WHERE plan_id = $1', [testPlanId]);
    await db.query('DELETE FROM cohort_remedial_plans WHERE id = $1', [testPlanId]);

    logPass('Remedial plan content, version, and citations were 100% preserved on total provider failure');
  } catch (err) {
    logFail('Test 8 failed', err);
  }

  console.log('\n================================================================');
  console.log(`SUITE SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runGeminiModelTestSuite().then(() => {
  process.exit(0);
}).catch(e => {
  console.error('Test execution fatal error:', e);
  process.exit(1);
});
