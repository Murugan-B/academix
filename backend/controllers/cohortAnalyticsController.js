const db = require('../db');
const aiService = require('../services/ai/aiService');
const textExtractor = require('../utils/textExtractor');

/**
 * Aggregates cohort-level question-level performance for topics across a department or subject
 */
async function aggregateCohortTopicPerformance({ instituteId = null, departmentId = null, subjectId = null, semester = null }) {
  let query = `
    SELECT 
      COALESCE(qq.topic_tag, t.title, 'General Concept') as topic_tag,
      t.id as topic_id,
      t.title as topic_title,
      s.id as subject_id,
      s.name as subject_name,
      s.code as subject_code,
      s.semester as semester,
      u.id as unit_id,
      u.unit_number,
      u.title as unit_title,
      l.id as lesson_id,
      l.title as lesson_title,
      l.lesson_number,
      
      -- Cohort aggregates (Derived from question-level answers)
      COUNT(DISTINCT qa.student_id) as attempted_students_count,
      COUNT(qaa.id) as total_questions_attempted,
      COUNT(CASE WHEN qaa.is_correct THEN 1 END) as correct_answers_count,
      COUNT(CASE WHEN NOT qaa.is_correct THEN 1 END) as wrong_answers_count,
      
      -- Student-level accuracy mapping for struggling count calculation
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'student_id', qa.student_id,
          'is_correct', qaa.is_correct
        )
      ) as answers_distribution
    FROM quiz_attempt_answers qaa
    JOIN quiz_questions qq ON qaa.question_id = qq.id
    JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
    JOIN quizzes q ON qq.quiz_id = q.id
    JOIN materials m ON q.material_id = m.id
    LEFT JOIN topics t ON m.topic_id = t.id
    LEFT JOIN lessons l ON t.lesson_id = l.id
    LEFT JOIN units u ON l.unit_id = u.id
    LEFT JOIN subjects s ON u.subject_id = s.id
    LEFT JOIN departments d ON s.department_id = d.id
    WHERE qa.status IN ('PASSED', 'NOT PASSED', 'COMPLETED')
  `;

  const params = [];
  if (instituteId) {
    params.push(instituteId);
    query += ` AND d.institute_id = $${params.length}`;
  }
  if (departmentId) {
    params.push(departmentId);
    query += ` AND s.department_id = $${params.length}`;
  }
  if (subjectId) {
    params.push(subjectId);
    query += ` AND s.id = $${params.length}`;
  }
  if (semester) {
    params.push(semester);
    query += ` AND s.semester = $${params.length}`;
  }

  query += `
    GROUP BY COALESCE(qq.topic_tag, t.title, 'General Concept'), t.id, t.title, s.id, s.name, s.code, s.semester, u.id, u.unit_number, u.title, l.id, l.title, l.lesson_number
    ORDER BY total_questions_attempted DESC
  `;

  const res = await db.query(query, params);

  const topicGaps = [];
  const allCohortStudents = new Set();
  let totalAttemptsSum = 0;
  let totalCorrectSum = 0;

  res.rows.forEach(r => {
    const totalQ = parseInt(r.total_questions_attempted || 0);
    const correctQ = parseInt(r.correct_answers_count || 0);
    const wrongQ = parseInt(r.wrong_answers_count || 0);
    const studentsCount = parseInt(r.attempted_students_count || 0);

    totalAttemptsSum += totalQ;
    totalCorrectSum += correctQ;

    // Student performance breakdown per topic
    const studentMap = {};
    const answersList = r.answers_distribution || [];
    answersList.forEach(a => {
      allCohortStudents.add(a.student_id);
      if (!studentMap[a.student_id]) {
        studentMap[a.student_id] = { total: 0, correct: 0 };
      }
      studentMap[a.student_id].total++;
      if (a.is_correct) studentMap[a.student_id].correct++;
    });

    let strugglingStudentsCount = 0;
    Object.values(studentMap).forEach(sData => {
      const studentAcc = sData.total > 0 ? (sData.correct / sData.total) * 100 : 0;
      if (studentAcc < 50) {
        strugglingStudentsCount++;
      }
    });

    const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;

    // Deterministic Classification:
    // - LEARNING_GAP: accuracy < 50% OR strugglingStudentsCount >= 40% of cohort
    // - NEEDS_ATTENTION: accuracy 50% - 69%
    // - STRONG: accuracy >= 70%
    let classification = 'STRONG';
    let priority = 'LOW';

    if (accuracy < 50 || (studentsCount >= 2 && (strugglingStudentsCount / studentsCount) >= 0.4)) {
      classification = 'LEARNING_GAP';
      priority = 'HIGH';
    } else if (accuracy < 70) {
      classification = 'NEEDS_ATTENTION';
      priority = 'MEDIUM';
    }

    topicGaps.push({
      topicTag: r.topic_tag,
      topicId: r.topic_id,
      topicTitle: r.topic_title,
      subject_id: r.subject_id,
      subject_name: r.subject_name,
      subject_code: r.subject_code,
      semester: r.semester || 1,
      unit_id: r.unit_id,
      unit_number: r.unit_number,
      unit_title: r.unit_title,
      lesson_id: r.lesson_id,
      lesson_title: r.lesson_title,
      lesson_number: r.lesson_number,
      attemptedStudents: studentsCount,
      studentsStruggling: strugglingStudentsCount,
      totalQuestions: totalQ,
      correctAnswers: correctQ,
      wrongAnswers: wrongQ,
      accuracy,
      classification,
      priority
    });
  });

  // Sort by priority (Learning Gaps first, lowest accuracy first)
  topicGaps.sort((a, b) => {
    const prio = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (prio[b.priority] !== prio[a.priority]) return prio[b.priority] - prio[a.priority];
    return a.accuracy - b.accuracy;
  });

  const highGaps = topicGaps.filter(g => g.classification === 'LEARNING_GAP');
  const mediumGaps = topicGaps.filter(g => g.classification === 'NEEDS_ATTENTION');
  const strongTopics = topicGaps.filter(g => g.classification === 'STRONG');

  return {
    topics: topicGaps,
    summary: {
      totalStudentsEvaluated: allCohortStudents.size,
      totalTopicsAnalyzed: topicGaps.length,
      learningGapsCount: highGaps.length,
      needsAttentionCount: mediumGaps.length,
      strongCount: strongTopics.length,
      averageCohortAccuracy: totalAttemptsSum > 0 ? Math.round((totalCorrectSum / totalAttemptsSum) * 100) : 0
    },
    learningGaps: highGaps,
    needsAttention: mediumGaps,
    strongTopics
  };
}

/**
 * GET /api/analytics/cohort/learning-gaps
 */
exports.getDepartmentCohortGaps = async (req, res) => {
  const user = req.user;
  const { subjectId, semester, departmentId: qDeptId } = req.query;

  try {
    let departmentId = null;
    let instituteId = null;

    if (user.role === 'SUPER_ADMIN') {
      departmentId = qDeptId || null;
    } else if (user.role === 'INSTITUTE_ADMIN') {
      instituteId = user.institute_id;
      departmentId = qDeptId || null;
    } else if (user.role === 'HOD' || user.role === 'FACULTY') {
      departmentId = user.department_id;
      instituteId = user.institute_id;
    }

    const result = await aggregateCohortTopicPerformance({ instituteId, departmentId, subjectId, semester });
    res.json(result);
  } catch (err) {
    console.error('getDepartmentCohortGaps error:', err);
    res.status(500).json({ error: err.message || 'Failed to detect department cohort learning gaps.' });
  }
};

/**
 * GET /api/analytics/cohort/subject/:subjectId/gaps
 */
exports.getSubjectCohortGaps = async (req, res) => {
  const { subjectId } = req.params;
  const user = req.user;

  try {
    // 1. Verify subject access
    const subRes = await db.query(
      `SELECT s.id, s.name, s.code, s.semester, s.department_id, d.name as department_name, d.institute_id
       FROM subjects s
       JOIN departments d ON s.department_id = d.id
       WHERE s.id = $1`,
      [subjectId]
    );

    if (subRes.rowCount === 0) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const subject = subRes.rows[0];

    // RBAC: Verify department and institute isolation
    if (user.role !== 'SUPER_ADMIN') {
      if (user.institute_id && subject.institute_id !== user.institute_id) {
        return res.status(403).json({ error: 'Access denied to this institute subject.' });
      }
      if (user.role === 'HOD' && user.department_id && subject.department_id !== user.department_id) {
        return res.status(403).json({ error: 'Access denied: HOD cannot access subjects outside their department.' });
      }
    }

    const result = await aggregateCohortTopicPerformance({ subjectId });
    res.json({
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        semester: subject.semester,
        departmentName: subject.department_name
      },
      ...result
    });
  } catch (err) {
    console.error('getSubjectCohortGaps error:', err);
    res.status(500).json({ error: err.message || 'Failed to detect subject cohort learning gaps.' });
  }
};

/**
 * POST /api/analytics/cohort/remedial-plan
 * AI generation of structured remedial learning package for a struggling topic.
 */
exports.generateRemedialPlan = async (req, res) => {
  const { subjectId, topicTag, topicId, materialId, provider = 'gemini' } = req.body;
  const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';

  if (!topicTag) {
    return res.status(400).json({ error: 'Topic tag is required.' });
  }

  try {
    // 1. Fetch material text context
    let material = null;
    if (materialId) {
      const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
      if (matRes.rowCount > 0) material = matRes.rows[0];
    }

    if (!material && topicId) {
      const matRes = await db.query('SELECT * FROM materials WHERE topic_id = $1 LIMIT 1', [topicId]);
      if (matRes.rowCount > 0) material = matRes.rows[0];
    }

    if (!material) {
      const findMatRes = await db.query(`
        SELECT m.* FROM materials m
        JOIN quizzes q ON m.id = q.material_id
        JOIN quiz_questions qq ON q.id = qq.quiz_id
        WHERE qq.topic_tag = $1
        ORDER BY m.created_at DESC LIMIT 1
      `, [topicTag]);
      if (findMatRes.rowCount > 0) material = findMatRes.rows[0];
    }

    let extractedText = '';
    if (material) {
      const ext = await textExtractor.extractTextFromMaterial(material);
      extractedText = ext.text || '';
    }

    // 2. Fetch sample missed questions for this topic across cohort
    const missedRes = await db.query(`
      SELECT qq.question, qaa.selected_answer, qq.correct_answer, qq.explanation, COUNT(*) as fail_count
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      WHERE (qq.topic_tag ILIKE $1 OR qq.question ILIKE $1) AND qaa.is_correct = false
      GROUP BY qq.question, qaa.selected_answer, qq.correct_answer, qq.explanation
      ORDER BY fail_count DESC
      LIMIT 5
    `, [`%${topicTag}%`]);

    const missedBlock = missedRes.rows.map((q, idx) => 
      `Missed Question ${idx + 1} (Failed by ${q.fail_count} students): ${q.question} | Correct: ${q.correct_answer} | Explanation: ${q.explanation || 'N/A'}`
    ).join('\n');

    // 3. AI Remedial Generation via provider abstraction
    const prompt = `You are an expert Academic Curriculum Specialist.
A college cohort of students has demonstrated a significant learning gap on the academic topic: "${topicTag}".

Context Material:
${extractedText ? extractedText.substring(0, 4000) : 'Standard undergraduate academic curriculum topic.'}

Cohort Error Analysis (Frequently Missed Questions):
${missedBlock || 'General misconceptions in applying this concept.'}

Generate a comprehensive, structured Remedial Learning Intervention Package in JSON format matching this schema:
{
  "prerequisiteRecap": "1-2 paragraphs detailing foundational concepts students must revise before this topic",
  "conceptExplanation": "Clear, intuitive breakdown of the core concept with key rules",
  "example": "Worked step-by-step example illustrating proper application",
  "commonMistakes": [
    "Mistake 1 and why students make it",
    "Mistake 2 and how to avoid it"
  ],
  "practiceExercises": [
    "Short practice problem 1 with solution guidance",
    "Short practice problem 2 with solution guidance"
  ],
  "quickAssessmentQuestions": [
    {
      "question": "Diagnostic MCQ question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why Option A is correct"
    }
  ]
}`;

    const aiResult = await aiService.getProvider(provider)._generateContentWithFallback({
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const remedialPlan = aiService.getProvider(provider)._cleanAndParseJson(aiResult.text);

    // 4. Save Draft Plan to DB
    if (subjectId) {
      await db.query(`
        INSERT INTO cohort_remedial_plans (subject_id, topic_id, topic_tag, created_by, plan_content, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'DRAFT', NOW())
        ON CONFLICT DO NOTHING
      `, [subjectId, topicId || null, topicTag, userId, JSON.stringify(remedialPlan)]);
    }

    res.json({
      success: true,
      topic: topicTag,
      plan: remedialPlan,
      status: 'DRAFT'
    });
  } catch (err) {
    console.error('generateRemedialPlan error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate remedial learning plan.' });
  }
};

/**
 * GET /api/analytics/cohort/subject/:subjectId/remedial-plans
 */
exports.getSubjectRemedialPlans = async (req, res) => {
  const { subjectId } = req.params;

  try {
    const plansRes = await db.query(`
      SELECT p.id, p.subject_id, p.topic_id, p.topic_tag, p.status, p.plan_content, p.created_at, p.updated_at,
             s.name as subject_name, s.code as subject_code, s.semester,
             u.name as author_name,
             un.unit_number, un.title as unit_title
      FROM cohort_remedial_plans p
      JOIN subjects s ON p.subject_id = s.id
      JOIN users u ON p.created_by = u.id
      LEFT JOIN topics t ON p.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units un ON l.unit_id = un.id
      WHERE p.subject_id = $1
      ORDER BY p.updated_at DESC
    `, [subjectId]);

    res.json(plansRes.rows);
  } catch (err) {
    console.error('getSubjectRemedialPlans error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch remedial plans.' });
  }
};

/**
 * POST /api/analytics/cohort/save-remedial-plan
 * Persist and publish a finalized remedial learning plan to the database
 */
exports.saveRemedialPlan = async (req, res) => {
  const subjectId = req.body.subjectId || req.body.subject_id;
  const topicId = req.body.topicId || req.body.topic_id;
  const topicTag = req.body.topicTag || req.body.topic_tag || req.body.topicTitle || req.body.topic_title;
  const planContent = req.body.planContent || req.body.plan_content;
  const status = req.body.status || 'PUBLISHED';
  const userId = req.user.id;

  if (!subjectId || !topicTag || !planContent) {
    return res.status(400).json({ error: 'Subject ID, topic tag, and plan content are required.' });
  }

  const validStatus = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status) ? status : 'PUBLISHED';

  try {
    // Check if an existing plan for this topic in this subject already exists
    const existing = await db.query(
      `SELECT id FROM cohort_remedial_plans WHERE subject_id = $1 AND topic_tag = $2`,
      [subjectId, topicTag]
    );

    let savedPlan;
    if (existing.rowCount > 0) {
      const updateRes = await db.query(
        `UPDATE cohort_remedial_plans
         SET plan_content = $1, status = $2, topic_id = COALESCE($3, topic_id), created_by = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [JSON.stringify(planContent), validStatus, topicId || null, userId, existing.rows[0].id]
      );
      savedPlan = updateRes.rows[0];
    } else {
      const insertRes = await db.query(
        `INSERT INTO cohort_remedial_plans (subject_id, topic_id, topic_tag, created_by, plan_content, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [subjectId, topicId || null, topicTag, userId, JSON.stringify(planContent), validStatus]
      );
      savedPlan = insertRes.rows[0];
    }

    res.json({
      success: true,
      message: 'Remedial plan saved successfully.',
      plan: savedPlan
    });
  } catch (err) {
    console.error('saveRemedialPlan error:', err);
    res.status(500).json({ error: err.message || 'Failed to save remedial plan.' });
  }
};

/**
 * GET /api/analytics/cohort/remedial-plans
 * Fetch all saved remedial plans across the department
 */
exports.getAllDepartmentRemedialPlans = async (req, res) => {
  const user = req.user;
  const { subjectId, search } = req.query;

  try {
    let sql = `
      SELECT p.id, p.subject_id, p.topic_id, p.topic_tag, p.status, p.plan_content, p.created_at, p.updated_at,
             s.name as subject_name, s.code as subject_code, s.semester,
             u.name as author_name,
             un.unit_number, un.title as unit_title
      FROM cohort_remedial_plans p
      JOIN subjects s ON p.subject_id = s.id
      JOIN users u ON p.created_by = u.id
      LEFT JOIN topics t ON p.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units un ON l.unit_id = un.id
      WHERE 1=1
    `;
    const params = [];

    if (user.role !== 'SUPER_ADMIN') {
      if (user.department_id) {
        params.push(user.department_id);
        sql += ` AND s.department_id = $${params.length}`;
      }
    }

    if (subjectId) {
      params.push(subjectId);
      sql += ` AND p.subject_id = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (p.topic_tag ILIKE $${params.length} OR s.name ILIKE $${params.length} OR u.name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY p.updated_at DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('getAllDepartmentRemedialPlans error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch department remedial plans.' });
  }
};

exports.aggregateCohortTopicPerformance = aggregateCohortTopicPerformance;
