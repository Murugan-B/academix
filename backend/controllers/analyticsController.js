const db = require('../db');

exports.getStudentAnalytics = async (req, res) => {
  const studentId = req.user.id;
  try {
    const attempts = await db.query(`
      SELECT qa.*, q.title as quiz_title, m.title as material_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      WHERE qa.student_id = $1
      ORDER BY qa.completed_at DESC
    `, [studentId]);

    const recentAttempts = attempts.rows.slice(0, 5);

    // Fetch individual answers for the recent attempts
    for (let att of recentAttempts) {
      const ansRes = await db.query(`
        SELECT qaa.is_correct, qq.topic_tag, qq.question, qaa.selected_answer, qq.correct_answer
        FROM quiz_attempt_answers qaa
        JOIN quiz_questions qq ON qaa.question_id = qq.id
        WHERE qaa.attempt_id = $1
      `, [att.id]);
      att.answers = ansRes.rows;
    }

    const stats = {
      totalAttempts: attempts.rows.length,
      passed: attempts.rows.filter(a => a.status === 'PASSED').length,
      notPassed: attempts.rows.filter(a => a.status === 'NOT PASSED').length,
      averageScore: 0,
      bestScore: 0,
      recentAttempts
    };

    if (stats.totalAttempts > 0) {
      const sum = attempts.rows.reduce((acc, a) => acc + parseFloat(a.percentage), 0);
      stats.averageScore = Math.round(sum / stats.totalAttempts);
      stats.bestScore = Math.max(...attempts.rows.map(a => parseFloat(a.percentage)));
    }

    // Weak Topics
    const weakTopicsRes = await db.query(`
      SELECT qq.topic_tag, COUNT(*) as total_questions, SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as correct_answers
      FROM quiz_attempt_answers qaa
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      WHERE qa.student_id = $1
      GROUP BY qq.topic_tag
    `, [studentId]);

    stats.weakTopics = weakTopicsRes.rows.map(r => ({
      topic: r.topic_tag,
      percentage: Math.round((parseInt(r.correct_answers) / parseInt(r.total_questions)) * 100)
    })).filter(t => t.percentage <= 50).sort((a, b) => a.percentage - b.percentage).slice(0, 5);

    // Progress
    const materialsRes = await db.query('SELECT COUNT(*) FROM materials'); // Note: Global count vs enrolled count? Keep it simple for now.
    const completedMatRes = await db.query('SELECT COUNT(*) FROM student_material_progress WHERE student_id = $1', [studentId]);
    const quizzesRes = await db.query('SELECT COUNT(*) FROM quizzes');
    const completedQuizRes = await db.query('SELECT COUNT(DISTINCT quiz_id) FROM quiz_attempts WHERE student_id = $1 AND status = $2', [studentId, 'PASSED']);
    
    stats.progress = {
      materialsTotal: parseInt(materialsRes.rows[0].count),
      materialsCompleted: parseInt(completedMatRes.rows[0].count),
      quizzesTotal: parseInt(quizzesRes.rows[0].count),
      quizzesCompleted: parseInt(completedQuizRes.rows[0].count)
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMentorAnalytics = async (req, res) => {
  const { id: requesterId, role, department_id } = req.user;
  const { studentId } = req.params;
  
  try {
    // Authorization: Faculty must be the assigned mentor; HOD must share the student's department
    if (role === 'FACULTY') {
      const verifyRes = await db.query(
        'SELECT 1 FROM mentor_students WHERE mentor_id = $1 AND student_id = $2',
        [requesterId, studentId]
      );
      if (verifyRes.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view analytics for this student.' });
      }
    } else if (role === 'HOD') {
      // Verify the student belongs to the HOD's own department
      const verifyRes = await db.query(
        `SELECT 1 FROM users WHERE id = $1 AND role = 'STUDENT' AND department_id = $2`,
        [studentId, department_id]
      );
      if (verifyRes.rows.length === 0) {
        return res.status(403).json({ error: 'This student does not belong to your department.' });
      }
    } else {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    // Re-use logic but for the specific student
    const attempts = await db.query(`
      SELECT qa.*, q.title as quiz_title, m.title as material_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      WHERE qa.student_id = $1
      ORDER BY qa.completed_at DESC
    `, [studentId]);

    const recentAttempts = attempts.rows; // Give full history to mentor/HOD

    for (let att of recentAttempts) {
      const ansRes = await db.query(`
        SELECT qaa.is_correct, qq.topic_tag, qq.question, qaa.selected_answer, qq.correct_answer
        FROM quiz_attempt_answers qaa
        JOIN quiz_questions qq ON qaa.question_id = qq.id
        WHERE qaa.attempt_id = $1
      `, [att.id]);
      att.answers = ansRes.rows;
    }

    const stats = {
      totalAttempts: attempts.rows.length,
      passed: attempts.rows.filter(a => a.status === 'PASSED').length,
      notPassed: attempts.rows.filter(a => a.status === 'NOT PASSED').length,
      averageScore: 0,
      bestScore: 0,
      recentAttempts,
    };

    if (stats.totalAttempts > 0) {
      const sum = attempts.rows.reduce((acc, a) => acc + parseFloat(a.percentage), 0);
      stats.averageScore = Math.round(sum / stats.totalAttempts);
      stats.bestScore = Math.max(...attempts.rows.map(a => parseFloat(a.percentage)));
    }

    const weakTopicsRes = await db.query(`
      SELECT qq.topic_tag, COUNT(*) as total_questions, SUM(CASE WHEN qaa.is_correct THEN 1 ELSE 0 END) as correct_answers
      FROM quiz_attempt_answers qaa
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      WHERE qa.student_id = $1
      GROUP BY qq.topic_tag
    `, [studentId]);

    stats.weakTopics = weakTopicsRes.rows.map(r => ({
      topic: r.topic_tag,
      percentage: Math.round((parseInt(r.correct_answers) / parseInt(r.total_questions)) * 100)
    })).filter(t => t.percentage <= 50).sort((a, b) => a.percentage - b.percentage);

    const materialsRes = await db.query('SELECT COUNT(*) FROM materials');
    const completedMatRes = await db.query('SELECT COUNT(*) FROM student_material_progress WHERE student_id = $1', [studentId]);
    const quizzesRes = await db.query('SELECT COUNT(*) FROM quizzes');
    const completedQuizRes = await db.query('SELECT COUNT(DISTINCT quiz_id) FROM quiz_attempts WHERE student_id = $1 AND status = $2', [studentId, 'PASSED']);
    
    stats.progress = {
      materialsTotal: parseInt(materialsRes.rows[0].count),
      materialsCompleted: parseInt(completedMatRes.rows[0].count),
      quizzesTotal: parseInt(quizzesRes.rows[0].count),
      quizzesCompleted: parseInt(completedQuizRes.rows[0].count)
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
