require('dotenv').config();
const conversationalService = require('./services/ai/conversationalService');
const axios = require('axios');

async function runQuotaFallbackTests() {
  console.log('=====================================================');
  console.log('🧪 ACADEMIX AI: GEMINI QUOTA & OPENROUTER FALLBACK TESTS');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Check OPENROUTER_API_KEY is loaded without exposing it
  console.log('--- Step 1: Environment & API Key Validation ---');
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const isKeyLoaded = Boolean(openrouterKey && openrouterKey.trim().length > 10);
  assert(isKeyLoaded, 'OPENROUTER_API_KEY is loaded in process.env (length > 10, value protected)');

  const geminiKey = process.env.GEMINI_API_KEY;
  const isGeminiLoaded = Boolean(geminiKey && geminiKey.trim().length > 10);
  assert(isGeminiLoaded, 'GEMINI_API_KEY is loaded in process.env (length > 10, value protected)');

  // 2. Test Real Live OpenRouter Request
  console.log('\n--- Step 2: Live OpenRouter Provider & Model Verification ---');
  let liveOpenRouterSuccess = false;
  let liveAnswerSnippet = '';
  try {
    const rawResult = await conversationalService._callOpenRouter(
      'You are Academix AI. Reply concisely in one short sentence explaining recursion in computer science.',
      [{ role: 'user', content: 'What is recursion?' }]
    );
    if (typeof rawResult === 'string' && rawResult.trim().length > 10) {
      liveOpenRouterSuccess = true;
      liveAnswerSnippet = rawResult.trim().slice(0, 100);
    }
  } catch (err) {
    console.error('OpenRouter call error:', err.message);
  }
  assert(liveOpenRouterSuccess, `Real OpenRouter request succeeded with valid text: "${liveAnswerSnippet}..."`);

  // 3. Test Gemini Quota Failure & Automatic Failover to OpenRouter
  console.log('\n--- Step 3: Simulated Gemini 429 / RESOURCE_EXHAUSTED Failover ---');
  // Store original _callGemini
  const originalCallGemini = conversationalService._callGemini;
  
  // Mock Gemini to throw 429 RESOURCE_EXHAUSTED error
  conversationalService.geminiQuotaExhaustedUntil = 0;
  conversationalService._callGemini = async () => {
    conversationalService.geminiQuotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
    const err = new Error('429 Resource has been exhausted (e.g. check quota). [RESOURCE_EXHAUSTED]');
    err.status = 429;
    throw err;
  };

  try {
    const fallbackResponse = await conversationalService.processConversationalQuery({
      query: 'What are Binary Search Trees and their time complexity?',
      provider: 'gemini',
      includeWebSearch: false
    });

    assert(fallbackResponse && fallbackResponse.answer && fallbackResponse.answer.length > 20, 'Response received upon Gemini quota exhaustion');
    assert(fallbackResponse.providerUsed === 'openrouter', `Provider failover correctly set providerUsed to "openrouter" (got: ${fallbackResponse.providerUsed})`);
    assert(conversationalService.geminiQuotaExhaustedUntil > Date.now(), 'Gemini quota cooldown was activated (cooldown > current time)');
  } catch (err) {
    assert(false, `Unexpected error during Gemini quota failover: ${err.message}`);
  }

  // 4. Test Cooldown Skip (Immediate routing to OpenRouter when cooldown active)
  console.log('\n--- Step 4: Cooldown Routing Check ---');
  let geminiCallAttempted = false;
  conversationalService._callGemini = async () => {
    geminiCallAttempted = true;
    throw new Error('Gemini should NOT have been called during cooldown!');
  };

  try {
    const cooldownResponse = await conversationalService.processConversationalQuery({
      query: 'Explain merge sort',
      provider: 'gemini',
      includeWebSearch: false
    });

    assert(!geminiCallAttempted, 'Gemini was skipped directly due to active cooldown');
    assert(cooldownResponse.providerUsed === 'openrouter', 'Query processed directly via OpenRouter during cooldown');
  } catch (err) {
    assert(false, `Unexpected error during cooldown query: ${err.message}`);
  }

  // 5. Test Dual-Provider Failure Graceful Recovery
  console.log('\n--- Step 5: Dual Provider Failure Handling ---');
  conversationalService.geminiQuotaExhaustedUntil = 0;
  const originalCallOpenRouter = conversationalService._callOpenRouter;

  conversationalService._callGemini = async () => {
    throw new Error('Simulated total Gemini failure');
  };
  conversationalService._callOpenRouter = async () => {
    throw new Error('Simulated total OpenRouter failure');
  };

  try {
    const dualFailResponse = await conversationalService.processConversationalQuery({
      query: 'Explain graph theory',
      provider: 'gemini',
      includeWebSearch: false
    });

    assert(dualFailResponse && dualFailResponse.providerUsed === 'fallback-notice', 'Dual failure returned fallback-notice instead of throwing');
    assert(dualFailResponse.answer && dualFailResponse.answer.includes('AI services are currently experiencing temporary high volume'), 'User-friendly notice message returned');
  } catch (err) {
    assert(false, `Server crashed or threw unhandled exception on dual failure: ${err.message}`);
  }

  // Restore original methods
  conversationalService._callGemini = originalCallGemini;
  conversationalService._callOpenRouter = originalCallOpenRouter;
  conversationalService.geminiQuotaExhaustedUntil = 0;

  console.log('\n=====================================================');
  console.log(`📊 SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runQuotaFallbackTests().catch(err => {
  console.error('Test runner encountered fatal error:', err);
  process.exit(1);
});
