const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

async function runTests() {
  console.log('--- Testing Remedial Plan Persistence & Authorization ---');

  const hodUserRes = await db.query("SELECT * FROM users WHERE role = 'HOD' LIMIT 1");
  const studentUserRes = await db.query("SELECT * FROM users WHERE role = 'STUDENT' LIMIT 1");

  const hod = hodUserRes.rows[0];
  const student = studentUserRes.rows[0];

  const hodToken = jwt.sign({ id: hod.id, role: hod.role, email: hod.email, department_id: hod.department_id, institute_id: hod.institute_id }, JWT_SECRET, { expiresIn: '1h' });
  const studentToken = jwt.sign({ id: student.id, role: student.role, email: student.email, department_id: student.department_id, institute_id: student.institute_id }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Fetch cohort gaps
  const gapsRes = await axios.get(`${API_BASE}/analytics/cohort/learning-gaps`, {
    headers: { Authorization: `Bearer ${hodToken}` }
  });
  console.log(`[PASS] Cohort learning gaps returned ${gapsRes.data.topics?.length} topics`);
  const firstTopic = gapsRes.data.topics[0];
  const topicName = firstTopic.topicTag || firstTopic.topicTitle || 'Regression Coefficients';
  console.log(`Testing topic: ${topicName} (Subject: ${firstTopic.subject_name}, Unit: ${firstTopic.unit_title}, Semester: ${firstTopic.semester})`);

  // 2. Save remedial plan as HOD
  const savePayload = {
    subject_id: firstTopic.subject_id,
    topic_id: firstTopic.topic_id || firstTopic.topicId,
    topic_tag: topicName,
    plan_content: {
      prerequisites: 'Review algebraic equation solving and linear representations',
      coreConcept: 'Understanding the formula and geometric significance of regression coefficients',
      workedExample: 'Step-by-step calculation of byx given sum of XY and sum of X^2',
      commonMistakes: 'Inverting numerator and denominator or confusing byx with bxy',
      targetedPractice: ['Practice Problem 1: Find byx for given data', 'Practice Problem 2: Verify correlation r'],
      diagnosticQuestions: [{ question: 'What is byx when r=0.8, sx=2, sy=4?', options: ['1.6', '0.4', '0.8'], answer: '1.6' }],
      recommendedFollowUp: 'Re-administer micro-assessment in 48 hours.'
    },
    status: 'PUBLISHED'
  };

  const saveRes = await axios.post(`${API_BASE}/analytics/cohort/save-remedial-plan`, savePayload, {
    headers: { Authorization: `Bearer ${hodToken}` }
  });
  console.log(`[PASS] Save remedial plan returned ${saveRes.status}: ID=${saveRes.data.plan?.id}`);

  // 3. Fetch saved remedial plans
  const fetchRes = await axios.get(`${API_BASE}/analytics/cohort/remedial-plans`, {
    headers: { Authorization: `Bearer ${hodToken}` }
  });
  const plans = Array.isArray(fetchRes.data) ? fetchRes.data : (fetchRes.data?.plans || []);
  console.log(`[PASS] Fetched ${plans.length} saved remedial plans`);
  const savedItem = plans.find(p => p.id === saveRes.data.plan.id);
  if (!savedItem) throw new Error('Saved plan not found in database fetch!');
  console.log(`[PASS] Verified persisted plan in DB: Topic=${savedItem.topic_tag || savedItem.topic_title}, Status=${savedItem.status}`);

  // 4. Fetch subject specific saved plans
  const subFetchRes = await axios.get(`${API_BASE}/analytics/cohort/subject/${firstTopic.subject_id}/remedial-plans`, {
    headers: { Authorization: `Bearer ${hodToken}` }
  });
  const subPlans = Array.isArray(subFetchRes.data) ? subFetchRes.data : (subFetchRes.data?.plans || []);
  console.log(`[PASS] Fetched ${subPlans.length} saved remedial plans for subject`);

  // 5. Test Student Block on Save
  try {
    await axios.post(`${API_BASE}/analytics/cohort/save-remedial-plan`, savePayload, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    throw new Error('Student should have been blocked!');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('[PASS] Student save remedial plan blocked with 403 Forbidden');
    } else {
      throw err;
    }
  }

  // 6. Test Student Block on Fetch
  try {
    await axios.get(`${API_BASE}/analytics/cohort/remedial-plans`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    throw new Error('Student should have been blocked!');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('[PASS] Student get remedial plans blocked with 403 Forbidden');
    } else {
      throw err;
    }
  }

  // 7. Test Material Signed URL
  const matRes = await db.query("SELECT id, title, file_name FROM materials LIMIT 1");
  if (matRes.rowCount > 0) {
    const mat = matRes.rows[0];
    const signedUrlRes = await axios.get(`${API_BASE}/academic/materials/${mat.id}/signed-url`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    console.log(`[PASS] GET /api/academic/materials/${mat.id}/signed-url returned 200 with URL length ${signedUrlRes.data.url?.length}`);
  }

  console.log('\n================================================================');
  console.log('ALL REMEDIAL PERSISTENCE & AUTHORIZATION TESTS PASSED 100%!');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Failed:', err.message, err.response?.data || '');
  process.exit(1);
});
