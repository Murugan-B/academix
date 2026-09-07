const db = require('../db');
const aiService = require('../services/ai/aiService');
const textExtractor = require('../utils/textExtractor');

/**
 * Get student's weak topics analysis with multi-attempt trend detection
 */
exports.getStudentWeakTopics = async (req, res) => {
  const studentId = req.user.id;

  try {
    // 1. Fetch all quiz answers by this student with complete academic hierarchy
    const answersQuery = `
      SELECT 
        qaa.is_correct,
        qaa.selected_answer,
        qq.id as question_id,
        qq.question,
        qq.correct_answer,
        qq.explanation,
        qq.topic_tag,
        qa.id as attempt_id,
        qa.attempt_number,
        qa.percentage as attempt_percentage,
        qa.status as attempt_status,
        qa.completed_at,
        q.id as quiz_id,
        q.title as quiz_title,
        m.id as material_id,
        m.title as material_title,
        m.file_type as material_file_type,
        m.file_name as material_file_name,
        t.id as topic_id,
        t.title as topic_title,
        l.id as lesson_id,
        l.title as lesson_title,
        u.id as unit_id,
        u.title as unit_title,
        u.unit_number,
        s.id as subject_id,
        s.name as subject_name,
        s.code as subject_code
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      LEFT JOIN topics t ON m.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN subjects s ON u.subject_id = s.id
      WHERE qa.student_id = $1 AND qa.completed_at IS NOT NULL
      ORDER BY qa.completed_at ASC, qaa.id ASC
    `;

    const result = await db.query(answersQuery, [studentId]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.json({
        topicsToFocusOn: [],
        recentWeakTopics: [],
        improvingTopics: [],
        strongTopics: [],
        summary: {
          totalWeakTopics: 0,
          repeatedWeakCount: 0,
          improvingCount: 0,
          overallMastery: 0,
          totalAttempts: 0
        }
      });
    }

    // 2. Group answers by topic_tag
    const topicMap = {};
    let totalQuestionsAnswered = 0;
    let totalCorrectAnswers = 0;
    const attemptIdsSet = new Set();

    rows.forEach(row => {
      const tag = row.topic_tag || 'General';
      totalQuestionsAnswered++;
      if (row.is_correct) totalCorrectAnswers++;
      attemptIdsSet.add(row.attempt_id);

      if (!topicMap[tag]) {
        topicMap[tag] = {
          topicTag: tag,
          subjectName: row.subject_name || 'Academic Subject',
          subjectCode: row.subject_code || '',
          unitTitle: row.unit_title || '',
          unitNumber: row.unit_number || null,
          lessonTitle: row.lesson_title || '',
          topicTitle: row.topic_title || tag,
          materialId: row.material_id,
          materialTitle: row.material_title,
          materialFileType: row.material_file_type,
          materialFileName: row.material_file_name,
          totalQuestions: 0,
          correctAnswers: 0,
          attemptsMap: {}, // attempt_id -> { attempt_number, total, correct, completed_at }
          wrongQuestions: []
        };
      }

      const item = topicMap[tag];
      item.totalQuestions++;
      if (row.is_correct) {
        item.correctAnswers++;
      } else {
        // Collect wrong question details
        if (item.wrongQuestions.length < 5) {
          item.wrongQuestions.push({
            questionId: row.question_id,
            question: row.question,
            selected_answer: row.selected_answer,
            correct_answer: row.correct_answer,
            explanation: row.explanation
          });
        }
      }

      // Track by attempt
      if (!item.attemptsMap[row.attempt_id]) {
        item.attemptsMap[row.attempt_id] = {
          attemptId: row.attempt_id,
          attemptNumber: row.attempt_number,
          completedAt: row.completed_at,
          attemptStatus: row.attempt_status,
          total: 0,
          correct: 0
        };
      }
      item.attemptsMap[row.attempt_id].total++;
      if (row.is_correct) item.attemptsMap[row.attempt_id].correct++;
    });

    // 3. Classify topics
    const classifiedTopics = Object.values(topicMap).map(topic => {
      const overallAccuracy = Math.round((topic.correctAnswers / topic.totalQuestions) * 100);
      const attemptsList = Object.values(topic.attemptsMap).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
      const totalAttempts = attemptsList.length;

      const latestAttempt = attemptsList[attemptsList.length - 1];
      const latestAccuracy = latestAttempt ? Math.round((latestAttempt.correct / latestAttempt.total) * 100) : overallAccuracy;

      const previousAttempts = attemptsList.slice(0, -1);
      const hasPriorFailures = previousAttempts.some(att => (att.correct / att.total) <= 0.5);

      let category = 'STRONG';
      let priority = 'Low';
      let recommendationReason = 'Good understanding of this topic.';

      if (totalAttempts >= 2 && overallAccuracy <= 50) {
        category = 'REPEATED_WEAKNESS';
        priority = 'High';
        recommendationReason = `You have struggled with this topic across ${totalAttempts} quiz attempts. Focus on core concepts.`;
      } else if (latestAccuracy <= 50) {
        category = 'RECENT_FAILURE';
        priority = 'Medium';
        recommendationReason = `Needs review from your latest quiz attempt (scored ${latestAccuracy}% on this topic).`;
      } else if (hasPriorFailures && latestAccuracy > 50) {
        category = 'IMPROVING';
        priority = 'Low';
        recommendationReason = `Your performance is improving (${latestAccuracy}% in latest attempt). Keep practicing!`;
      } else if (overallAccuracy > 75) {
        category = 'STRONG';
        priority = 'None';
        recommendationReason = `Strong understanding (${overallAccuracy}% accuracy).`;
      } else {
        category = 'NEEDS_PRACTICE';
        priority = 'Medium';
        recommendationReason = `Moderate score (${overallAccuracy}%). Practice recommended for exam readiness.`;
      }

      return {
        ...topic,
        overallAccuracy,
        latestAccuracy,
        totalAttempts,
        category,
        priority,
        recommendationReason,
        attemptsCount: totalAttempts
      };
    });

    // 4. Filter lists for UI tabs and views
    const topicsToFocusOn = classifiedTopics
      .filter(t => ['REPEATED_WEAKNESS', 'RECENT_FAILURE', 'NEEDS_PRACTICE'].includes(t.category))
      .sort((a, b) => {
        // High priority first, then lowest accuracy
        const priorityOrder = { High: 3, Medium: 2, Low: 1, None: 0 };
        if (priorityOrder[b.priority] !== priorityOrder[a.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.overallAccuracy - b.overallAccuracy;
      });

    const recentWeakTopics = classifiedTopics.filter(t => t.category === 'RECENT_FAILURE');
    const improvingTopics = classifiedTopics.filter(t => t.category === 'IMPROVING');
    const strongTopics = classifiedTopics.filter(t => t.category === 'STRONG');

    const overallMastery = totalQuestionsAnswered > 0 ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) : 0;

    res.json({
      topicsToFocusOn,
      recentWeakTopics,
      improvingTopics,
      strongTopics,
      summary: {
        totalWeakTopics: topicsToFocusOn.length,
        repeatedWeakCount: classifiedTopics.filter(t => t.category === 'REPEATED_WEAKNESS').length,
        improvingCount: improvingTopics.length,
        strongCount: strongTopics.length,
        overallMastery,
        totalAttempts: attemptIdsSet.size
      }
    });
  } catch (err) {
    console.error('getStudentWeakTopics error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze weak topics.' });
  }
};

/**
 * Generate or fetch cached personalized learning content for a topic
 */
exports.generateLearningContent = async (req, res) => {
  const studentId = req.user.id;
  const { topicTag, materialId, provider = 'gemini', forceRefresh = false } = req.body;

  if (!topicTag) {
    return res.status(400).json({ error: 'topicTag is required.' });
  }

  try {
    // 1. Check cache first (unless forceRefresh requested)
    if (!forceRefresh) {
      const cacheRes = await db.query(
        `SELECT * FROM ai_learning_cache WHERE student_id = $1 AND topic_tag = $2 AND (material_id = $3 OR material_id IS NULL)`,
        [studentId, topicTag, materialId || null]
      );
      if (cacheRes.rowCount > 0) {
        console.log(`[AI LEARNING] Serving cached learning content for topic "${topicTag}"`);
        return res.json({
          success: true,
          cached: true,
          content: cacheRes.rows[0].content,
          provider: cacheRes.rows[0].provider,
          updated_at: cacheRes.rows[0].updated_at
        });
      }
    }

    // 2. Fetch Material
    let material = null;
    if (materialId) {
      const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
      if (matRes.rowCount > 0) material = matRes.rows[0];
    }

    if (!material) {
      // Find latest material associated with this topic tag from quiz questions
      const findMatRes = await db.query(`
        SELECT m.* FROM materials m
        JOIN quizzes q ON m.id = q.material_id
        JOIN quiz_questions qq ON q.id = qq.quiz_id
        WHERE qq.topic_tag = $1
        ORDER BY m.created_at DESC LIMIT 1
      `, [topicTag]);
      if (findMatRes.rowCount > 0) material = findMatRes.rows[0];
    }

    if (!material) {
      return res.status(404).json({ error: `Could not find academic material for topic "${topicTag}".` });
    }

    // 3. Extract text from material
    console.log(`[AI LEARNING] Extracting text for material: ${material.title} (${material.id})`);
    const { text: extractedText, fileType } = await textExtractor.extractTextFromMaterial(material);
    if (!extractedText || extractedText.trim().length < 40) {
      return res.status(400).json({ error: 'Academic material does not contain enough text for personalized learning.' });
    }

    // 4. Fetch wrong questions student answered for this topic
    const wrongQuestionsRes = await db.query(`
      SELECT qq.question, qaa.selected_answer, qq.correct_answer, qq.explanation
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      WHERE qa.student_id = $1 AND qq.topic_tag = $2 AND qaa.is_correct = false
      ORDER BY qa.completed_at DESC
      LIMIT 5
    `, [studentId, topicTag]);

    // 5. Generate learning content via AI Provider
    console.log(`[AI LEARNING] Calling provider "${provider}" for topic "${topicTag}"`);
    const learningContent = await aiService.generateLearningContent(
      provider,
      topicTag,
      extractedText,
      wrongQuestionsRes.rows,
      { fileType: fileType || material.file_type, title: material.title }
    );

    // 6. Save to cache
    await db.query(`
      INSERT INTO ai_learning_cache (student_id, topic_tag, material_id, content, provider, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (student_id, topic_tag, material_id)
      DO UPDATE SET content = $4, provider = $5, updated_at = NOW()
    `, [studentId, topicTag, material.id, JSON.stringify(learningContent), provider]);

    res.json({
      success: true,
      cached: false,
      content: learningContent,
      provider
    });
  } catch (err) {
    console.error('generateLearningContent error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate personalized learning content.' });
  }
};
