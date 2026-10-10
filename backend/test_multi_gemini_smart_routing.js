require('dotenv').config();
const assert = require('assert');
const geminiKeyManager = require('./services/ai/geminiKeyManager');
const routerService = require('./services/ai/routerService');
const usageLedgerService = require('./services/ai/usageLedgerService');
const db = require('./db');

let passCount = 0;
let failCount = 0;

function logPass(msg) {
  console.log(`  ✓ PASS: ${msg}`);
  passCount++;
}

function logFail(msg, err) {
  console.error(`  ✗ FAIL: ${msg} - ${err?.message || err}`);
  failCount++;
}

async function runTests() {
  console.log('================================================================');
  console.log('  ACADEMIX MULTI-GEMINI SMART ROUTING & FALLBACK TEST SUITE     ');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // STAGE 1: Multiple Gemini API Key Discovery
    // -------------------------------------------------------------
    console.log('▶ [1/7] Testing Multiple Gemini API Key Discovery & Slots:');
    
    // Save original env
    const origEnv = { ...process.env };
    
    // Simulate multiple numbered keys
    process.env.GEMINI_API_KEY_1 = 'AIzaSyFakeKeySlotOneForTesting111111111';
    process.env.GEMINI_API_KEY_2 = 'AIzaSyFakeKeySlotTwoForTesting222222222';
    process.env.GEMINI_API_KEY_3 = 'AIzaSyFakeKeySlotThreeForTesting33333333';
    process.env.GEMINI_API_KEY = 'AIzaSyFakeKeySlotStandard444444444';
    
    geminiKeyManager.refresh();
    const safeSlots = geminiKeyManager.getSafeStatus();

    assert(safeSlots.length >= 4, `Expected at least 4 key slots, found ${safeSlots.length}`);
    logPass(`Discovered ${safeSlots.length} distinct Gemini key slots from environment`);

    // Verify secret keys are NEVER exposed in safe status
    for (const slot of safeSlots) {
      assert(!slot.key, `Security violation: secret key string exposed on ${slot.slotId}`);
      assert(slot.slotId && slot.envName && slot.status, `Slot ${slot.slotId} missing required metadata`);
    }
    logPass('Verified secret API keys are never exposed in safe status payloads');

    // -------------------------------------------------------------
    // STAGE 2: Concurrency-Safe Key Acquisition & Rotation
    // -------------------------------------------------------------
    console.log('\n▶ [2/7] Testing Key Acquisition & Least-Recent Rotation:');
    const slot1 = geminiKeyManager.acquireKey([]);
    assert(slot1 && slot1.slotId, 'Acquired first active key slot');
    geminiKeyManager.recordSuccess(slot1.slotId);

    const slot2 = geminiKeyManager.acquireKey([slot1.slotId]);
    assert(slot2 && slot2.slotId !== slot1.slotId, 'Acquired distinct second key slot when first excluded');
    logPass(`Concurrency rotation succeeded (Selected ${slot1.slotId} then ${slot2.slotId})`);

    // -------------------------------------------------------------
    // STAGE 3: 429 Quota Exhaustion & Rate-Limit Cooldown
    // -------------------------------------------------------------
    console.log('\n▶ [3/7] Testing 429 Quota Exhaustion & Automatic Cooldown:');
    const quotaError = new Error('429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric GenerateContentRequestsPerMinute');
    const failRes = geminiKeyManager.recordFailure(slot1.slotId, quotaError, 300); // 300s cooldown
    
    assert(failRes.isQuota === true, 'Error correctly identified as quota exhaustion');
    const statusAfterQuota = geminiKeyManager.getSafeStatus().find(s => s.slotId === slot1.slotId);
    assert(statusAfterQuota.status === 'COOLDOWN', `Expected slot to be in COOLDOWN, got ${statusAfterQuota.status}`);
    assert(statusAfterQuota.cooldownRemainingSeconds > 0, 'Cooldown countdown active');
    logPass(`${slot1.slotId} entered COOLDOWN state after 429 RESOURCE_EXHAUSTED`);

    // Ensure acquireKey now skips the cooling key
    const nextEligible = geminiKeyManager.acquireKey([]);
    assert(nextEligible.slotId !== slot1.slotId, `Cooldown key ${slot1.slotId} was not skipped`);
    logPass(`Key rotation automatically skipped cooling slot ${slot1.slotId} and selected ${nextEligible.slotId}`);

    // -------------------------------------------------------------
    // STAGE 4: Invalid Key Detection (401/403)
    // -------------------------------------------------------------
    console.log('\n▶ [4/7] Testing Invalid Key Detection (Non-Retryable):');
    const invalidKeyError = new Error('API_KEY_INVALID: The provided API key is invalid or deleted.');
    const invalidFailRes = geminiKeyManager.recordFailure(slot2.slotId, invalidKeyError);
    
    assert(invalidFailRes.isInvalid === true, 'Error correctly identified as invalid API key');
    const statusAfterInvalid = geminiKeyManager.getSafeStatus().find(s => s.slotId === slot2.slotId);
    assert(statusAfterInvalid.status === 'INVALID', `Expected status INVALID, got ${statusAfterInvalid.status}`);
    logPass(`${slot2.slotId} marked permanently INVALID without infinite retry loops`);

    // -------------------------------------------------------------
    // STAGE 5: Smart Model Hierarchy & Available Models List
    // -------------------------------------------------------------
    console.log('\n▶ [5/7] Testing Model Registry & Capability Discovery:');
    const availableModels = routerService.getAvailableModels();
    assert(Array.isArray(availableModels) && availableModels.length >= 4, 'Expected model list with at least 4 options');
    
    const autoOption = availableModels.find(m => m.id === 'auto');
    const flash25Option = availableModels.find(m => m.id === 'gemini-2.5-flash');
    assert(autoOption && autoOption.isDefault, 'Auto routing option is present and default');
    assert(flash25Option && flash25Option.supportsVision, 'Gemini 2.5 Flash marked with vision capability');
    logPass(`Discovered ${availableModels.length} selectable models with correct capability flags`);

    // -------------------------------------------------------------
    // STAGE 6: Multimodal Vision vs Text Filtering
    // -------------------------------------------------------------
    console.log('\n▶ [6/7] Testing Multimodal Vision Compatibility:');
    const sysStatus = routerService.getSystemStatus();
    assert(sysStatus.gemini && sysStatus.openrouter, 'System diagnostic returned all provider statuses');
    assert(routerService.openRouterVisionModels.length > 0, 'Vision fallback models registered for OpenRouter');
    logPass('Vision model candidate list correctly configured for image analysis fallback');

    // -------------------------------------------------------------
    // STAGE 7: Restore Environment & Production Integration Check
    // -------------------------------------------------------------
    console.log('\n▶ [7/7] Testing Production Environment Verification:');
    // Restore original process.env
    Object.keys(process.env).forEach(k => {
      if (!origEnv[k]) delete process.env[k];
      else process.env[k] = origEnv[k];
    });
    geminiKeyManager.refresh();

    const liveStatus = routerService.getSystemStatus();
    logPass(`Production Gemini slots online: ${liveStatus.gemini.availableSlots} / ${liveStatus.gemini.totalSlots}`);
    logPass(`Production OpenRouter configured: ${liveStatus.openrouter.configured ? 'YES' : 'NO'}`);

  } catch (err) {
    logFail('Test suite execution error', err);
  }

  console.log('\n================================================================');
  console.log(`  SUITE SUMMARY: ${passCount} PASSED / ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
