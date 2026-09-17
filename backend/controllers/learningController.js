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
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.correct_answer,
        qq.explanation,
        qq.topic_tag,
        qa.id as attempt_id,
        qa.attempt_number,
        qa.score as attempt_score,
        qa.percentage as attempt_percentage,
        qa.correct_answers as attempt_correct_answers,
        qa.wrong_answers as attempt_wrong_answers,
        qa.unanswered as attempt_unanswered,
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
      ORDER BY qa.completed_at DESC, qaa.id ASC
    `;

    const result = await db.query(answersQuery, [studentId]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.json({
        subjects: [],
        recentAssessments: [],
        topicsToFocusOn: [],
        recentWeakTopics: [],
        improvingTopics: [],
        strongTopics: [],
        summary: {
          totalSubjectsWithAssessments: 0,
          totalAssessments: 0,
          totalAttempts: 0,
          topicsNeedingAttention: 0,
          repeatedWeakCount: 0,
          improvingCount: 0,
          strongCount: 0,
          overallMastery: 0
        }
      });
    }

    // 2. Build Structured Academic Hierarchy: Subject -> Assessment -> Topic -> Attempts -> Questions
    const subjectMap = {};
    const globalTopicMap = {};
    let totalQuestionsAnswered = 0;
    let totalCorrectAnswers = 0;
    const allAttemptIds = new Set();
    const allQuizIds = new Set();

    rows.forEach(row => {
      totalQuestionsAnswered++;
      if (row.is_correct) totalCorrectAnswers++;
      allAttemptIds.add(row.attempt_id);
      allQuizIds.add(row.quiz_id);

      const subId = row.subject_id || 'general-subject';
      const subName = row.subject_name || 'Academic Subject';
      const subCode = row.subject_code || '';

      if (!subjectMap[subId]) {
        subjectMap[subId] = {
          subjectId: subId,
          subjectName: subName,
          subjectCode: subCode,
          latestAttemptDate: row.completed_at,
          totalAttempts: 0,
          quizzesMap: {}
        };
      }

      // Update subject latest attempt date if newer
      if (new Date(row.completed_at) > new Date(subjectMap[subId].latestAttemptDate)) {
        subjectMap[subId].latestAttemptDate = row.completed_at;
      }

      const qId = row.quiz_id;
      if (!subjectMap[subId].quizzesMap[qId]) {
        subjectMap[subId].quizzesMap[qId] = {
          quizId: qId,
          quizTitle: row.quiz_title || row.material_title || 'Quiz Assessment',
          materialId: row.material_id,
          materialTitle: row.material_title,
          materialFileType: row.material_file_type,
          materialFileName: row.material_file_name,
          unitTitle: row.unit_title,
          unitNumber: row.unit_number,
          lessonTitle: row.lesson_title,
          latestAttemptDate: row.completed_at,
          attemptsMap: {}, // attempt_id -> attempt object
          topicsMap: {}    // topic_tag -> topic performance object
        };
      }

      const quizObj = subjectMap[subId].quizzesMap[qId];
      if (new Date(row.completed_at) > new Date(quizObj.latestAttemptDate)) {
        quizObj.latestAttemptDate = row.completed_at;
      }

      // Track Quiz Attempts
      const attId = row.attempt_id;
      if (!quizObj.attemptsMap[attId]) {
        const isPassed = row.attempt_status === 'PASSED' || parseFloat(row.attempt_percentage) >= 60;
        const totalQ = parseInt(row.attempt_correct_answers || 0) + parseInt(row.attempt_wrong_answers || 0) + parseInt(row.attempt_unanswered || 0);
        quizObj.attemptsMap[attId] = {
          attemptId: attId,
          attemptNumber: row.attempt_number,
          score: row.attempt_score,
          percentage: Math.round(parseFloat(row.attempt_percentage)),
          accuracy: totalQ > 0 ? Math.round((parseInt(row.attempt_correct_answers || 0) / totalQ) * 100) : Math.round(parseFloat(row.attempt_percentage)),
          correctAnswers: parseInt(row.attempt_correct_answers || 0),
          wrongAnswers: parseInt(row.attempt_wrong_answers || 0),
          unanswered: parseInt(row.attempt_unanswered || 0),
          totalQuestions: totalQ,
          status: isPassed ? 'PASSED' : 'FAILED',
          completedAt: row.completed_at
        };
      }

      // Track Topic Performance under this Assessment
      const tag = row.topic_tag || 'General';
      if (!quizObj.topicsMap[tag]) {
        quizObj.topicsMap[tag] = {
          topicTag: tag,
          topicTitle: row.topic_title || tag,
          materialId: row.material_id,
          materialTitle: row.material_title,
          unitTitle: row.unit_title,
          unitNumber: row.unit_number,
          lessonTitle: row.lesson_title,
          subjectName: subName,
          subjectCode: subCode,
          quizId: qId,
          quizTitle: quizObj.quizTitle,
          totalQuestions: 0,
          correctAnswers: 0,
          attemptsMap: {}, // attempt_id -> { attempt_number, total, correct, completed_at }
          wrongQuestions: []
        };
      }

      const topicObj = quizObj.topicsMap[tag];
      topicObj.totalQuestions++;
      if (row.is_correct) {
        topicObj.correctAnswers++;
      } else {
        const opts = { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d };
        if (topicObj.wrongQuestions.length < 8) {
          topicObj.wrongQuestions.push({
            questionId: row.question_id,
            question: row.question,
            selected_answer: row.selected_answer,
            selected_answer_text: row.selected_answer ? opts[row.selected_answer] || null : 'Not Answered',
            correct_answer: row.correct_answer,
            correct_answer_text: opts[row.correct_answer] || null,
            explanation: (row.explanation && row.explanation.trim()) ? row.explanation.trim() : null,
            attemptNumber: row.attempt_number,
            completedAt: row.completed_at
          });
        }
      }

      if (!topicObj.attemptsMap[attId]) {
        topicObj.attemptsMap[attId] = {
          attemptId: attId,
          attemptNumber: row.attempt_number,
          completedAt: row.completed_at,
          total: 0,
          correct: 0
        };
      }
      topicObj.attemptsMap[attId].total++;
      if (row.is_correct) topicObj.attemptsMap[attId].correct++;

      // Also maintain global topic aggregation for summary & backward compatibility
      if (!globalTopicMap[tag]) {
        globalTopicMap[tag] = {
          topicTag: tag,
          topicTitle: row.topic_title || tag,
          materialId: row.material_id,
          materialTitle: row.material_title,
          subjectName: subName,
          subjectCode: subCode,
          unitTitle: row.unit_title,
          unitNumber: row.unit_number,
          totalQuestions: 0,
          correctAnswers: 0,
          attemptsMap: {}
        };
      }
      globalTopicMap[tag].totalQuestions++;
      if (row.is_correct) globalTopicMap[tag].correctAnswers++;
      if (!globalTopicMap[tag].attemptsMap[attId]) {
        globalTopicMap[tag].attemptsMap[attId] = {
          attemptId: attId,
          completedAt: row.completed_at,
          total: 0,
          correct: 0
        };
      }
      globalTopicMap[tag].attemptsMap[attId].total++;
      if (row.is_correct) globalTopicMap[tag].attemptsMap[attId].correct++;
    });

    // 3. Helper to classify topic performance and generate grounded AI recommendations
    const classifyAndEnrichTopic = (topic) => {
      const overallAccuracy = Math.round((topic.correctAnswers / topic.totalQuestions) * 100);
      const attemptsList = Object.values(topic.attemptsMap).sort(
        (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
      );
      const totalAttempts = attemptsList.length;

      const firstAttempt = attemptsList[0];
      const latestAttempt = attemptsList[attemptsList.length - 1];

      const firstAccuracy = firstAttempt ? Math.round((firstAttempt.correct / firstAttempt.total) * 100) : overallAccuracy;
      const latestAccuracy = latestAttempt ? Math.round((latestAttempt.correct / latestAttempt.total) * 100) : overallAccuracy;
      const bestAccuracy = Math.max(...attemptsList.map(a => Math.round((a.correct / a.total) * 100)));

      const previousAttempts = attemptsList.slice(0, -1);
      const hasPriorFailures = previousAttempts.some(att => (att.correct / att.total) < 0.6);

      let category = 'STRONG';
      let priority = 'Low';
      let aiRecommendation = `Strong understanding of ${topic.topicTag} (${overallAccuracy}% accuracy). Continue with application-based questions to maintain mastery.`;

      if (totalAttempts >= 2 && overallAccuracy <= 50) {
        category = 'REPEATED_WEAKNESS';
        priority = 'High';
        aiRecommendation = `Struggling across ${totalAttempts} attempts (${overallAccuracy}% accuracy). Revise core concepts and fundamentals from "${topic.materialTitle || topic.subjectName}" before retaking this assessment.`;
      } else if (latestAccuracy < 60) {
        category = 'RECENT_FAILURE';
        priority = 'Medium';
        aiRecommendation = `Scored ${latestAccuracy}% in your latest attempt. Review your recent incorrect answers and key definitions before practicing again.`;
      } else if (hasPriorFailures && latestAccuracy >= 60) {
        category = 'IMPROVING';
        priority = 'Low';
        aiRecommendation = `Performance is improving (${latestAccuracy}% in latest attempt, up from ${firstAccuracy}%). Practice intermediate problem sets to solidify mastery.`;
      } else if (overallAccuracy >= 75) {
        category = 'STRONG';
        priority = 'None';
        aiRecommendation = `Strong mastery demonstrated (${overallAccuracy}% accuracy). Ready for advanced exam questions.`;
      } else {
        category = 'NEEDS_PRACTICE';
        priority = 'Medium';
        aiRecommendation = `Moderate grasp (${overallAccuracy}% accuracy). Practice additional sample questions and review key concepts for better retention.`;
      }

      const attemptsHistory = attemptsList.map(a => {
        const acc = a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0;
        return {
          attemptId: a.attemptId,
          attemptNumber: a.attemptNumber,
          score: acc,
          accuracy: acc,
          correct: a.correct,
          total: a.total,
          status: acc >= 60 ? 'Passed' : 'Failed',
          completedAt: a.completedAt
        };
      }).reverse(); // newest first for display

      return {
        ...topic,
        overallAccuracy,
        latestAccuracy,
        firstAccuracy,
        bestAccuracy,
        totalAttempts,
        category,
        priority,
        aiRecommendation,
        recommendationReason: aiRecommendation,
        attemptsHistory
      };
    };

    // 4. Assemble Subjects & Assessments Hierarchy
    const subjects = Object.values(subjectMap).map(sub => {
      const assessments = Object.values(sub.quizzesMap).map(quiz => {
        const attempts = Object.values(quiz.attemptsMap).sort(
          (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
        );
        const attemptsCount = attempts.length;
        const firstAttempt = attempts[0] || {};
        const latestAttempt = attempts[attempts.length - 1] || {};
        const bestScore = Math.max(...attempts.map(a => a.percentage), 0);
        const passedAttempt = attempts.find(a => a.status === 'PASSED' || a.percentage >= 60);

        // Classify all topics inside this assessment
        const topics = Object.values(quiz.topicsMap)
          .map(t => classifyAndEnrichTopic(t))
          .sort((a, b) => {
            const prio = { High: 3, Medium: 2, Low: 1, None: 0 };
            if (prio[b.priority] !== prio[a.priority]) return prio[b.priority] - prio[a.priority];
            return a.overallAccuracy - b.overallAccuracy;
          });

        return {
          quizId: quiz.quizId,
          quizTitle: quiz.quizTitle,
          materialId: quiz.materialId,
          materialTitle: quiz.materialTitle,
          materialFileType: quiz.materialFileType,
          materialFileName: quiz.materialFileName,
          unitTitle: quiz.unitTitle,
          unitNumber: quiz.unitNumber,
          lessonTitle: quiz.lessonTitle,
          attemptsCount,
          firstScore: firstAttempt.percentage || 0,
          latestScore: latestAttempt.percentage || 0,
          bestScore,
          status: passedAttempt ? 'Cleared' : 'Not Cleared',
          clearedOnAttempt: passedAttempt ? passedAttempt.attemptNumber : null,
          latestAttemptDate: quiz.latestAttemptDate,
          attempts: [...attempts].reverse(), // newest first
          topics
        };
      }).sort((a, b) => new Date(b.latestAttemptDate) - new Date(a.latestAttemptDate));

      const totalSubjectAttempts = assessments.reduce((acc, q) => acc + q.attemptsCount, 0);

      return {
        subjectId: sub.subjectId,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        totalAssessments: assessments.length,
        totalAttempts: totalSubjectAttempts,
        latestAttemptDate: sub.latestAttemptDate,
        assessments
      };
    }).sort((a, b) => new Date(b.latestAttemptDate) - new Date(a.latestAttemptDate));

    // 5. Recent completed assessments (latest 1-2 attempts)
    const recentRes = await db.query(`
      SELECT 
        qa.id as attempt_id,
        qa.attempt_number,
        qa.score,
        qa.percentage,
        qa.correct_answers,
        qa.wrong_answers,
        qa.unanswered,
        qa.status as attempt_status,
        qa.completed_at,
        q.id as quiz_id,
        q.title as quiz_title,
        m.title as material_title,
        t.title as topic_title,
        s.name as subject_name,
        s.code as subject_code
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      LEFT JOIN topics t ON m.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN subjects s ON u.subject_id = s.id
      WHERE qa.student_id = $1 AND qa.completed_at IS NOT NULL
      ORDER BY qa.completed_at DESC
      LIMIT 2
    `, [studentId]);

    const recentAssessments = recentRes.rows.map(r => ({
      attemptId: r.attempt_id,
      quizId: r.quiz_id,
      quizTitle: r.quiz_title || r.material_title,
      subjectName: r.subject_name || 'Academic Subject',
      subjectCode: r.subject_code || '',
      topicTitle: r.topic_title || 'General',
      attemptNumber: r.attempt_number,
      score: r.score,
      percentage: Math.round(parseFloat(r.percentage)),
      status: r.attempt_status === 'PASSED' || parseFloat(r.percentage) >= 60 ? 'Cleared' : 'Failed',
      completedAt: r.completed_at
    }));

    // 6. Global Classified Topics for backward compatibility & filtering
    const classifiedGlobalTopics = Object.values(globalTopicMap).map(t => classifyAndEnrichTopic(t));
    const topicsToFocusOn = classifiedGlobalTopics
      .filter(t => ['REPEATED_WEAKNESS', 'RECENT_FAILURE', 'NEEDS_PRACTICE'].includes(t.category))
      .sort((a, b) => {
        const prio = { High: 3, Medium: 2, Low: 1, None: 0 };
        if (prio[b.priority] !== prio[a.priority]) return prio[b.priority] - prio[a.priority];
        return a.overallAccuracy - b.overallAccuracy;
      });

    const recentWeakTopics = classifiedGlobalTopics.filter(t => t.category === 'RECENT_FAILURE');
    const improvingTopics = classifiedGlobalTopics.filter(t => t.category === 'IMPROVING');
    const strongTopics = classifiedGlobalTopics.filter(t => t.category === 'STRONG');
    const overallMastery = totalQuestionsAnswered > 0 ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) : 0;

    res.json({
      subjects,
      recentAssessments,
      topicsToFocusOn,
      recentWeakTopics,
      improvingTopics,
      strongTopics,
      summary: {
        totalSubjectsWithAssessments: subjects.length,
        totalAssessments: allQuizIds.size,
        totalAttempts: allAttemptIds.size,
        topicsNeedingAttention: topicsToFocusOn.length,
        repeatedWeakCount: classifiedGlobalTopics.filter(t => t.category === 'REPEATED_WEAKNESS').length,
        improvingCount: improvingTopics.length,
        strongCount: strongTopics.length,
        overallMastery
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

/**
 * Generate Flashcards from Topic Material
 */
exports.generateFlashcards = async (req, res) => {
  const studentId = req.user.id;
  const { topicTag, materialId, provider = 'gemini' } = req.body;

  if (!topicTag) {
    return res.status(400).json({ error: 'topicTag is required.' });
  }

  try {
    let material = null;
    if (materialId) {
      const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
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

    if (!material) {
      return res.status(404).json({ error: `Could not find academic material for topic "${topicTag}".` });
    }

    const { text: extractedText } = await textExtractor.extractTextFromMaterial(material);
    const flashcards = await aiService.generateFlashcards(provider, topicTag, extractedText);

    res.json({
      success: true,
      topic: topicTag,
      flashcards
    });
  } catch (err) {
    console.error('generateFlashcards error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate flashcards.' });
  }
};

/**
 * Generate Personalized AI Study Plan
 */
exports.generateStudyPlan = async (req, res) => {
  const studentId = req.user.id;
  const { provider = 'gemini', targetExam = 'Upcoming Exams', studyHoursPerDay = 2 } = req.body;

  try {
    const userRes = await db.query('SELECT name, department_id FROM users WHERE id = $1', [studentId]);
    const student = userRes.rows[0];

    // Fetch student's weak and strong topics
    const topicsRes = await db.query(`
      SELECT qq.topic_tag, 
             COUNT(*) as total, 
             SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as correct
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      WHERE qa.student_id = $1
      GROUP BY qq.topic_tag
    `, [studentId]);

    const weakTopics = [];
    const strongTopics = [];

    topicsRes.rows.forEach(r => {
      const accuracy = (parseInt(r.correct) / parseInt(r.total)) * 100;
      if (accuracy < 60) weakTopics.push({ topic: r.topic_tag, accuracy: Math.round(accuracy) });
      else strongTopics.push({ topic: r.topic_tag, accuracy: Math.round(accuracy) });
    });

    const studentProfile = {
      name: student?.name || 'Student',
      examName: targetExam,
      studyHoursPerDay
    };

    const studyPlan = await aiService.generateStudyPlan(provider, studentProfile, weakTopics, strongTopics);

    res.json({
      success: true,
      studyPlan
    });
  } catch (err) {
    console.error('generateStudyPlan error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate study plan.' });
  }
};

/**
 * Generate 2-minute Smart Revision
 */
exports.generateSmartRevision = async (req, res) => {
  const studentId = req.user.id;
  const { topicTag, materialId, provider = 'gemini' } = req.body;

  if (!topicTag) {
    return res.status(400).json({ error: 'topicTag is required.' });
  }

  try {
    let material = null;
    if (materialId) {
      const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
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

    if (!material) {
      return res.status(404).json({ error: `Could not find material for topic "${topicTag}".` });
    }

    const { text: extractedText } = await textExtractor.extractTextFromMaterial(material);

    const wrongQuestionsRes = await db.query(`
      SELECT qq.question, qq.correct_answer
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      WHERE qa.student_id = $1 AND qq.topic_tag = $2 AND qaa.is_correct = false
      ORDER BY qa.completed_at DESC
      LIMIT 3
    `, [studentId, topicTag]);

    const revision = await aiService.generateSmartRevision(provider, topicTag, extractedText, wrongQuestionsRes.rows);

    res.json({
      success: true,
      revision
    });
  } catch (err) {
    console.error('generateSmartRevision error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate smart revision.' });
  }
};

/**
 * Semantic Academic Search
 */
exports.semanticSearch = async (req, res) => {
  const userId = req.user.id;
  const { q } = req.query;

  if (!q || !q.trim()) {
    return res.json({ results: [] });
  }

  try {
    const userRes = await db.query('SELECT department_id, institute_id, role FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    let querySql = `
      SELECT m.id as material_id, m.title as material_title, m.file_name, m.file_type,
             t.id as topic_id, t.title as topic_title,
             l.id as lesson_id, l.title as lesson_title,
             u.id as unit_id, u.title as unit_title, u.unit_number,
             s.id as subject_id, s.name as subject_name, s.code as subject_code
      FROM materials m
      LEFT JOIN topics t ON m.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN subjects s ON u.subject_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE (m.title ILIKE $1 OR t.title ILIKE $1 OR s.name ILIKE $1 OR m.extracted_text ILIKE $1)
    `;
    const params = [`%${q.trim()}%`];

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'INSTITUTE_ADMIN') {
      querySql += ` AND s.department_id = $2`;
      params.push(user.department_id);
    }

    querySql += ` LIMIT 15`;

    const result = await db.query(querySql, params);
    res.json({ results: result.rows });
  } catch (err) {
    console.error('semanticSearch error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
};
