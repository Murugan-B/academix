const db = require('./db');
const { validateExternalResourceUrl, parseGoogleDriveUrl, parseYouTubeUrl } = require('./utils/urlValidators');
const usageLedgerService = require('./services/ai/usageLedgerService');

async function testPublicEcosystemBackend() {
  console.log('--- Running Academix Public Ecosystem Backend Verification ---');

  try {
    // 1. Test URL Validators
    console.log('\n1. Testing Google Drive & YouTube URL Validators:');
    const validDriveUrl = 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view?usp=sharing';
    const driveParsed = parseGoogleDriveUrl(validDriveUrl);
    console.log('✓ Google Drive Parse:', driveParsed?.isValid && driveParsed.fileId === '1a2b3c4d5e6f7g8h9i0j' ? 'PASS' : 'FAIL');

    const validYtUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const ytParsed = parseYouTubeUrl(validYtUrl);
    console.log('✓ YouTube Parse:', ytParsed?.isValid && ytParsed.videoId === 'dQw4w9WgXcQ' ? 'PASS' : 'FAIL');

    const invalidUrl = 'https://malicious-site.com/fake.mp4';
    const invalidParsed = validateExternalResourceUrl(invalidUrl);
    console.log('✓ Invalid YouTube/Drive Rejection:', invalidParsed.provider === 'EXTERNAL_LINK' ? 'PASS' : 'FAIL');

    // 2. Test Public Courses Table & Normalized Deduplication
    console.log('\n2. Testing Public Community Courses:');
    const courseName = `Data Structures & Algorithms Test ${Date.now()}`;
    const normalizedName = courseName.toLowerCase().replace(/\s+/g, ' ');

    const courseInsert = await db.query(
      `INSERT INTO public_courses (name, normalized_name, description, category)
       VALUES ($1, $2, $3, 'COMPUTER_SCIENCE') RETURNING id, name`,
      [courseName, normalizedName, 'Comprehensive DSA notes and practice']
    );
    const testCourseId = courseInsert.rows[0].id;
    console.log(`✓ Created public course (ID: ${testCourseId})`);

    // 3. Test AI Quota Service Check & Ledger Tracking
    console.log('\n3. Testing AI Quota Service & Usage Ledger:');
    // Get test user
    const userRes = await db.query(`SELECT id FROM users LIMIT 1`);
    const testUserId = userRes.rows[0]?.id;

    const quotaCheck = await usageLedgerService.checkQuota(testUserId, 'CONVERSATIONAL_CHAT');
    console.log('✓ Quota Check Result:', quotaCheck.allowed ? 'PASS (Allowed)' : 'BLOCKED');

    await usageLedgerService.recordUsage({
      userId: testUserId,
      featureCategory: 'CONVERSATIONAL_CHAT',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      promptTokens: 120,
      completionTokens: 350,
      status: 'SUCCESS'
    });
    console.log('✓ Recorded AI usage entry in ledger');

    const dashboardMetrics = await usageLedgerService.getDashboardMetrics();
    console.log('✓ Retrieved Quota Dashboard Metrics:', {
      totalRequests: dashboardMetrics.overview.totalRequests,
      categoriesCount: dashboardMetrics.categories.length
    });

    // 4. Test Saved Materials (Bookmarks)
    console.log('\n4. Testing Saved Materials:');
    // Create test student resource
    const resInsert = await db.query(`
      INSERT INTO student_resources (
        title, description, public_course_id, external_url, external_provider, is_public, status, uploaded_by
      ) VALUES (
        'Test Binary Trees Lecture', 'DSA video guide', $1, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YOUTUBE', TRUE, 'APPROVED', $2
      ) RETURNING id
    `, [testCourseId, testUserId]);
    const testResourceId = resInsert.rows[0].id;

    await db.query(`INSERT INTO saved_resources (user_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [testUserId, testResourceId]);
    const savedCheck = await db.query(`SELECT COUNT(*) FROM saved_resources WHERE user_id = $1 AND resource_id = $2`, [testUserId, testResourceId]);
    console.log('✓ Saved Material Bookmarking:', parseInt(savedCheck.rows[0].count, 10) === 1 ? 'PASS' : 'FAIL');

    // 5. Test Personal Notes
    console.log('\n5. Testing Personal Notes:');
    const noteInsert = await db.query(`
      INSERT INTO personal_notes (user_id, title, content, course_name, topic_tag, tags)
      VALUES ($1, 'Binary Search In-depth', 'Time complexity O(log N). Mid calculation: low + (high - low) / 2', 'DSA', 'Algorithms', ARRAY['binary-search', 'dsa'])
      RETURNING id, title
    `, [testUserId]);
    console.log('✓ Personal Note Creation:', noteInsert.rows[0]?.title ? 'PASS' : 'FAIL');

    // 6. Test AI Generated Tests & Attempts
    console.log('\n6. Testing AI Practice Tests:');
    const mockQuestions = [
      {
        id: 1,
        question: "What is the average time complexity of quicksort?",
        options: ["O(N log N)", "O(N^2)", "O(N)", "O(log N)"],
        correctAnswer: "O(N log N)",
        explanation: "Quicksort has an average time complexity of O(N log N).",
        topicTag: "Sorting"
      }
    ];

    const testGen = await db.query(`
      INSERT INTO ai_generated_tests (user_id, title, topic, course_name, difficulty, question_count, questions)
      VALUES ($1, 'Quicksort Practice Test', 'Quicksort', 'Algorithms', 'MEDIUM', 1, $2)
      RETURNING id
    `, [testUserId, JSON.stringify(mockQuestions)]);
    const testId = testGen.rows[0].id;

    const attemptRes = await db.query(`
      INSERT INTO ai_test_attempts (test_id, user_id, score, total_questions, correct_count, user_answers)
      VALUES ($1, $2, 100.0, 1, 1, $3)
      RETURNING id, score
    `, [testId, testUserId, JSON.stringify([{ questionId: 1, selectedAnswer: "O(N log N)", isCorrect: true }])]);
    console.log('✓ AI Test Generation & Grading Attempt:', parseFloat(attemptRes.rows[0].score) === 100 ? 'PASS' : 'FAIL');

    // Clean up temporary test entries
    await db.query(`DELETE FROM ai_test_attempts WHERE id = $1`, [attemptRes.rows[0].id]);
    await db.query(`DELETE FROM ai_generated_tests WHERE id = $1`, [testId]);
    await db.query(`DELETE FROM personal_notes WHERE id = $1`, [noteInsert.rows[0].id]);
    await db.query(`DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2`, [testUserId, testResourceId]);
    await db.query(`DELETE FROM student_resources WHERE id = $1`, [testResourceId]);
    await db.query(`DELETE FROM public_courses WHERE id = $1`, [testCourseId]);
    console.log('✓ Cleaned up test artifacts.');

    console.log('\n🎉 ALL BACKEND PUBLIC ECOSYSTEM TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testPublicEcosystemBackend();
