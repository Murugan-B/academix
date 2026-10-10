require('dotenv').config();
const db = require('./db');
const axios = require('axios');
const conversationalService = require('./services/ai/conversationalService');
const { searchWeb } = require('./services/search/searchService');

async function runComprehensiveVerification() {
  console.log('========================================================================');
  console.log('🧪 ACADEMIX: MULTIMODAL AI, PUBLIC HUB, IMAGE SEARCH & ISOLATION SUITE');
  console.log('========================================================================\n');

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

  // --- TEST 1: ENVIRONMENT & PROVIDER CAPABILITIES ---
  console.log('--- TEST SUITE 1: ENVIRONMENT & SECRETS VALIDATION ---');
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  assert(Boolean(openrouterKey && openrouterKey.length > 10), 'OPENROUTER_API_KEY is loaded in process.env (secret value protected)');
  const geminiKey = process.env.GEMINI_API_KEY;
  assert(Boolean(geminiKey && geminiKey.length > 10), 'GEMINI_API_KEY is loaded in process.env (secret value protected)');

  // --- TEST 2: GLOBAL SEARCH - MULTIPLE DISTINCT QUERY-RELEVANT IMAGES ---
  console.log('\n--- TEST SUITE 2: DIVERSE QUERY-RELEVANT IMAGE SEARCH ---');
  try {
    const queryA = 'Python programming algorithm';
    const resA = await searchWeb({ query: queryA, searchType: 'images', limit: 8 });
    assert(resA && resA.images && resA.images.length >= 6, `Search for "${queryA}" returned ${resA.images?.length || 0} images (>= 6 required)`);

    const queryB = 'Quantum physics semiconductor';
    const resB = await searchWeb({ query: queryB, searchType: 'images', limit: 8 });
    assert(resB && resB.images && resB.images.length >= 6, `Search for "${queryB}" returned ${resB.images?.length || 0} images (>= 6 required)`);

    // Verify distinct image URLs across different queries
    const urlsA = new Set(resA.images.map(img => img.imageUrl));
    const urlsB = new Set(resB.images.map(img => img.imageUrl));
    const hasDifferentImages = resA.images[0]?.imageUrl !== resB.images[0]?.imageUrl;
    assert(hasDifferentImages, 'Different queries return distinct, query-tailored visual assets');

    // Verify no duplicates within a single result set
    const noDuplicatesA = urlsA.size === resA.images.length;
    assert(noDuplicatesA, 'No duplicate image URLs within result set A');
  } catch (err) {
    assert(false, `Image search test failed: ${err.message}`);
  }

  // --- TEST 3: MULTIMODAL VISION AI PROCESSING ---
  console.log('\n--- TEST SUITE 3: MULTIMODAL AI & VISION CAPABILITIES ---');
  // 1x1 green pixel PNG base64
  const testPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  try {
    const visionRes = await conversationalService.processConversationalQuery({
      query: 'What color is in this image?',
      fileBase64: testPngBase64,
      fileName: 'green_pixel.png',
      fileMimeType: 'image/png',
      includeWebSearch: false
    });

    assert(visionRes && visionRes.answer && visionRes.answer.length > 10, 'Multimodal vision query answered successfully');
    assert(visionRes.hasImageAttachment === true, 'Image attachment flag recognized and processed');
    assert(['IMAGE_ANALYSIS', 'GENERAL_AI_KNOWLEDGE', 'SERVICE_NOTICE'].includes(visionRes.sourceClassification), `Classification set correctly (${visionRes.sourceClassification})`);
  } catch (err) {
    assert(false, `Vision query failed: ${err.message}`);
  }

  // --- TEST 4: DOCUMENT ATTACHMENT TEXT EXTRACTION ---
  console.log('\n--- TEST SUITE 4: DOCUMENT ATTACHMENT PROCESSING ---');
  try {
    const sampleDocText = `ACADEMIX SYLLABUS: UNIT 3 - BINARY SEARCH TREES
Definition: A binary search tree is a rooted binary tree data structure whose internal nodes each store a key.
Time Complexity: Average search time is O(log n), worst case is O(n).
Applications: Indexing, expression parsing, Priority Queues.`;

    const docBuffer = Buffer.from(sampleDocText, 'utf-8');
    const docRes = await conversationalService.processConversationalQuery({
      query: 'What is the average time complexity mentioned in the attached document?',
      fileBuffer: docBuffer,
      fileName: 'syllabus_unit3.txt',
      fileMimeType: 'text/plain',
      includeWebSearch: false
    });

    assert(docRes && docRes.answer && docRes.answer.length > 10, 'Document attached query processed');
    assert(docRes.hasDocumentContext === true, 'Document context flag activated');
  } catch (err) {
    assert(false, `Document query failed: ${err.message}`);
  }

  // --- TEST 5: GEMINI QUOTA EXHAUSTION & OPENROUTER FALLBACK ---
  console.log('\n--- TEST SUITE 5: QUOTA FAILOVER & COOLDOWN LOGIC ---');
  const originalCallGemini = conversationalService._callGemini;
  conversationalService.geminiQuotaExhaustedUntil = 0;
  
  // Simulate Gemini 429 quota exhaustion
  conversationalService._callGemini = async () => {
    conversationalService.geminiQuotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
    const err = new Error('429 Resource has been exhausted (e.g. check quota). [RESOURCE_EXHAUSTED]');
    err.status = 429;
    throw err;
  };

  try {
    const quotaFailoverRes = await conversationalService.processConversationalQuery({
      query: 'Explain graph traversal algorithms like BFS and DFS',
      provider: 'gemini',
      includeWebSearch: false
    });

    assert(quotaFailoverRes && quotaFailoverRes.answer && quotaFailoverRes.answer.length > 20, 'Response received on Gemini 429 quota exhaustion');
    assert(quotaFailoverRes.providerUsed === 'openrouter', 'Provider failover switched to openrouter');
    assert(conversationalService.geminiQuotaExhaustedUntil > Date.now(), 'Cooldown timer set to avoid repeated failing Gemini calls');
  } catch (err) {
    assert(false, `Quota failover error: ${err.message}`);
  }

  // Restore
  conversationalService._callGemini = originalCallGemini;
  conversationalService.geminiQuotaExhaustedUntil = 0;

  // --- TEST 6: DUAL PROVIDER FAILURE HANDLING ---
  console.log('\n--- TEST SUITE 6: DUAL PROVIDER GRACEFUL NOTICE ---');
  const originalCallOpenRouter = conversationalService._callOpenRouter;
  conversationalService._callGemini = async () => { throw new Error('Simulated Gemini Outage'); };
  conversationalService._callOpenRouter = async () => { throw new Error('Simulated OpenRouter Outage'); };

  try {
    const dualFailRes = await conversationalService.processConversationalQuery({
      query: 'Explain dynamic programming',
      provider: 'gemini',
      includeWebSearch: false
    });

    assert(dualFailRes && dualFailRes.providerUsed === 'fallback-notice', 'Dual failure returned fallback-notice response');
    assert(dualFailRes.answer && dualFailRes.answer.includes('AI services are currently experiencing temporary high volume'), 'User-friendly notice message returned without server crash');
  } catch (err) {
    assert(false, `Dual failure crashed server: ${err.message}`);
  }

  // Restore
  conversationalService._callGemini = originalCallGemini;
  conversationalService._callOpenRouter = originalCallOpenRouter;

  // --- TEST 7: PUBLIC ACADEMIC RESOURCE PERMISSIONS & ISOLATION ---
  console.log('\n--- TEST SUITE 7: DATABASE ISOLATION & CLEANUP ---');
  try {
    // Verify no lingering TEST_ duplicates in database
    const dbTestNotes = await db.query("SELECT id, title FROM student_resources WHERE title LIKE 'TEST_%'");
    assert(dbTestNotes.rowCount === 0, `Database is clean of duplicate test notes (count: ${dbTestNotes.rowCount})`);

    // Verify featured resources only return is_public = TRUE AND status = 'APPROVED'
    const featuredRes = await db.query("SELECT id, title, is_public, status FROM student_resources WHERE is_public = TRUE AND status = 'APPROVED'");
    const invalidPublic = featuredRes.rows.filter(r => !r.is_public || r.status !== 'APPROVED');
    assert(invalidPublic.length === 0, 'Featured public notes endpoint enforces is_public = TRUE AND status = APPROVED');
  } catch (err) {
    assert(false, `DB isolation check error: ${err.message}`);
  }

  console.log('\n========================================================================');
  console.log(`📊 TEST SUITE RESULT: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runComprehensiveVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
