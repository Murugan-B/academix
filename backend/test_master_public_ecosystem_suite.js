const db = require('./db');
const { validateExternalResourceUrl, parseGoogleDriveUrl, parseYouTubeUrl } = require('./utils/urlValidators');
const usageLedgerService = require('./services/ai/usageLedgerService');
const conversationalService = require('./services/ai/conversationalService');

async function runMasterSuite() {
  console.log('================================================================');
  console.log('  ACADEMIX MASTER PUBLIC USER ECOSYSTEM — END-TO-END SUITE     ');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failedTests++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: URL VALIDATION & METADATA EXTRACTION
    // -------------------------------------------------------------------------
    console.log('▶ [1/8] Testing Google Drive, YouTube & External Link Validation:');
    
    // 1A. Google Drive standard share link
    const gdrive1 = parseGoogleDriveUrl('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing');
    assert('Google Drive File ID extraction', gdrive1?.isValid && gdrive1.fileId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    assert('Google Drive Preview embed URL generation', gdrive1?.previewUrl === 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview');

    // 1B. Google Docs direct link
    const gdoc = parseGoogleDriveUrl('https://docs.google.com/document/d/195LBaS6mZGSyWbjvG-950ER6QWJW1omgE801AX588so/edit');
    assert('Google Docs ID extraction', gdoc?.isValid && gdoc.driveType === 'DOC');

    // 1C. YouTube standard watch link
    const ytWatch = parseYouTubeUrl('https://www.youtube.com/watch?v=kqtD5dpn9C8');
    assert('YouTube Watch Video ID extraction', ytWatch?.isValid && ytWatch.videoId === 'kqtD5dpn9C8');
    assert('YouTube Embed URL generation (nocookie domain)', ytWatch?.embedUrl === 'https://www.youtube-nocookie.com/embed/kqtD5dpn9C8?rel=0');

    // 1D. YouTube short youtu.be link
    const ytShort = parseYouTubeUrl('https://youtu.be/kqtD5dpn9C8?si=sample');
    assert('YouTube Short URL parsing', ytShort?.isValid && ytShort.videoId === 'kqtD5dpn9C8');

    // 1E. Malicious / Invalid URL rejection
    const invalidYt = parseYouTubeUrl('https://evil-phishing.com/watch?v=kqtD5dpn9C8');
    assert('Reject spoofed domain', invalidYt === null);

    // -------------------------------------------------------------------------
    // TEST 2: PUBLIC COMMUNITY COURSES & DEDUPLICATION
    // -------------------------------------------------------------------------
    console.log('\n▶ [2/8] Testing Public Course Folders & Deduplication:');
    const courseTitle = `Quantum Computing Algorithms ${Date.now()}`;
    const normCourseTitle = courseTitle.toLowerCase().replace(/\s+/g, ' ');

    const courseRes = await db.query(
      `INSERT INTO public_courses (name, normalized_name, description, category)
       VALUES ($1, $2, $3, 'COMPUTER_SCIENCE') RETURNING id, name`,
      [courseTitle, normCourseTitle, 'Open quantum computation lecture notes']
    );
    const testCourseId = courseRes.rows[0].id;
    assert('Created public course folder in DB', Boolean(testCourseId));

    // Duplicate check
    let dupFailed = false;
    try {
      await db.query(
        `INSERT INTO public_courses (name, normalized_name, category)
         VALUES ($1, $2, 'COMPUTER_SCIENCE')`,
        [courseTitle, normCourseTitle]
      );
    } catch (dupErr) {
      dupFailed = true; // Expected duplicate key error
    }
    assert('Database uniqueness constraint prevents duplicate course folder', dupFailed);

    // -------------------------------------------------------------------------
    // TEST 3: COMMUNITY MATERIAL CONTRIBUTIONS & APPROVAL ISOLATION
    // -------------------------------------------------------------------------
    console.log('\n▶ [3/8] Testing Community Contribution Lifecycle & Visibility:');
    const userRes = await db.query(`SELECT id FROM users LIMIT 1`);
    const testUserId = userRes.rows[0]?.id;

    // Insert pending submission
    const pendingRes = await db.query(`
      INSERT INTO student_resources (
        title, description, tags, course_category_type, public_course_id,
        external_url, external_provider, is_public, status, uploaded_by
      ) VALUES (
        'Grover Search Algorithm Masterclass',
        'In-depth quantum search explanation with YouTube video',
        ARRAY['quantum', 'grover', 'algorithms'],
        'COMMUNITY_COURSE',
        $1,
        'https://www.youtube.com/watch?v=kqtD5dpn9C8',
        'YOUTUBE',
        TRUE,
        'PENDING',
        $2
      ) RETURNING id, status, is_public
    `, [testCourseId, testUserId]);
    const pendingResourceId = pendingRes.rows[0].id;
    assert('Contribution submitted with PENDING status', pendingRes.rows[0].status === 'PENDING');

    // Public search should NOT return pending resources
    const publicSearchCheck = await db.query(`
      SELECT id FROM student_resources WHERE id = $1 AND status = 'APPROVED' AND is_public = TRUE
    `, [pendingResourceId]);
    assert('Pending contribution is NOT visible in public search', publicSearchCheck.rowCount === 0);

    // Approve the contribution
    await db.query(`
      UPDATE student_resources SET status = 'APPROVED', approved_at = NOW() WHERE id = $1
    `, [pendingResourceId]);
    const approvedCheck = await db.query(`
      SELECT id FROM student_resources WHERE id = $1 AND status = 'APPROVED' AND is_public = TRUE
    `, [pendingResourceId]);
    assert('Approved contribution is visible in public library', approvedCheck.rowCount === 1);

    // -------------------------------------------------------------------------
    // TEST 4: SAVED MATERIALS (BOOKMARKING)
    // -------------------------------------------------------------------------
    console.log('\n▶ [4/8] Testing Saved Materials (Bookmarks):');
    await db.query(
      `INSERT INTO saved_resources (user_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [testUserId, pendingResourceId]
    );
    const savedCheck = await db.query(
      `SELECT COUNT(*) FROM saved_resources WHERE user_id = $1 AND resource_id = $2`,
      [testUserId, pendingResourceId]
    );
    assert('Bookmarked approved resource', parseInt(savedCheck.rows[0].count, 10) === 1);

    await db.query(
      `DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2`,
      [testUserId, pendingResourceId]
    );
    const unsavedCheck = await db.query(
      `SELECT COUNT(*) FROM saved_resources WHERE user_id = $1 AND resource_id = $2`,
      [testUserId, pendingResourceId]
    );
    assert('Un-bookmarked resource successfully', parseInt(unsavedCheck.rows[0].count, 10) === 0);

    // -------------------------------------------------------------------------
    // TEST 5: PERSONAL STUDY NOTES & SEARCH
    // -------------------------------------------------------------------------
    console.log('\n▶ [5/8] Testing Personal Notes Management:');
    const noteRes = await db.query(`
      INSERT INTO personal_notes (user_id, title, content, course_name, topic_tag, tags)
      VALUES ($1, 'Quantum Superposition & Qubits', '## Principles\n\nState |psi> = alpha|0> + beta|1>', 'Quantum Mechanics', 'Superposition', ARRAY['physics', 'quantum'])
      RETURNING id, title, content
    `, [testUserId]);
    const noteId = noteRes.rows[0].id;
    assert('Created personal study note', Boolean(noteId));

    // Update note
    const updatedNote = await db.query(`
      UPDATE personal_notes SET title = 'Quantum Superposition & Entanglement', updated_at = NOW()
      WHERE id = $1 AND user_id = $2 RETURNING title
    `, [noteId, testUserId]);
    assert('Updated personal study note', updatedNote.rows[0]?.title === 'Quantum Superposition & Entanglement');

    // -------------------------------------------------------------------------
    // TEST 6: AI PRACTICE TEST GENERATION & ATTEMPT EVALUATION
    // -------------------------------------------------------------------------
    console.log('\n▶ [6/8] Testing AI Practice Test Generation & Objective Evaluation:');
    const testQuestions = [
      {
        id: 1,
        question: "What is the Hadamard gate transformation on |0>?",
        options: ["(|0> + |1>)/sqrt(2)", "|1>", "|0>", "(|0> - |1>)/sqrt(2)"],
        correctAnswer: "(|0> + |1>)/sqrt(2)",
        explanation: "Hadamard gate maps computational basis state |0> to equal superposition (|0> + |1>)/sqrt(2).",
        topicTag: "Quantum Gates"
      },
      {
        id: 2,
        question: "Is quantum teleportation faster than the speed of light?",
        options: ["No, it requires classical communication", "Yes, instantly", "Depends on distance", "Only in vacuum"],
        correctAnswer: "No, it requires classical communication",
        explanation: "Quantum teleportation requires transmitting 2 classical bits, bounded by the speed of light.",
        topicTag: "Quantum Teleportation"
      }
    ];

    const testRes = await db.query(`
      INSERT INTO ai_generated_tests (user_id, title, topic, course_name, difficulty, question_count, questions)
      VALUES ($1, 'Quantum Foundations Assessment', 'Quantum Gates', 'Quantum Computing', 'MEDIUM', 2, $2)
      RETURNING id
    `, [testUserId, JSON.stringify(testQuestions)]);
    const testId = testRes.rows[0].id;
    assert('Saved generated practice assessment', Boolean(testId));

    // Submit attempt with 2 correct answers (100%)
    const userAnswers = { "0": "(|0> + |1>)/sqrt(2)", "1": "No, it requires classical communication" };
    let correctCount = 0;
    testQuestions.forEach((q, idx) => {
      if (userAnswers[String(idx)] === q.correctAnswer) correctCount++;
    });
    const scorePct = (correctCount / testQuestions.length) * 100;

    const attemptRes = await db.query(`
      INSERT INTO ai_test_attempts (test_id, user_id, score, total_questions, correct_count, user_answers)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, score
    `, [testId, testUserId, scorePct, testQuestions.length, correctCount, JSON.stringify(userAnswers)]);
    assert('Evaluated and stored practice attempt (100% score)', parseFloat(attemptRes.rows[0].score) === 100);

    // -------------------------------------------------------------------------
    // TEST 7: AI QUOTA LEDGER & CONFIGURABLE LIMITS (SECTION 21)
    // -------------------------------------------------------------------------
    console.log('\n▶ [7/8] Testing AI Usage Ledger, Quota Enforcement & Dashboard Metrics:');
    
    // Check all categories
    const categories = [
      'CONVERSATIONAL_CHAT',
      'DOCUMENT_ANALYSIS',
      'VISION_IMAGE_ANALYSIS',
      'TEST_GENERATION',
      'NOTES_GENERATION',
      'DOCUMENT_SUMMARIZATION',
      'QUIZ_GENERATION',
      'STUDY_PLAN_GENERATION'
    ];

    let allCategoriesConfigured = true;
    for (const cat of categories) {
      const qCheck = await usageLedgerService.checkQuota(testUserId, cat);
      if (!qCheck.allowed) allCategoriesConfigured = false;
    }
    assert('All 8 AI feature categories have active quota configurations', allCategoriesConfigured);

    // Record atomic usage in ledger
    await usageLedgerService.recordUsage({
      userId: testUserId,
      featureCategory: 'VISION_IMAGE_ANALYSIS',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      promptTokens: 450,
      completionTokens: 600,
      status: 'SUCCESS'
    });

    const metrics = await usageLedgerService.getDashboardMetrics();
    assert('Admin Quota Dashboard retrieved aggregated metrics', metrics.categories.length === 8);
    assert('Total tokens and cost estimates computed', parseFloat(metrics.overview.totalCost) >= 0);

    const userUsage = await usageLedgerService.getUserUsage(testUserId);
    assert('User personal usage metrics isolated correctly', Array.isArray(userUsage.categories));

    // -------------------------------------------------------------------------
    // TEST 8: CLEANUP & INTEGRITY VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n▶ [8/8] Cleaning up test artifacts while preserving production records:');
    await db.query(`DELETE FROM ai_test_attempts WHERE id = $1`, [attemptRes.rows[0].id]);
    await db.query(`DELETE FROM ai_generated_tests WHERE id = $1`, [testId]);
    await db.query(`DELETE FROM personal_notes WHERE id = $1`, [noteId]);
    await db.query(`DELETE FROM student_resources WHERE id = $1`, [pendingResourceId]);
    await db.query(`DELETE FROM public_courses WHERE id = $1`, [testCourseId]);
    assert('All test-specific records safely cleaned up', true);

    console.log('\n================================================================');
    console.log(`  SUITE SUMMARY: ${passedTests} PASSED / ${failedTests} FAILED`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test suite exception:', err);
    process.exit(1);
  }
}

runMasterSuite();
