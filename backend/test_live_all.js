require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('./db');

const API_BASE = 'http://localhost:5000/api';

async function runLiveApiTests() {
  console.log('================================================================');
  console.log('ACADEMIX LIVE API & PERMISSION VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} - ${details}`);
      failed++;
    }
  }

  try {
    // 1. Fetch real users for HOD, Faculty, and Student
    const hodUserRes = await db.query("SELECT * FROM users WHERE role = 'HOD' LIMIT 1");
    const facultyUserRes = await db.query("SELECT * FROM users WHERE role = 'FACULTY' LIMIT 1");
    const studentUserRes = await db.query("SELECT * FROM users WHERE role = 'STUDENT' LIMIT 1");

    if (hodUserRes.rowCount === 0 || studentUserRes.rowCount === 0) {
      throw new Error('Missing test users in database.');
    }

    const hod = hodUserRes.rows[0];
    const faculty = facultyUserRes.rows[0] || hod;
    const student = studentUserRes.rows[0];

    const hodToken = jwt.sign({ id: hod.id, role: hod.role, email: hod.email, department_id: hod.department_id, institute_id: hod.institute_id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
    const studentToken = jwt.sign({ id: student.id, role: student.role, email: student.email, department_id: student.department_id, institute_id: student.institute_id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });

    // 2. Fetch MATHS Subject
    const mathsRes = await db.query("SELECT id, name FROM subjects WHERE name ILIKE '%Math%' LIMIT 1");
    const mathsSubject = mathsRes.rows[0];
    assert(mathsSubject !== undefined, 'Found MATHS subject in database', mathsSubject?.name);

    // -------------------------------------------------------------
    // PART 1: KNOWLEDGE GRAPH CONCEPT STATUS LIFECYCLE
    // -------------------------------------------------------------
    console.log('\n--- Part 1: Knowledge Graph Concept Status Lifecycle ---');

    // Get subject knowledge graph
    const graphRes = await axios.get(`${API_BASE}/knowledge-graph/subjects/${mathsSubject.id}`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    assert(graphRes.status === 200, 'GET /api/knowledge-graph/subjects/:id returned 200');
    assert(graphRes.data.concepts.length >= 10, `MATHS has ${graphRes.data.concepts.length} concepts (>=10 required)`);
    assert(graphRes.data.relationships.length >= 13, `MATHS has ${graphRes.data.relationships.length} relationships (>=13 required)`);

    // Pick first concept
    const testConcept = graphRes.data.concepts[0];
    console.log(`Testing with concept '${testConcept.name}' (Current status: ${testConcept.status})`);

    // Step A: Reset to DETECTED (or update to DETECTED via DB/API)
    await db.query("UPDATE concepts SET status = 'DETECTED' WHERE id = $1", [testConcept.id]);

    // Step B: PATCH to REVIEWED
    const reviewRes = await axios.patch(
      `${API_BASE}/knowledge-graph/concepts/${testConcept.id}/status`,
      { status: 'REVIEWED' },
      { headers: { Authorization: `Bearer ${hodToken}` } }
    );
    assert(reviewRes.status === 200, 'PATCH /api/knowledge-graph/concepts/:id/status to REVIEWED returned 200');
    assert(reviewRes.data.concept.status === 'REVIEWED', 'Concept status in response is REVIEWED');
    assert(reviewRes.data.message === 'Concept marked as reviewed.', `Message: "${reviewRes.data.message}"`);

    // Verify persistence in graph
    const checkReviewedRes = await axios.get(`${API_BASE}/knowledge-graph/subjects/${mathsSubject.id}`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    const reviewedConcept = checkReviewedRes.data.concepts.find(c => c.id === testConcept.id);
    assert(reviewedConcept.status === 'REVIEWED', 'Status persists as REVIEWED in DB');

    // Step C: PATCH to CONFIRMED
    const confirmRes = await axios.patch(
      `${API_BASE}/knowledge-graph/concepts/${testConcept.id}/status`,
      { status: 'CONFIRMED' },
      { headers: { Authorization: `Bearer ${hodToken}` } }
    );
    assert(confirmRes.status === 200, 'PATCH /api/knowledge-graph/concepts/:id/status to CONFIRMED returned 200');
    assert(confirmRes.data.concept.status === 'CONFIRMED', 'Concept status in response is CONFIRMED');
    assert(confirmRes.data.message === 'Concept confirmed.', `Message: "${confirmRes.data.message}"`);

    // Verify persistence in graph
    const checkConfirmedRes = await axios.get(`${API_BASE}/knowledge-graph/subjects/${mathsSubject.id}`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    const confirmedConcept = checkConfirmedRes.data.concepts.find(c => c.id === testConcept.id);
    assert(confirmedConcept.status === 'CONFIRMED', 'Status persists as CONFIRMED in DB');

    // Step D: Student attempt to PATCH concept status -> MUST return 403 Forbidden
    let studentPatchBlocked = false;
    try {
      await axios.patch(
        `${API_BASE}/knowledge-graph/concepts/${testConcept.id}/status`,
        { status: 'DETECTED' },
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 403) {
        studentPatchBlocked = true;
      }
    }
    assert(studentPatchBlocked, 'Student PATCH concept status blocked with 403 Forbidden');

    // -------------------------------------------------------------
    // PART 2: COHORT LEARNING GAPS & REMEDIAL PLAN
    // -------------------------------------------------------------
    console.log('\n--- Part 2: Cohort Learning Gaps & Remedial Plan ---');

    // HOD gets cohort learning gaps
    const cohortGapsRes = await axios.get(`${API_BASE}/analytics/cohort/learning-gaps`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    assert(cohortGapsRes.status === 200, 'GET /api/analytics/cohort/learning-gaps returned 200 for HOD');
    assert(Array.isArray(cohortGapsRes.data.topics), `Found ${cohortGapsRes.data.topics.length} cohort topics evaluated`);
    assert(cohortGapsRes.data.summary !== undefined, 'Cohort summary object exists');

    // Student attempt to access cohort learning gaps -> MUST return 403
    let studentGapsBlocked = false;
    try {
      await axios.get(`${API_BASE}/analytics/cohort/learning-gaps`, {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
    } catch (err) {
      if (err.response?.status === 403) {
        studentGapsBlocked = true;
      }
    }
    assert(studentGapsBlocked, 'Student GET cohort learning gaps blocked with 403 Forbidden');

    // HOD generates remedial plan
    const topicToRemediate = cohortGapsRes.data.topics[0]?.topicTag || 'Method of Regression';
    console.log(`Generating remedial plan for topic '${topicToRemediate}'...`);
    const remedialPlanRes = await axios.post(
      `${API_BASE}/analytics/cohort/remedial-plan`,
      { topicTag: topicToRemediate, subjectId: mathsSubject.id, provider: 'gemini' },
      { headers: { Authorization: `Bearer ${hodToken}` } }
    );
    assert(remedialPlanRes.status === 200, 'POST /api/analytics/cohort/remedial-plan returned 200');
    assert(remedialPlanRes.data.plan !== undefined, 'AI Remedial Plan generated successfully');
    assert(remedialPlanRes.data.plan.prerequisiteRecap !== undefined || remedialPlanRes.data.plan.conceptExplanation !== undefined, 'Remedial plan has structured educational content');

    // Student attempt to generate remedial plan -> MUST return 403
    let studentRemedialBlocked = false;
    try {
      await axios.post(
        `${API_BASE}/analytics/cohort/remedial-plan`,
        { topicTag: topicToRemediate, subjectId: mathsSubject.id },
        { headers: { Authorization: `Bearer ${studentToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 403) {
        studentRemedialBlocked = true;
      }
    }
    assert(studentRemedialBlocked, 'Student POST cohort remedial plan blocked with 403 Forbidden');

    // -------------------------------------------------------------
    // PART 3: AI ASSISTANT ACADEMIC EVIDENCE & VERIFIED CITATIONS
    // -------------------------------------------------------------
    console.log('\n--- Part 3: AI Assistant Academic Evidence & Citations ---');

    // Create a new conversation for Student
    const convRes = await axios.post(
      `${API_BASE}/ai/assistant/conversations`,
      { title: 'MATHS RAG Test', provider: 'gemini' },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const convId = convRes.data.id;
    assert(convId !== undefined, 'Created student conversation');

    // Ask Academic Question in Global AI Assistant
    console.log('Asking: "Explain Method of Regression based on the academic material."');
    const academicMsgRes = await axios.post(
      `${API_BASE}/ai/assistant/conversations/${convId}/messages`,
      { message: 'Explain Method of Regression based on the academic material.', provider: 'gemini' },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const assistMsg = academicMsgRes.data.assistantMessage;
    assert(academicMsgRes.status === 200, 'Global AI Assistant message returned 200');
    assert(assistMsg.grounding === 'GROUNDED' || assistMsg.grounding === 'PARTIAL', `Academic question grounding is ${assistMsg.grounding}`);
    
    let citations = [];
    try {
      citations = typeof assistMsg.citations === 'string' ? JSON.parse(assistMsg.citations) : assistMsg.citations;
    } catch (e) {
      citations = assistMsg.citations || [];
    }
    assert(citations.length > 0, `Verified academic citations returned (${citations.length} sources)`);
    if (citations.length > 0) {
      console.log('Source:', citations[0].material_title);
      console.log('Page:', citations[0].page_number, '| Slide:', citations[0].slide_number, '| Section:', citations[0].section_title);
      assert(citations[0].material_title.includes('regression') || citations[0].material_title.includes('equations') || citations[0].material_title.includes('Method'), 'Citation matches genuine course material title');
    }

    // Ask General / Unrelated Question
    console.log('Asking general question: "What is the capital of France?"');
    const generalConvRes = await axios.post(
      `${API_BASE}/ai/assistant/conversations`,
      { title: 'General Question Test', provider: 'gemini' },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const generalMsgRes = await axios.post(
      `${API_BASE}/ai/assistant/conversations/${generalConvRes.data.id}/messages`,
      { message: 'What is the capital of France?', provider: 'gemini' },
      { headers: { Authorization: `Bearer ${studentToken}` } }
    );
    const genAssistMsg = generalMsgRes.data.assistantMessage;
    assert(genAssistMsg.grounding === 'GENERAL', `General question grounding is GENERAL (Actual: ${genAssistMsg.grounding})`);

    // Summary
    console.log('\n================================================================');
    console.log(`LIVE API VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('API Verification error:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

runLiveApiTests();
