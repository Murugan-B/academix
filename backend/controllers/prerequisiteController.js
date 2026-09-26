const db = require('../db');

/**
 * Traverses prerequisite chains up to maxDepth and evaluates student performance for each prerequisite
 */
const analyzePrerequisitesForTopic = async (studentId, topicTag, subjectId = null, maxDepth = 4) => {
  // 1. Locate concept(s) matching topicTag by name or mapped topic title
  let conceptQuery = `
    SELECT c.* 
    FROM concepts c
    LEFT JOIN topics t ON c.topic_id = t.id
    WHERE (c.name ILIKE $1 OR (t.title IS NOT NULL AND t.title ILIKE $1))
  `;
  const params = [`%${topicTag}%`];

  if (subjectId) {
    conceptQuery += ` AND c.subject_id = $2`;
    params.push(subjectId);
  }

  let conceptRes = await db.query(conceptQuery, params);

  // If no direct phrase match, try significant keyword matching against concept ontology
  if (conceptRes.rowCount === 0) {
    const words = topicTag.split(/\s+/).filter(w => w.length > 3 && !['about', 'with', 'from', 'into', 'type', 'types', 'general'].includes(w.toLowerCase()));
    for (const word of words) {
      const wordParams = [`%${word}%`];
      let wordQuery = `
        SELECT c.* 
        FROM concepts c
        LEFT JOIN topics t ON c.topic_id = t.id
        WHERE (c.name ILIKE $1 OR (t.title IS NOT NULL AND t.title ILIKE $1))
      `;
      if (subjectId) {
        wordQuery += ` AND c.subject_id = $2`;
        wordParams.push(subjectId);
      }
      const wordRes = await db.query(wordQuery, wordParams);
      if (wordRes.rowCount > 0) {
        conceptRes = wordRes;
        break;
      }
    }
  }

  if (conceptRes.rowCount === 0) {
    return {
      hasPrerequisites: false,
      prerequisites: [],
      rootGap: null,
      recommendations: []
    };
  }

  const targetConcept = conceptRes.rows[0];

  // 2. BFS Traversal to collect all prerequisite concepts
  const visited = new Set([targetConcept.id]);
  const queue = [{ concept: targetConcept, depth: 0, chain: [targetConcept.name] }];
  const prerequisites = [];

  while (queue.length > 0) {
    const { concept: curr, depth, chain } = queue.shift();
    if (depth >= maxDepth) continue;

    // Find all concepts that are prerequisites of current concept:
    // (A -> PREREQUISITE_OF -> curr) OR (curr -> DEPENDS_ON -> A)
    const prereqRes = await db.query(
      `SELECT c.id, c.name, c.description, c.topic_id, cr.relationship_type, cr.status
       FROM concept_relationships cr
       JOIN concepts c ON cr.source_concept_id = c.id
       WHERE cr.target_concept_id = $1 AND cr.relationship_type IN ('PREREQUISITE_OF', 'DEPENDS_ON')
       UNION
       SELECT c.id, c.name, c.description, c.topic_id, cr.relationship_type, cr.status
       FROM concept_relationships cr
       JOIN concepts c ON cr.target_concept_id = c.id
       WHERE cr.source_concept_id = $1 AND cr.relationship_type = 'DEPENDS_ON'`,
      [curr.id]
    );

    for (const p of prereqRes.rows) {
      if (!visited.has(p.id)) {
        visited.add(p.id);
        const newChain = [...chain, p.name];

        // 3. Query student's performance on this prerequisite concept
        const perfRes = await db.query(
          `SELECT 
            COUNT(qaa.id) as total_questions,
            COUNT(CASE WHEN qaa.is_correct THEN 1 END) as correct_answers,
            MAX(qa.completed_at) as latest_attempt_date
           FROM quiz_attempt_answers qaa
           JOIN quiz_questions qq ON qaa.question_id = qq.id
           JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
           WHERE qa.student_id = $1 AND (qq.topic_tag ILIKE $2 OR qq.question ILIKE $2)`,
          [studentId, `%${p.name}%`]
        );

        const totalQ = parseInt(perfRes.rows[0].total_questions || 0);
        const correctQ = parseInt(perfRes.rows[0].correct_answers || 0);
        const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : null;
        const isTested = totalQ > 0;
        const isWeak = isTested ? accuracy < 60 : false;
        const isUnattempted = !isTested;

        const prereqData = {
          conceptId: p.id,
          conceptName: p.name,
          description: p.description,
          topicId: p.topic_id,
          relationshipType: p.relationship_type,
          depth: depth + 1,
          chain: newChain,
          isTested,
          isUnattempted,
          isWeak,
          totalQuestions: totalQ,
          correctAnswers: correctQ,
          accuracy,
          latestAttemptDate: perfRes.rows[0].latest_attempt_date
        };

        prerequisites.push(prereqData);
        queue.push({ concept: p, depth: depth + 1, chain: newChain });
      }
    }
  }

  // 4. Determine root learning gap (deepest/earliest prerequisite with lowest accuracy or unattempted foundational concept)
  let rootGap = null;
  const weakPrereqs = prerequisites.filter(p => p.isWeak);

  if (weakPrereqs.length > 0) {
    // Sort by depth descending (deepest foundational first), then accuracy ascending
    weakPrereqs.sort((a, b) => b.depth - a.depth || (a.accuracy || 0) - (b.accuracy || 0));
    rootGap = {
      ...weakPrereqs[0],
      reason: `Identified root knowledge gap (${weakPrereqs[0].accuracy}% accuracy in past quizzes)`
    };
  } else {
    const unattemptedPrereqs = prerequisites.filter(p => p.isUnattempted);
    if (unattemptedPrereqs.length > 0) {
      unattemptedPrereqs.sort((a, b) => b.depth - a.depth);
      rootGap = {
        ...unattemptedPrereqs[0],
        reason: 'Foundational prerequisite not yet assessed in quizzes'
      };
    }
  }

  // 5. Construct Recommended Step-by-Step Learning Progression
  const recommendedPath = [];
  if (rootGap) {
    recommendedPath.push({
      step: 1,
      action: 'FOUNDATIONAL_REVIEW',
      concept: rootGap.conceptName,
      reason: rootGap.isWeak 
        ? `Identified root knowledge gap (${rootGap.accuracy}% accuracy in past quizzes)` 
        : `Foundational prerequisite not yet assessed`
    });

    // Intermediate prerequisites if any
    const intermediates = prerequisites.filter(p => p.conceptId !== rootGap.conceptId && p.isWeak);
    intermediates.forEach((ip, idx) => {
      recommendedPath.push({
        step: idx + 2,
        action: 'INTERMEDIATE_PRACTICE',
        concept: ip.conceptName,
        reason: `Secondary prerequisite needing reinforcement (${ip.accuracy}% accuracy)`
      });
    });

    recommendedPath.push({
      step: recommendedPath.length + 1,
      action: 'TARGET_TOPIC_MASTERY',
      concept: targetConcept.name,
      reason: `Return to master target topic with strengthened conceptual foundations`
    });
  }

  const recommendations = recommendedPath.map(r => 
    `${r.action === 'FOUNDATIONAL_REVIEW' ? 'Revise foundational prerequisite' : r.action === 'INTERMEDIATE_PRACTICE' ? 'Practice' : 'Return to'}: ${r.concept} (${r.reason})`
  );

  return {
    hasPrerequisites: prerequisites.length > 0,
    targetConcept: {
      id: targetConcept.id,
      name: targetConcept.name,
      description: targetConcept.description
    },
    prerequisites,
    rootGap,
    recommendedPath,
    recommendations
  };
};

/**
 * GET /api/knowledge-graph/prerequisites/diagnose
 */
exports.diagnosePrerequisites = async (req, res) => {
  const studentId = req.user.id;
  const topicTag = req.query.topicTag || req.params.topicTag;
  const { subjectId } = req.query;

  if (!topicTag) {
    return res.status(400).json({ error: 'Topic tag is required.' });
  }

  try {
    const analysis = await analyzePrerequisitesForTopic(studentId, topicTag, subjectId);
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('diagnosePrerequisites error:', err);
    res.status(500).json({ error: err.message || 'Failed to diagnose prerequisites.' });
  }
};

/**
 * GET /api/knowledge-graph/prerequisites/attempt-diagnose/:attemptId
 */
exports.getAttemptPrerequisites = async (req, res) => {
  const studentId = req.user.id;
  const { attemptId } = req.params;

  try {
    // 1. Fetch attempt info and missed question topics
    const attemptRes = await db.query(
      `SELECT qa.id, qa.score, qa.percentage, qa.status, qa.correct_answers, qa.wrong_answers, qa.unanswered,
              q.question_count, s.id as subject_id, s.name as subject_name
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN materials m ON q.material_id = m.id
       LEFT JOIN topics t ON m.topic_id = t.id
       LEFT JOIN lessons l ON t.lesson_id = l.id
       LEFT JOIN units u ON l.unit_id = u.id
       LEFT JOIN subjects s ON u.subject_id = s.id
       WHERE qa.id = $1 AND (qa.student_id = $2 OR $3 IN ('FACULTY', 'HOD', 'INSTITUTE_ADMIN', 'SUPER_ADMIN'))`,
      [attemptId, studentId, req.user.role]
    );

    if (attemptRes.rowCount === 0) {
      return res.status(404).json({ error: 'Assessment attempt not found or access unauthorized.' });
    }

    const attempt = attemptRes.rows[0];

    // 2. Query questions and mistakes in this attempt
    const answersRes = await db.query(
      `SELECT qaa.is_correct, COALESCE(qq.topic_tag, t.title, 'General Concept') as topic_tag,
              t.title as parent_topic_title
       FROM quiz_attempt_answers qaa
       JOIN quiz_questions qq ON qaa.question_id = qq.id
       JOIN quizzes q ON qq.quiz_id = q.id
       JOIN materials m ON q.material_id = m.id
       LEFT JOIN topics t ON m.topic_id = t.id
       WHERE qaa.attempt_id = $1`,
      [attemptId]
    );

    // Group by topic to find mistaken topics
    const topicMap = {};
    answersRes.rows.forEach(r => {
      const tag = r.topic_tag;
      if (!topicMap[tag]) {
        topicMap[tag] = { topicTag: tag, parentTopicTitle: r.parent_topic_title, total: 0, correct: 0, wrong: 0 };
      }
      topicMap[tag].total++;
      if (r.is_correct) topicMap[tag].correct++;
      else topicMap[tag].wrong++;
    });

    const weakTopics = Object.values(topicMap).filter(t => t.wrong > 0);

    // 3. For each weak topic, analyze prerequisite chains
    const diagnosedTopics = [];
    for (const wt of weakTopics) {
      const accuracy = Math.round((wt.correct / wt.total) * 100);
      let analysis = await analyzePrerequisitesForTopic(studentId, wt.topicTag, attempt.subject_id);
      
      // Fallback to parent syllabus topic if sub-aspect tag has no prerequisite chain
      if (!analysis.hasPrerequisites && wt.parentTopicTitle && wt.parentTopicTitle !== wt.topicTag) {
        const parentAnalysis = await analyzePrerequisitesForTopic(studentId, wt.parentTopicTitle, attempt.subject_id);
        if (parentAnalysis.hasPrerequisites) {
          analysis = parentAnalysis;
        }
      }

      diagnosedTopics.push({
        topicTag: wt.topicTag,
        totalQuestions: wt.total,
        correctAnswers: wt.correct,
        wrongAnswers: wt.wrong,
        accuracy,
        ...analysis
      });
    }

    res.json({
      attemptId,
      subjectId: attempt.subject_id,
      subjectName: attempt.subject_name,
      percentage: attempt.percentage,
      status: attempt.status,
      weakTopicsCount: weakTopics.length,
      diagnosedTopics
    });
  } catch (err) {
    console.error('getAttemptPrerequisites error:', err);
    res.status(500).json({ error: err.message || 'Failed to diagnose attempt prerequisites.' });
  }
};

/**
 * GET /api/learning/prerequisites/:topicTag
 */
exports.getTopicPrerequisites = async (req, res) => {
  const studentId = req.user.id;
  const { topicTag } = req.params;
  const { subjectId } = req.query;

  try {
    const analysis = await analyzePrerequisitesForTopic(studentId, topicTag, subjectId);
    res.json(analysis);
  } catch (err) {
    console.error('getTopicPrerequisites error:', err);
    res.status(500).json({ error: err.message || 'Failed to detect prerequisites.' });
  }
};

exports.analyzePrerequisitesForTopic = analyzePrerequisitesForTopic;

