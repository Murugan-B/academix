const db = require('../db');
const aiService = require('../services/ai/aiService');
const textExtractor = require('../utils/textExtractor');

exports.getQuiz = async (req, res) => {
  const { materialId } = req.params;
  try {
    const quizRes = await db.query('SELECT * FROM quizzes WHERE material_id = $1', [materialId]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found for this material' });
    }
    
    const quiz = quizRes.rows[0];
    const qRes = await db.query('SELECT id, question, option_a, option_b, option_c, option_d, topic_tag FROM quiz_questions WHERE quiz_id = $1 ORDER BY id', [quiz.id]);
    quiz.questions = qRes.rows;
    
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.generateQuiz = async (req, res) => {
  const { materialId } = req.params;
  const { provider = 'gemini' } = req.body || {};
  
  try {
    // Check if quiz already exists — return it instead of erroring
    const existing = await db.query('SELECT * FROM quizzes WHERE material_id = $1', [materialId]);
    if (existing.rows.length > 0) {
      const existingQuiz = existing.rows[0];
      const existingQRes = await db.query(
        'SELECT id, question, option_a, option_b, option_c, option_d, topic_tag FROM quiz_questions WHERE quiz_id = $1 ORDER BY id',
        [existingQuiz.id]
      );
      existingQuiz.questions = existingQRes.rows;
      return res.status(200).json({ message: 'Quiz already exists', quizId: existingQuiz.id, questionCount: existingQRes.rows.length, quiz: existingQuiz });
    }

    // Fetch material
    const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
    if (matRes.rows.length === 0) return res.status(404).json({ error: 'Material not found' });
    
    const material = matRes.rows[0];
    
    // Extract text from material
    const { text: extractedText } = await textExtractor.extractTextFromMaterial(material);
    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({ error: 'Not enough readable text found in the material to generate a quiz.' });
    }
    
    // Call AI to generate quiz
    const quizData = await aiService.generateQuiz(provider, extractedText);
    
    // Insert into DB transactionally
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const qRes = await client.query(
        `INSERT INTO quizzes (material_id, title, description, question_count, generated_by_model) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [material.id, `Quiz for ${material.title}`, 'AI Generated Quiz', quizData.length, provider]
      );
      const quizId = qRes.rows[0].id;
      
      for (const q of quizData) {
        await client.query(
          `INSERT INTO quiz_questions 
           (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, topic_tag) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [quizId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation, q.topic_tag || 'General']
        );
      }
      
      await client.query('COMMIT');
      res.status(201).json({ message: 'Quiz generated successfully', quizId, questionCount: quizData.length });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.startAttempt = async (req, res) => {
  const { quizId } = req.params;
  const studentId = req.user.id;
  
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get quiz & material
      const quizRes = await client.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
      if (quizRes.rows.length === 0) throw new Error('Quiz not found');
      const quiz = quizRes.rows[0];

      // Get all questions currently in the pool for this quiz
      const qRes = await client.query('SELECT id, question, option_a, option_b, option_c, option_d, topic_tag FROM quiz_questions WHERE quiz_id = $1', [quizId]);
      const allQuestions = qRes.rows;

      // Get questions the student has already answered in previous attempts for this quiz
      const answeredRes = await client.query(`
        SELECT DISTINCT qaa.question_id 
        FROM quiz_attempt_answers qaa
        JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
        WHERE qa.quiz_id = $1 AND qa.student_id = $2
      `, [quizId, studentId]);
      const answeredIds = new Set(answeredRes.rows.map(r => r.question_id));

      let unusedQuestions = allQuestions.filter(q => !answeredIds.has(q.id));

      // If we don't have enough unused questions, generate more
      if (unusedQuestions.length < 10) {
        // Fetch material text
        const matRes = await client.query('SELECT * FROM materials WHERE id = $1', [quiz.material_id]);
        const material = matRes.rows[0];
        const { text: extractedText } = await textExtractor.extractTextFromMaterial(material);
        
        const existingQuestionsText = allQuestions.map(q => q.question).join('\\n');
        
        // Use AI to generate more unique questions
        const newQuestionsData = await aiService.generateMoreQuestions(quiz.generated_by_model || 'gemini', extractedText, existingQuestionsText);
        
        // Insert new questions into the pool
        const newlyInserted = [];
        for (const q of newQuestionsData) {
          const insertRes = await client.query(
            `INSERT INTO quiz_questions 
             (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, topic_tag) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, question, option_a, option_b, option_c, option_d, topic_tag`,
            [quizId, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation, q.topic_tag || 'General']
          );
          newlyInserted.push(insertRes.rows[0]);
        }
        
        unusedQuestions = [...unusedQuestions, ...newlyInserted];
      }

      // Randomly select 10 questions from the unused pool
      // Shuffle array and pick first 10
      const shuffled = unusedQuestions.sort(() => 0.5 - Math.random());
      const selectedQuestions = shuffled.slice(0, 10);
      
      const countRes = await client.query('SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2', [quizId, studentId]);
      const attemptNumber = parseInt(countRes.rows[0].count) + 1;
      
      const attemptRes = await client.query(
        `INSERT INTO quiz_attempts (quiz_id, student_id, attempt_number, score, percentage, correct_answers, wrong_answers, unanswered, status, started_at) 
         VALUES ($1, $2, $3, 0, 0, 0, 0, 0, 'NOT PASSED', CURRENT_TIMESTAMP) RETURNING id`,
        [quizId, studentId, attemptNumber]
      );
      const attemptId = attemptRes.rows[0].id;

      // Preemptively bind these 10 questions to the attempt so they are immutable
      for (const q of selectedQuestions) {
        await client.query(
          `INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_answer, is_correct) VALUES ($1, $2, NULL, false)`,
          [attemptId, q.id]
        );
      }
      
      await client.query('COMMIT');
      res.status(201).json({ attemptId, attemptNumber, quizId, questions: selectedQuestions });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitAttempt = async (req, res) => {
  const { attemptId } = req.params;
  const { answers } = req.body; // { questionId: 'A' }
  const studentId = req.user.id;
  
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const attemptRes = await client.query('SELECT * FROM quiz_attempts WHERE id = $1 AND student_id = $2', [attemptId, studentId]);
      if (attemptRes.rows.length === 0) throw new Error('Attempt not found');
      const attempt = attemptRes.rows[0];
      
      const quizRes = await client.query('SELECT * FROM quizzes WHERE id = $1', [attempt.quiz_id]);
      const quiz = quizRes.rows[0];
      
      // Fetch ONLY the questions bound to this attempt
      const qRes = await client.query(`
        SELECT qq.*, qaa.id as qaa_id 
        FROM quiz_questions qq 
        JOIN quiz_attempt_answers qaa ON qq.id = qaa.question_id 
        WHERE qaa.attempt_id = $1
      `, [attemptId]);
      const questions = qRes.rows;
      
      let correct = 0, wrong = 0, unanswered = 0;
      const topicStats = {};
      
      for (const q of questions) {
        if (!topicStats[q.topic_tag]) {
          topicStats[q.topic_tag] = { total: 0, correct: 0 };
        }
        topicStats[q.topic_tag].total++;
        
        const selected = answers[q.id];
        let isCorrect = false;
        if (!selected) {
          unanswered++;
        } else if (selected === q.correct_answer) {
          correct++;
          isCorrect = true;
          topicStats[q.topic_tag].correct++;
        } else {
          wrong++;
        }
        
        // Update the preemptively inserted row
        await client.query(
          `UPDATE quiz_attempt_answers SET selected_answer = $1, is_correct = $2 WHERE id = $3`,
          [selected || null, isCorrect, q.qaa_id]
        );
      }
      
      const total = questions.length;
      const percentage = (correct / total) * 100;
      const status = percentage >= 60 ? 'PASSED' : 'NOT PASSED';
      
      // Calculate weak/strong topics
      const weakTopics = [];
      const strongTopics = [];
      for (const topic in topicStats) {
        const t = topicStats[topic];
        const p = (t.correct / t.total) * 100;
        if (p <= 50) weakTopics.push(topic);
        else strongTopics.push(topic);
      }
      
      // Request AI Recommendation
      const recommendation = await aiService.generateRecommendation(quiz.generated_by_model || 'gemini', {
        quizTitle: quiz.title,
        score: correct,
        total,
        percentage,
        wrongTopics: weakTopics,
        correctTopics: strongTopics
      });
      
      await client.query(
        `UPDATE quiz_attempts SET score = $1, percentage = $2, correct_answers = $3, wrong_answers = $4, unanswered = $5, status = $6, completed_at = CURRENT_TIMESTAMP, ai_recommendation = $7 WHERE id = $8`,
        [correct, percentage, correct, wrong, unanswered, status, recommendation, attemptId]
      );
      
      await client.query('COMMIT');
      res.json({ message: 'Submitted', score: correct, percentage, status, weakTopics, recommendation, attemptId });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAttemptHistory = async (req, res) => {
  const { materialId } = req.params;
  const studentId = req.user.id;
  try {
    const result = await db.query(`
      SELECT qa.*, q.title as quiz_title 
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE q.material_id = $1 AND qa.student_id = $2
      ORDER BY qa.attempt_number DESC
    `, [materialId, studentId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAttemptDetails = async (req, res) => {
  const { attemptId } = req.params;
  try {
    // Join quiz + material so the review page has titles without extra round-trips
    const attemptRes = await db.query(`
      SELECT qa.*, q.title as quiz_title, m.title as material_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN materials m ON q.material_id = m.id
      WHERE qa.id = $1
    `, [attemptId]);
    if (attemptRes.rows.length === 0) return res.status(404).json({error: 'Attempt not found'});
    
    const ansRes = await db.query(`
      SELECT qaa.*, qq.question, qq.correct_answer, qq.explanation, qq.topic_tag, qq.option_a, qq.option_b, qq.option_c, qq.option_d 
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      WHERE qaa.attempt_id = $1
      ORDER BY qq.id
    `, [attemptId]);
    
    const attempt = attemptRes.rows[0];
    attempt.answers = ansRes.rows;
    res.json(attempt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
