const db = require('../db');

/**
 * Helper to verify mentor/HOD/Admin authorization for a given student
 */
const verifyStudentAccess = async (requester, studentId) => {
  const { id: requesterId, role, department_id, institute_id } = requester;

  const studentRes = await db.query(
    `SELECT u.id, u.name, u.email, u.roll_number, u.batch_start_year, u.batch_end_year, 
            u.department_id, u.institute_id,
            d.name as department_name, 
            m.name as mentor_name, m.id as mentor_id
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN mentor_students ms ON u.id = ms.student_id
     LEFT JOIN users m ON ms.mentor_id = m.id
     WHERE u.id = $1 AND u.role = 'STUDENT'`,
    [studentId]
  );

  if (studentRes.rowCount === 0) {
    const err = new Error('Student not found.');
    err.status = 404;
    throw err;
  }

  const student = studentRes.rows[0];

  if (role === 'SUPER_ADMIN') {
    return student;
  }

  if (role === 'INSTITUTE_ADMIN') {
    if (student.institute_id !== institute_id) {
      const err = new Error('Unauthorized: Student belongs to another institute.');
      err.status = 403;
      throw err;
    }
    return student;
  }

  if (role === 'HOD') {
    if (student.department_id !== department_id) {
      const err = new Error('Unauthorized: Student does not belong to your department.');
      err.status = 403;
      throw err;
    }
    return student;
  }

  if (role === 'FACULTY' || role === 'MENTOR') {
    const mentorCheck = await db.query(
      'SELECT 1 FROM mentor_students WHERE mentor_id = $1 AND student_id = $2',
      [requesterId, studentId]
    );
    if (mentorCheck.rowCount === 0) {
      const err = new Error('Unauthorized: You can only view assessments for your assigned mentees.');
      err.status = 403;
      throw err;
    }
    return student;
  }

  const err = new Error('Unauthorized access.');
  err.status = 403;
  throw err;
};

/**
 * 1. GET Student Overview & Assessment Statistics
 */
exports.getStudentOverview = async (req, res) => {
  const { studentId } = req.params;

  try {
    const student = await verifyStudentAccess(req.user, studentId);

    // Fetch all completed quiz attempts
    const attemptsRes = await db.query(`
      SELECT qa.id, qa.quiz_id, qa.attempt_number, qa.score, qa.percentage, 
             qa.correct_answers, qa.wrong_answers, qa.unanswered, qa.status, 
             qa.started_at, qa.completed_at
      FROM quiz_attempts qa
      WHERE qa.student_id = $1 AND qa.completed_at IS NOT NULL
      ORDER BY qa.completed_at ASC
    `, [studentId]);

    const attempts = attemptsRes.rows;
    const totalAttempts = attempts.length;

    // Distinct quizzes attempted
    const quizIdsSet = new Set(attempts.map(a => a.quiz_id));
    const totalAssessmentsAttempted = quizIdsSet.size;

    // Distinct quizzes cleared (at least 1 PASSED attempt)
    const passedQuizIdsSet = new Set(
      attempts.filter(a => a.status === 'PASSED' || parseFloat(a.percentage) >= 60).map(a => a.quiz_id)
    );
    const totalAssessmentsCleared = passedQuizIdsSet.size;
    const totalFailedAssessments = totalAssessmentsAttempted - totalAssessmentsCleared;

    let totalQuestionsAttempted = 0;
    let totalCorrectAnswers = 0;
    let sumPercentage = 0;
    let bestScore = 0;
    let latestScore = 0;
    let latestAttemptDate = null;

    if (totalAttempts > 0) {
      attempts.forEach(a => {
        const pct = parseFloat(a.percentage);
        sumPercentage += pct;
        if (pct > bestScore) bestScore = pct;
        totalQuestionsAttempted += (parseInt(a.correct_answers) + parseInt(a.wrong_answers) + parseInt(a.unanswered || 0));
        totalCorrectAnswers += parseInt(a.correct_answers);
      });

      const latestAttempt = attempts[attempts.length - 1];
      latestScore = parseFloat(latestAttempt.percentage);
      latestAttemptDate = latestAttempt.completed_at;
    }

    const averageScore = totalAttempts > 0 ? Math.round(sumPercentage / totalAttempts) : 0;
    const overallAccuracy = totalQuestionsAttempted > 0 
      ? Math.round((totalCorrectAnswers / totalQuestionsAttempted) * 100) 
      : 0;

    // Calculate academic year
    const currentYear = new Date().getFullYear();
    let year = 'N/A';
    if (student.batch_start_year) {
      let diff = currentYear - student.batch_start_year;
      if (new Date().getMonth() >= 7) diff += 1;
      year = diff === 1 ? '1st Year' : diff === 2 ? '2nd Year' : diff === 3 ? '3rd Year' : diff >= 4 ? '4th Year' : 'Incoming';
    }

    // Recent 1-2 completed assessments
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

    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        rollNumber: student.roll_number || 'N/A',
        department: student.department_name || 'N/A',
        year,
        batch: student.batch_start_year ? `${student.batch_start_year} - ${student.batch_end_year}` : 'N/A',
        mentor: student.mentor_name || 'Not Assigned',
        mentorId: student.mentor_id
      },
      stats: {
        totalAssessmentsAttempted,
        totalAssessmentAttempts: totalAttempts,
        totalAssessmentsCleared,
        totalFailedAssessments,
        overallAccuracy,
        averageScore,
        bestScore: Math.round(bestScore),
        latestScore: Math.round(latestScore),
        latestAttemptDate
      },
      recentAssessments
    });
  } catch (err) {
    console.error('getStudentOverview error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch student overview.' });
  }
};

/**
 * 2. GET Assessment Summary (Per-quiz aggregation)
 */
exports.getAssessmentSummary = async (req, res) => {
  const { studentId } = req.params;

  try {
    await verifyStudentAccess(req.user, studentId);

    const summaryQuery = `
      SELECT 
        qa.id as attempt_id,
        qa.attempt_number,
        qa.percentage,
        qa.score,
        qa.correct_answers,
        qa.wrong_answers,
        qa.unanswered,
        qa.status as attempt_status,
        qa.completed_at,
        q.id as quiz_id,
        q.title as quiz_title,
        m.id as material_id,
        m.title as material_title,
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
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      LEFT JOIN topics t ON m.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN subjects s ON u.subject_id = s.id
      WHERE qa.student_id = $1 AND qa.completed_at IS NOT NULL
      ORDER BY q.id ASC, qa.attempt_number ASC
    `;

    const result = await db.query(summaryQuery, [studentId]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.json({ assessments: [] });
    }

    // Group by quiz_id
    const quizMap = {};

    rows.forEach(row => {
      const quizId = row.quiz_id;
      if (!quizMap[quizId]) {
        quizMap[quizId] = {
          quizId,
          quizTitle: row.quiz_title,
          materialId: row.material_id,
          materialTitle: row.material_title,
          subjectName: row.subject_name || 'Academic Subject',
          subjectCode: row.subject_code || '',
          unitTitle: row.unit_title || '',
          unitNumber: row.unit_number || null,
          lessonTitle: row.lesson_title || '',
          topicTitle: row.topic_title || 'General Topic',
          attempts: []
        };
      }

      quizMap[quizId].attempts.push({
        attemptId: row.attempt_id,
        attemptNumber: row.attempt_number,
        percentage: parseFloat(row.percentage),
        score: row.score,
        correctAnswers: parseInt(row.correct_answers),
        wrongAnswers: parseInt(row.wrong_answers),
        unanswered: parseInt(row.unanswered || 0),
        status: row.attempt_status,
        completedAt: row.completed_at
      });
    });

    // Format assessment summaries
    const assessments = Object.values(quizMap).map(item => {
      const atts = item.attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);
      const attemptsCount = atts.length;
      const firstAttempt = atts[0];
      const latestAttempt = atts[atts.length - 1];

      const firstScore = Math.round(firstAttempt.percentage);
      const latestScore = Math.round(latestAttempt.percentage);
      const bestScore = Math.round(Math.max(...atts.map(a => a.percentage)));

      // Find the first attempt where status === 'PASSED' (or percentage >= 60)
      const clearedAttempt = atts.find(a => a.status === 'PASSED' || a.percentage >= 60);
      const isCleared = !!clearedAttempt;
      const clearedOnAttempt = clearedAttempt ? clearedAttempt.attemptNumber : null;
      const status = isCleared ? 'Cleared' : 'Not Cleared';

      const totalQuestions = latestAttempt.correctAnswers + latestAttempt.wrongAnswers + latestAttempt.unanswered;
      const accuracy = totalQuestions > 0 ? Math.round((latestAttempt.correctAnswers / totalQuestions) * 100) : 0;
      const improvement = latestScore - firstScore;

      return {
        quizId: item.quizId,
        quizTitle: item.quizTitle,
        materialId: item.materialId,
        materialTitle: item.materialTitle,
        subjectName: item.subjectName,
        subjectCode: item.subjectCode,
        unitTitle: item.unitTitle,
        unitNumber: item.unitNumber,
        lessonTitle: item.lessonTitle,
        topicTitle: item.topicTitle,
        attemptsCount,
        firstScore,
        latestScore,
        bestScore,
        totalQuestions,
        correctAnswers: latestAttempt.correctAnswers,
        wrongAnswers: latestAttempt.wrongAnswers,
        accuracy,
        isCleared,
        clearedOnAttempt,
        status,
        improvement,
        latestAttemptDate: latestAttempt.completedAt,
        history: atts
      };
    });

    res.json({ assessments });
  } catch (err) {
    console.error('getAssessmentSummary error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch assessment summary.' });
  }
};

/**
 * 3. GET Complete Assessment History (Flat Chronological List)
 */
exports.getAssessmentHistory = async (req, res) => {
  const { studentId } = req.params;

  try {
    await verifyStudentAccess(req.user, studentId);

    const historyQuery = `
      SELECT 
        qa.id as attempt_id,
        qa.attempt_number,
        qa.score,
        qa.percentage,
        qa.correct_answers,
        qa.wrong_answers,
        qa.unanswered,
        qa.status as attempt_status,
        qa.started_at,
        qa.completed_at,
        q.id as quiz_id,
        q.title as quiz_title,
        m.id as material_id,
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
    `;

    const result = await db.query(historyQuery, [studentId]);
    
    const attempts = result.rows.map(row => ({
      attemptId: row.attempt_id,
      attemptNumber: row.attempt_number,
      quizId: row.quiz_id,
      quizTitle: row.quiz_title,
      materialId: row.material_id,
      materialTitle: row.material_title,
      subjectName: row.subject_name || 'Subject',
      subjectCode: row.subject_code || '',
      topicTitle: row.topic_title || 'General',
      score: row.score,
      percentage: Math.round(parseFloat(row.percentage)),
      correctAnswers: parseInt(row.correct_answers),
      wrongAnswers: parseInt(row.wrong_answers),
      unanswered: parseInt(row.unanswered || 0),
      totalQuestions: parseInt(row.correct_answers) + parseInt(row.wrong_answers) + parseInt(row.unanswered || 0),
      status: row.attempt_status === 'PASSED' || parseFloat(row.percentage) >= 60 ? 'PASSED' : 'FAILED',
      startedAt: row.started_at,
      completedAt: row.completed_at
    }));

    res.json({ history: attempts, attempts });
  } catch (err) {
    console.error('getAssessmentHistory error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch assessment history.' });
  }
};

/**
 * 4. GET Detailed Attempt Analysis (Question-level breakdown)
 */
exports.getAttemptDetail = async (req, res) => {
  const { studentId, attemptId } = req.params;

  try {
    await verifyStudentAccess(req.user, studentId);

    // 1. Fetch Attempt & Quiz Metadata
    const attemptRes = await db.query(`
      SELECT 
        qa.id as attempt_id,
        qa.attempt_number,
        qa.score,
        qa.percentage,
        qa.correct_answers,
        qa.wrong_answers,
        qa.unanswered,
        qa.status,
        qa.started_at,
        qa.completed_at,
        q.id as quiz_id,
        q.title as quiz_title,
        m.id as material_id,
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
      WHERE qa.id = $1 AND qa.student_id = $2
    `, [attemptId, studentId]);

    if (attemptRes.rowCount === 0) {
      return res.status(404).json({ error: 'Assessment attempt not found.' });
    }

    const attempt = attemptRes.rows[0];

    // 2. Fetch all bound questions and student answers
    const questionsRes = await db.query(`
      SELECT 
        qq.id as question_id,
        qq.question,
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.correct_answer,
        qq.explanation,
        qq.topic_tag,
        qaa.selected_answer,
        qaa.is_correct
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      WHERE qaa.attempt_id = $1
      ORDER BY qaa.id ASC
    `, [attemptId]);

    const questions = questionsRes.rows.map((q, idx) => {
      const options = {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d
      };

      return {
        questionNumber: idx + 1,
        questionId: q.question_id,
        questionText: q.question,
        options,
        selectedAnswer: q.selected_answer,
        selectedAnswerText: q.selected_answer ? options[q.selected_answer] || null : 'Not Answered',
        correctAnswer: q.correct_answer,
        correctAnswerText: options[q.correct_answer] || null,
        isCorrect: !!q.is_correct,
        topicTag: q.topic_tag || 'General',
        unitTitle: attempt.unit_title || null,
        lessonTitle: attempt.lesson_title || null,
        explanation: (q.explanation && q.explanation.trim()) ? q.explanation.trim() : null
      };
    });

    const totalQuestions = questions.length;
    const accuracy = totalQuestions > 0 ? Math.round((parseInt(attempt.correct_answers) / totalQuestions) * 100) : 0;

    // Aggregate topic performance specifically for this attempt
    const topicMap = {};
    questions.forEach(q => {
      const tag = q.topicTag || 'General';
      if (!topicMap[tag]) {
        topicMap[tag] = {
          topicTag: tag,
          totalQuestions: 0,
          correctCount: 0,
          wrongCount: 0
        };
      }
      topicMap[tag].totalQuestions++;
      if (q.isCorrect) {
        topicMap[tag].correctCount++;
      } else {
        topicMap[tag].wrongCount++;
      }
    });

    const topicsCovered = Object.values(topicMap).map(t => ({
      ...t,
      accuracy: t.totalQuestions > 0 ? Math.round((t.correctCount / t.totalQuestions) * 100) : 0
    }));

    res.json({
      attempt: {
        attemptId: attempt.attempt_id,
        attemptNumber: attempt.attempt_number,
        quizId: attempt.quiz_id,
        quizTitle: attempt.quiz_title,
        materialTitle: attempt.material_title,
        subjectName: attempt.subject_name || 'Academic Subject',
        subjectCode: attempt.subject_code || '',
        topicTitle: attempt.topic_title || 'General',
        unitTitle: attempt.unit_title || '',
        lessonTitle: attempt.lesson_title || '',
        percentage: Math.round(parseFloat(attempt.percentage)),
        score: attempt.score,
        correctAnswers: parseInt(attempt.correct_answers),
        wrongAnswers: parseInt(attempt.wrong_answers),
        unanswered: parseInt(attempt.unanswered || 0),
        totalQuestions,
        accuracy,
        status: attempt.status === 'PASSED' || parseFloat(attempt.percentage) >= 60 ? 'PASSED' : 'FAILED',
        startedAt: attempt.started_at,
        completedAt: attempt.completed_at
      },
      topicsCovered,
      questions
    });
  } catch (err) {
    console.error('getAttemptDetail error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch attempt details.' });
  }
};

/**
 * 4b. GET Student Subjects with Nested Assessments and Attempts
 */
exports.getStudentSubjects = async (req, res) => {
  const { studentId } = req.params;

  try {
    await verifyStudentAccess(req.user, studentId);

    const query = `
      SELECT 
        s.id as subject_id,
        s.name as subject_name,
        s.code as subject_code,
        u.id as unit_id,
        u.title as unit_title,
        q.id as quiz_id,
        q.title as quiz_title,
        m.id as material_id,
        m.title as material_title,
        t.title as topic_title,
        qa.id as attempt_id,
        qa.attempt_number,
        qa.score,
        qa.percentage,
        qa.correct_answers,
        qa.wrong_answers,
        qa.unanswered,
        qa.status as attempt_status,
        qa.completed_at
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      LEFT JOIN topics t ON m.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN subjects s ON u.subject_id = s.id
      WHERE qa.student_id = $1 AND qa.completed_at IS NOT NULL
      ORDER BY s.name ASC, q.id ASC, qa.attempt_number ASC
    `;

    const result = await db.query(query, [studentId]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.json({ subjects: [] });
    }

    const subjectMap = {};

    rows.forEach(r => {
      const subId = r.subject_id || 'general-subject';
      if (!subjectMap[subId]) {
        subjectMap[subId] = {
          subjectId: subId,
          subjectName: r.subject_name || 'Academic Subject',
          subjectCode: r.subject_code || '',
          totalAttempts: 0,
          quizzesMap: {}
        };
      }

      subjectMap[subId].totalAttempts++;

      const quizId = r.quiz_id;
      if (!subjectMap[subId].quizzesMap[quizId]) {
        subjectMap[subId].quizzesMap[quizId] = {
          quizId,
          quizTitle: r.quiz_title,
          materialTitle: r.material_title,
          topicTitle: r.topic_title || 'General',
          unitTitle: r.unit_title || '',
          attempts: []
        };
      }

      const isPassed = r.attempt_status === 'PASSED' || parseFloat(r.percentage) >= 60;
      const totalQ = parseInt(r.correct_answers) + parseInt(r.wrong_answers) + parseInt(r.unanswered || 0);
      const acc = totalQ > 0 ? Math.round((parseInt(r.correct_answers) / totalQ) * 100) : Math.round(parseFloat(r.percentage));

      subjectMap[subId].quizzesMap[quizId].attempts.push({
        attemptId: r.attempt_id,
        attemptNumber: r.attempt_number,
        score: r.score,
        percentage: Math.round(parseFloat(r.percentage)),
        accuracy: acc,
        correctAnswers: parseInt(r.correct_answers),
        wrongAnswers: parseInt(r.wrong_answers),
        unanswered: parseInt(r.unanswered || 0),
        totalQuestions: totalQ,
        status: isPassed ? 'PASSED' : 'FAILED',
        completedAt: r.completed_at
      });
    });

    const subjects = Object.values(subjectMap).map(sub => {
      const assessments = Object.values(sub.quizzesMap).map(quiz => {
        const attempts = quiz.attempts;
        const attemptsCount = attempts.length;
        const firstAttempt = attempts[0] || {};
        const latestAttempt = attempts[attempts.length - 1] || {};
        const bestPercentage = Math.max(...attempts.map(a => a.percentage), 0);
        const passedAttempt = attempts.find(a => a.status === 'PASSED' || a.percentage >= 60);

        return {
          quizId: quiz.quizId,
          quizTitle: quiz.quizTitle,
          materialTitle: quiz.materialTitle,
          topicTitle: quiz.topicTitle,
          unitTitle: quiz.unitTitle,
          attemptsCount,
          firstScore: firstAttempt.percentage || 0,
          latestScore: latestAttempt.percentage || 0,
          bestScore: bestPercentage,
          status: passedAttempt ? 'Cleared' : 'Not Cleared',
          clearedOnAttempt: passedAttempt ? passedAttempt.attemptNumber : null,
          latestAttemptDate: latestAttempt.completedAt,
          attempts
        };
      });

      return {
        subjectId: sub.subjectId,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        totalAttempts: sub.totalAttempts,
        totalAssessments: assessments.length,
        assessments
      };
    });

    res.json({ subjects });
  } catch (err) {
    console.error('getStudentSubjects error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch student subjects.' });
  }
};

/**
 * 4c. GET Recent 1-2 completed assessments
 */
exports.getRecentAssessments = async (req, res) => {
  const { studentId } = req.params;

  try {
    await verifyStudentAccess(req.user, studentId);

    const query = `
      SELECT 
        qa.id as attempt_id,
        qa.attempt_number,
        qa.score,
        qa.percentage,
        qa.correct_answers,
        qa.wrong_answers,
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
    `;

    const result = await db.query(query, [studentId]);
    const recent = result.rows.map(r => ({
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

    res.json({ recentAssessments: recent });
  } catch (err) {
    console.error('getRecentAssessments error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch recent assessments.' });
  }
};

/**
 * 5. GET Mistake Analysis (Grouped by Topic)
 */
exports.getMistakeAnalysis = async (req, res) => {
  const { studentId } = req.params;

  try {
    await verifyStudentAccess(req.user, studentId);

    const mistakesQuery = `
      SELECT 
        qaa.selected_answer,
        qaa.is_correct,
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
        qa.completed_at,
        q.title as quiz_title,
        s.name as subject_name
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      LEFT JOIN topics t ON m.topic_id = t.id
      LEFT JOIN lessons l ON t.lesson_id = l.id
      LEFT JOIN units u ON l.unit_id = u.id
      LEFT JOIN subjects s ON u.subject_id = s.id
      WHERE qa.student_id = $1 AND qa.completed_at IS NOT NULL AND qaa.is_correct = false
      ORDER BY qq.topic_tag ASC, qa.completed_at DESC
    `;

    const result = await db.query(mistakesQuery, [studentId]);
    const rows = result.rows;

    if (rows.length === 0) {
      return res.json({ topicMistakes: [], topics: [], totalMistakes: 0 });
    }

    const topicMap = {};

    rows.forEach(r => {
      const tag = r.topic_tag || 'General';
      if (!topicMap[tag]) {
        topicMap[tag] = {
          topicTag: tag,
          subjectName: r.subject_name || 'Academic Subject',
          mistakesCount: 0,
          mistakes: []
        };
      }

      const options = {
        A: r.option_a,
        B: r.option_b,
        C: r.option_c,
        D: r.option_d
      };

      topicMap[tag].mistakesCount++;
      topicMap[tag].mistakes.push({
        questionId: r.question_id,
        questionText: r.question,
        selectedAnswer: r.selected_answer,
        selectedAnswerText: r.selected_answer ? options[r.selected_answer] || 'Not Answered' : 'Not Answered',
        correctAnswer: r.correct_answer,
        correctAnswerText: options[r.correct_answer] || null,
        explanation: r.explanation || '',
        attemptId: r.attempt_id,
        attemptNumber: r.attempt_number,
        quizTitle: r.quiz_title,
        completedAt: r.completed_at
      });
    });

    const topicMistakes = Object.values(topicMap).map(tm => ({
      ...tm,
      questions: tm.mistakes
    })).sort((a, b) => b.mistakesCount - a.mistakesCount);

    res.json({
      totalMistakes: rows.length,
      topicMistakes,
      topics: topicMistakes
    });
  } catch (err) {
    console.error('getMistakeAnalysis error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch mistake analysis.' });
  }
};

/**
 * 6. GET Topic-wise Performance & AI Learning Connections
 */
exports.getTopicPerformance = async (req, res) => {
  const { studentId } = req.params;

  try {
    await verifyStudentAccess(req.user, studentId);

    const answersQuery = `
      SELECT 
        qaa.is_correct,
        qq.id as question_id,
        qq.question,
        qq.correct_answer,
        qq.explanation,
        qq.topic_tag,
        qa.id as attempt_id,
        qa.attempt_number,
        qa.completed_at,
        m.id as material_id,
        m.title as material_title,
        m.file_type as material_file_type,
        t.title as topic_title,
        u.title as unit_title,
        u.unit_number,
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
      return res.json({ topics: [] });
    }

    const topicMap = {};

    rows.forEach(row => {
      const tag = row.topic_tag || 'General';
      if (!topicMap[tag]) {
        topicMap[tag] = {
          topicTag: tag,
          subjectName: row.subject_name || 'Academic Subject',
          subjectCode: row.subject_code || '',
          unitTitle: row.unit_title || '',
          unitNumber: row.unit_number || null,
          materialId: row.material_id,
          materialTitle: row.material_title,
          totalQuestions: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          attemptsMap: {} // attempt_id -> { correct, total, completed_at }
        };
      }

      const item = topicMap[tag];
      item.totalQuestions++;
      if (row.is_correct) {
        item.correctAnswers++;
      } else {
        item.incorrectAnswers++;
      }

      if (!item.attemptsMap[row.attempt_id]) {
        item.attemptsMap[row.attempt_id] = {
          correct: 0,
          total: 0,
          completedAt: row.completed_at
        };
      }
      item.attemptsMap[row.attempt_id].total++;
      if (row.is_correct) item.attemptsMap[row.attempt_id].correct++;
    });

    const topics = Object.values(topicMap).map(topic => {
      const attemptsList = Object.values(topic.attemptsMap).sort(
        (a, b) => new Date(a.completedAt) - new Date(b.completedAt)
      );

      const totalAttempts = attemptsList.length;
      const overallAccuracy = Math.round((topic.correctAnswers / topic.totalQuestions) * 100);

      const firstAttempt = attemptsList[0];
      const latestAttempt = attemptsList[attemptsList.length - 1];

      const firstPerformance = firstAttempt ? Math.round((firstAttempt.correct / firstAttempt.total) * 100) : overallAccuracy;
      const latestPerformance = latestAttempt ? Math.round((latestAttempt.correct / latestAttempt.total) * 100) : overallAccuracy;
      const bestPerformance = Math.max(...attemptsList.map(a => Math.round((a.correct / a.total) * 100)));

      const improvement = latestPerformance - firstPerformance;
      const failedAttemptsCount = attemptsList.filter(a => (a.correct / a.total) < 0.6).length;

      let category = 'STRONG';
      let priority = 'Low';
      let recommendationReason = 'Good understanding of this topic.';

      if (totalAttempts >= 2 && overallAccuracy <= 50) {
        category = 'REPEATED_WEAKNESS';
        priority = 'High';
        recommendationReason = `Struggled with this topic across ${totalAttempts} quiz attempts. Needs targeted review.`;
      } else if (latestPerformance <= 50) {
        category = 'RECENT_FAILURE';
        priority = 'Medium';
        recommendationReason = `Needs review from latest quiz attempt (${latestPerformance}% score).`;
      } else if (failedAttemptsCount > 0 && latestPerformance >= 60) {
        category = 'IMPROVING';
        priority = 'Low';
        recommendationReason = `Performance is improving (${latestPerformance}% in latest attempt).`;
      } else if (overallAccuracy >= 75) {
        category = 'STRONG';
        priority = 'None';
        recommendationReason = `Solid mastery (${overallAccuracy}% accuracy).`;
      } else {
        category = 'NEEDS_PRACTICE';
        priority = 'Medium';
        recommendationReason = `Moderate performance (${overallAccuracy}%). Practice recommended for exam readiness.`;
      }

      return {
        topicTag: topic.topicTag,
        subjectName: topic.subjectName,
        subjectCode: topic.subjectCode,
        unitTitle: topic.unitTitle,
        unitNumber: topic.unitNumber,
        materialId: topic.materialId,
        materialTitle: topic.materialTitle,
        totalQuestions: topic.totalQuestions,
        correctAnswers: topic.correctAnswers,
        incorrectAnswers: topic.incorrectAnswers,
        accuracy: overallAccuracy,
        firstPerformance,
        latestPerformance,
        bestPerformance,
        improvement,
        failedAttemptsCount,
        totalAttempts,
        category,
        priority,
        recommendationReason
      };
    }).sort((a, b) => {
      const prio = { High: 3, Medium: 2, Low: 1, None: 0 };
      if (prio[b.priority] !== prio[a.priority]) return prio[b.priority] - prio[a.priority];
      return a.accuracy - b.accuracy;
    });

    res.json({ topics });
  } catch (err) {
    console.error('getTopicPerformance error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch topic performance.' });
  }
};
