const db = require('../db');

/**
 * Calculates deterministic syllabus coverage metrics and actionable gaps for a subject.
 */
async function calculateSubjectCoverage(subjectId) {
  // Fetch subject info
  const subRes = await db.query(
    `SELECT s.id, s.name, s.code, s.semester, s.department_id, d.name as department_name, d.institute_id
     FROM subjects s
     JOIN departments d ON s.department_id = d.id
     WHERE s.id = $1`,
    [subjectId]
  );

  if (subRes.rowCount === 0) {
    return null;
  }

  const subject = subRes.rows[0];

  // Fetch full hierarchy: Units -> Lessons -> Topics with Material and Quiz indicators
  const query = `
    SELECT 
      u.id as unit_id,
      u.unit_number,
      u.title as unit_title,
      l.id as lesson_id,
      l.lesson_number,
      l.title as lesson_title,
      t.id as topic_id,
      t.topic_number,
      t.title as topic_title,
      t.description as topic_description,
      
      -- Material Signals (Official curriculum materials only)
      COUNT(DISTINCT m.id) as material_count,
      COALESCE(MAX(m.title), NULL) as sample_material_title,
      COALESCE(MAX(m.file_type), NULL) as sample_material_type,
      
      -- Assessment Signals
      COUNT(DISTINCT q.id) as quiz_count,
      COUNT(DISTINCT qq.id) as question_count
    FROM units u
    JOIN lessons l ON l.unit_id = u.id
    JOIN topics t ON t.lesson_id = l.id
    LEFT JOIN materials m ON m.topic_id = t.id AND (m.source_type = 'OFFICIAL' OR m.source_type IS NULL)
    LEFT JOIN quizzes q ON q.material_id = m.id
    LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
    WHERE u.subject_id = $1
    GROUP BY u.id, u.unit_number, u.title, l.id, l.lesson_number, l.title, t.id, t.topic_number, t.title, t.description
    ORDER BY u.unit_number ASC, l.lesson_number ASC, t.topic_number ASC
  `;

  const result = await db.query(query, [subjectId]);
  const rows = result.rows;

  if (rows.length === 0) {
    return {
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        semester: subject.semester,
        departmentName: subject.department_name
      },
      overallCoverageScore: 0,
      summary: {
        totalUnits: 0,
        totalTopics: 0,
        coveredTopics: 0,
        topicsWithMaterial: 0,
        topicsWithAssessment: 0,
        materialCoveragePercentage: 0,
        assessmentCoveragePercentage: 0,
        overallCoveragePercentage: 0
      },
      units: [],
      actionableGaps: [],
      formulaDescription: "Topic Coverage = (Material Signal: 50%) + (Assessment Signal: 50%). Subject Coverage = Average across all topic coverage scores."
    };
  }

  // Assemble and calculate coverage per Unit & Topic
  const unitMap = {};
  const actionableGaps = [];

  let totalTopics = 0;
  let topicsWithMaterial = 0;
  let topicsWithAssessment = 0;
  let totalScoreSum = 0;

  rows.forEach(r => {
    totalTopics++;
    const hasMaterial = parseInt(r.material_count || 0) > 0;
    const hasAssessment = parseInt(r.question_count || 0) > 0;

    if (hasMaterial) topicsWithMaterial++;
    if (hasAssessment) topicsWithAssessment++;

    // Deterministic Topic Coverage Formula:
    // - 50 points: Verified official material attached
    // - 50 points: Assessment questions created
    let topicCoverageScore = 0;
    if (hasMaterial) topicCoverageScore += 50;
    if (hasAssessment) topicCoverageScore += 50;
    totalScoreSum += topicCoverageScore;

    // Detect actionable gaps
    let gapType = null;
    let issue = null;
    let severity = 'LOW';

    if (!hasMaterial && !hasAssessment) {
      gapType = 'UNCOVERED';
      issue = `No official material and no assessment attached for topic.`;
      severity = 'CRITICAL';
      actionableGaps.push({
        unit_id: r.unit_id,
        unit_title: `Unit ${r.unit_number}: ${r.unit_title}`,
        lesson_id: r.lesson_id,
        lesson_title: r.lesson_title,
        topic_id: r.topic_id,
        topic_title: r.topic_title,
        gapType,
        issue,
        severity
      });
    } else if (!hasMaterial) {
      gapType = 'NO_MATERIAL';
      issue = `Assessment exists but official study material is missing.`;
      severity = 'HIGH';
      actionableGaps.push({
        unit_id: r.unit_id,
        unit_title: `Unit ${r.unit_number}: ${r.unit_title}`,
        lesson_id: r.lesson_id,
        lesson_title: r.lesson_title,
        topic_id: r.topic_id,
        topic_title: r.topic_title,
        gapType,
        issue,
        severity
      });
    } else if (!hasAssessment) {
      gapType = 'NO_ASSESSMENT';
      issue = `Official material attached, but no quiz questions have been generated.`;
      severity = 'MEDIUM';
      actionableGaps.push({
        unit_id: r.unit_id,
        unit_title: `Unit ${r.unit_number}: ${r.unit_title}`,
        lesson_id: r.lesson_id,
        lesson_title: r.lesson_title,
        topic_id: r.topic_id,
        topic_title: r.topic_title,
        gapType,
        issue,
        severity
      });
    }

    if (!unitMap[r.unit_id]) {
      unitMap[r.unit_id] = {
        unit_id: r.unit_id,
        unit_number: r.unit_number,
        unit_title: r.unit_title,
        totalTopicsCount: 0,
        coveredTopicsCount: 0,
        topicsWithMaterial: 0,
        topicsWithAssessment: 0,
        materialsCount: 0,
        assessmentsCount: 0,
        unitScoreSum: 0,
        topics: []
      };
    }

    const uObj = unitMap[r.unit_id];
    uObj.totalTopicsCount++;
    uObj.unitScoreSum += topicCoverageScore;
    if (hasMaterial) {
      uObj.topicsWithMaterial++;
      uObj.materialsCount += parseInt(r.material_count || 0);
    }
    if (hasAssessment) {
      uObj.topicsWithAssessment++;
      uObj.assessmentsCount += parseInt(r.quiz_count || 0);
    }
    if (hasMaterial && hasAssessment) {
      uObj.coveredTopicsCount++;
    }

    uObj.topics.push({
      topic_id: r.topic_id,
      topic_number: r.topic_number,
      topic_title: r.topic_title,
      lesson_id: r.lesson_id,
      lesson_title: r.lesson_title,
      hasMaterial,
      materialCount: parseInt(r.material_count || 0),
      sampleMaterialTitle: r.sample_material_title,
      hasAssessment,
      quizCount: parseInt(r.quiz_count || 0),
      questionCount: parseInt(r.question_count || 0),
      topicCoverageScore,
      gapType
    });
  });

  const units = Object.values(unitMap).map(u => ({
    unit_id: u.unit_id,
    unit_number: u.unit_number,
    unit_title: u.unit_title,
    totalTopicsCount: u.totalTopicsCount,
    coveredTopicsCount: u.coveredTopicsCount,
    materialsCount: u.materialsCount,
    assessmentsCount: u.assessmentsCount,
    materialCoverage: Math.round((u.topicsWithMaterial / u.totalTopicsCount) * 100),
    assessmentCoverage: Math.round((u.topicsWithAssessment / u.totalTopicsCount) * 100),
    unitCoverageScore: Math.round(u.unitScoreSum / u.totalTopicsCount),
    topics: u.topics
  })).sort((a, b) => a.unit_number - b.unit_number);

  const overallCoverageScore = totalTopics > 0 ? Math.round(totalScoreSum / totalTopics) : 0;
  const materialCoveragePercentage = totalTopics > 0 ? Math.round((topicsWithMaterial / totalTopics) * 100) : 0;
  const assessmentCoveragePercentage = totalTopics > 0 ? Math.round((topicsWithAssessment / totalTopics) * 100) : 0;

  return {
    subject: {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      semester: subject.semester,
      departmentName: subject.department_name
    },
    overallCoverageScore,
    summary: {
      totalUnits: units.length,
      totalTopics,
      coveredTopics: rows.filter(r => parseInt(r.material_count || 0) > 0 && parseInt(r.question_count || 0) > 0).length,
      topicsWithMaterial,
      topicsWithAssessment,
      materialCoveragePercentage,
      assessmentCoveragePercentage,
      overallCoveragePercentage: overallCoverageScore,
      criticalGapsCount: actionableGaps.filter(g => g.severity === 'CRITICAL').length,
      mediumGapsCount: actionableGaps.filter(g => g.severity === 'MEDIUM' || g.severity === 'HIGH').length
    },
    units,
    actionableGaps,
    formulaDescription: "Topic Coverage = (Material Signal: 50%) + (Assessment Signal: 50%). Subject Coverage = Average across all topic coverage scores."
  };
}

/**
 * GET /api/academic/subjects/:subjectId/syllabus-coverage
 */
exports.getSubjectSyllabusCoverage = async (req, res) => {
  const { subjectId } = req.params;
  const user = req.user;

  try {
    const coverage = await calculateSubjectCoverage(subjectId);
    if (!coverage) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    // RBAC: Verify department and institute isolation
    if (user.role !== 'SUPER_ADMIN') {
      const subRes = await db.query(
        `SELECT s.department_id, d.institute_id FROM subjects s JOIN departments d ON s.department_id = d.id WHERE s.id = $1`,
        [subjectId]
      );
      const sub = subRes.rows[0];
      if (user.institute_id && sub.institute_id !== user.institute_id) {
        return res.status(403).json({ error: 'Access denied to this institute subject.' });
      }
      if (user.role === 'HOD' && user.department_id && sub.department_id !== user.department_id) {
        return res.status(403).json({ error: 'Access denied: HOD cannot access subjects outside their department.' });
      }
    }

    res.json(coverage);
  } catch (err) {
    console.error('getSubjectSyllabusCoverage error:', err);
    res.status(500).json({ error: err.message || 'Failed to calculate syllabus coverage.' });
  }
};

exports.calculateSubjectCoverage = calculateSubjectCoverage;
