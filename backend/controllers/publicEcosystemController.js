const db = require('../db');
const { validateExternalResourceUrl } = require('../utils/urlValidators');
const usageLedgerService = require('../services/ai/usageLedgerService');
const conversationalService = require('../services/ai/conversationalService');
const AIService = require('../services/ai/aiService');

// ─────────────────────────────────────────────────────────────────────────────
// 1. PUBLIC COMMUNITY COURSE FOLDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search and list public community courses with approved resource counts
 */
exports.getPublicCourses = async (req, res) => {
  const { query, category } = req.query;

  try {
    const conditions = [];
    const params = [];

    if (query && typeof query === 'string' && query.trim()) {
      params.push(`%${query.trim()}%`);
      conditions.push(`(pc.name ILIKE $${params.length} OR pc.description ILIKE $${params.length})`);
    }

    if (category) {
      params.push(category);
      conditions.push(`pc.category = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT 
        pc.id,
        pc.name,
        pc.description,
        pc.category,
        pc.created_at,
        u.name as creator_name,
        COUNT(sr.id) FILTER (WHERE sr.status = 'APPROVED' AND sr.is_public = TRUE) as resource_count
      FROM public_courses pc
      LEFT JOIN users u ON pc.created_by = u.id
      LEFT JOIN student_resources sr ON sr.public_course_id = pc.id
      ${whereClause}
      GROUP BY pc.id, u.name
      ORDER BY resource_count DESC, pc.name ASC
      LIMIT 100
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Get public courses error:', err);
    res.status(500).json({ message: 'Failed to retrieve public community courses.' });
  }
};

/**
 * Create a new public community course folder with normalized deduplication
 */
exports.createPublicCourse = async (req, res) => {
  const { name, description, category = 'COMMUNITY' } = req.body;
  const userId = req.user?.id;

  try {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Course name is required.' });
    }

    const trimmedName = name.trim();
    const normalized = trimmedName.toLowerCase().replace(/\s+/g, ' ');

    // Check existing course with same normalized name
    const existing = await db.query(
      `SELECT id, name, description, category FROM public_courses WHERE normalized_name = $1`,
      [normalized]
    );

    if (existing.rowCount > 0) {
      return res.status(200).json({
        message: 'Course folder already exists.',
        course: existing.rows[0],
        isExisting: true
      });
    }

    const insertRes = await db.query(
      `INSERT INTO public_courses (name, normalized_name, description, category, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, category, created_at`,
      [trimmedName, normalized, description?.trim() || null, category, userId]
    );

    res.status(201).json({
      message: 'Public course folder created successfully.',
      course: insertRes.rows[0],
      isExisting: false
    });
  } catch (err) {
    console.error('Create public course error:', err);
    res.status(500).json({ message: 'Failed to create public course folder.' });
  }
};

/**
 * Get public course folder details and all approved resources within it
 */
exports.getPublicCourseDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const courseRes = await db.query(
      `SELECT pc.id, pc.name, pc.description, pc.category, pc.created_at, u.name as creator_name
       FROM public_courses pc
       LEFT JOIN users u ON pc.created_by = u.id
       WHERE pc.id = $1`,
      [id]
    );

    if (courseRes.rowCount === 0) {
      return res.status(404).json({ message: 'Public course folder not found.' });
    }

    const resourcesRes = await db.query(
      `SELECT 
        sr.id,
        sr.title,
        sr.description,
        sr.tags,
        sr.file_name,
        sr.file_url,
        sr.file_type,
        sr.file_size,
        sr.external_url,
        sr.external_provider,
        sr.external_metadata,
        sr.created_at,
        u.name as contributor_name
       FROM student_resources sr
       LEFT JOIN users u ON sr.uploaded_by = u.id
       WHERE sr.public_course_id = $1 AND sr.status = 'APPROVED' AND sr.is_public = TRUE
       ORDER BY sr.created_at DESC`,
      [id]
    );

    res.json({
      course: courseRes.rows[0],
      resources: resourcesRes.rows
    });
  } catch (err) {
    console.error('Get public course details error:', err);
    res.status(500).json({ message: 'Failed to retrieve course details.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. COMMUNITY CONTRIBUTION SYSTEM (Uploads & External Links)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public User or Student Contributes an Academic Material (Pending Approval)
 */
exports.contributeMaterial = async (req, res) => {
  const userId = req.user.id;
  const {
    title,
    description,
    tags,
    courseCategoryType = 'COMMUNITY_COURSE', // 'INSTITUTE_SEMESTER' | 'COMMUNITY_COURSE'
    publicCourseId,
    newCourseName,
    departmentId,
    semester,
    subjectId,
    unitId,
    lessonId,
    topicId,
    resourceType = 'DOCUMENT', // 'DOCUMENT' | 'GOOGLE_DRIVE' | 'YOUTUBE' | 'EXTERNAL_LINK'
    externalUrl
  } = req.body;

  try {
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Resource title is required.' });
    }

    let parsedTags = [];
    if (Array.isArray(tags)) {
      parsedTags = tags;
    } else if (typeof tags === 'string') {
      parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    let effectivePublicCourseId = publicCourseId || null;

    // If Community Course and creating on the fly
    if (courseCategoryType === 'COMMUNITY_COURSE' && !effectivePublicCourseId && newCourseName) {
      const normalized = newCourseName.trim().toLowerCase().replace(/\s+/g, ' ');
      const existing = await db.query(`SELECT id FROM public_courses WHERE normalized_name = $1`, [normalized]);
      if (existing.rowCount > 0) {
        effectivePublicCourseId = existing.rows[0].id;
      } else {
        const createCourse = await db.query(
          `INSERT INTO public_courses (name, normalized_name, category, created_by)
           VALUES ($1, $2, 'COMMUNITY', $3) RETURNING id`,
          [newCourseName.trim(), normalized, userId]
        );
        effectivePublicCourseId = createCourse.rows[0].id;
      }
    }

    // Handle Uploaded File vs External URL
    let fileName = null;
    let fileUrl = null;
    let fileType = null;
    let fileSize = null;
    let finalExternalUrl = null;
    let externalProvider = 'LOCAL_UPLOAD';
    let externalMetadata = null;

    if (req.file) {
      fileName = req.file.originalname;
      fileUrl = req.file.path || req.file.secure_url || req.file.url;
      fileType = req.file.mimetype;
      fileSize = req.file.size;
      externalProvider = 'LOCAL_UPLOAD';
    } else if (externalUrl) {
      const validated = validateExternalResourceUrl(externalUrl);
      if (!validated.isValid) {
        return res.status(400).json({ message: validated.error || 'Invalid external educational link provided.' });
      }

      finalExternalUrl = validated.originalUrl;
      externalProvider = validated.provider;
      externalMetadata = validated;
      fileName = title.trim();
      fileUrl = validated.originalUrl;
      fileType = externalProvider === 'YOUTUBE' ? 'video/youtube' : (externalProvider === 'GOOGLE_DRIVE' ? 'application/google-drive' : 'text/html');
    } else {
      return res.status(400).json({ message: 'Please attach a document file or provide a valid Google Drive or YouTube link.' });
    }

    // Insert into student_resources with status = 'PENDING' and is_public = TRUE
    const insertRes = await db.query(`
      INSERT INTO student_resources (
        title,
        description,
        tags,
        course_category_type,
        public_course_id,
        department_id,
        semester,
        subject_id,
        unit_id,
        lesson_id,
        topic_id,
        file_name,
        file_url,
        file_type,
        file_size,
        external_url,
        external_provider,
        external_metadata,
        source_type,
        status,
        is_public,
        uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'STUDENT', 'PENDING', TRUE, $19)
      RETURNING id, title, status, is_public, external_provider, created_at
    `, [
      title.trim(),
      description?.trim() || null,
      parsedTags,
      courseCategoryType,
      effectivePublicCourseId,
      departmentId || null,
      semester ? parseInt(semester, 10) : null,
      subjectId || null,
      unitId || null,
      lessonId || null,
      topicId || null,
      fileName,
      fileUrl,
      fileType,
      fileSize,
      finalExternalUrl,
      externalProvider,
      externalMetadata ? JSON.stringify(externalMetadata) : null,
      userId
    ]);

    res.status(201).json({
      message: 'Your academic contribution has been submitted for review. Once verified by academic faculty, it will be published to the open library.',
      resource: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Contribute material error:', err);
    res.status(500).json({ message: 'Failed to submit contribution.' });
  }
};

/**
 * Get current authenticated user's contributions (Pending, Approved, Rejected)
 */
exports.getMyContributions = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(`
      SELECT 
        sr.id,
        sr.title,
        sr.description,
        sr.tags,
        sr.status,
        sr.is_public,
        sr.rejection_reason,
        sr.file_name,
        sr.file_url,
        sr.file_type,
        sr.external_url,
        sr.external_provider,
        sr.external_metadata,
        sr.created_at,
        sr.approved_at,
        sr.rejected_at,
        pc.name as public_course_name,
        d.name as department_name,
        s.name as subject_name
      FROM student_resources sr
      LEFT JOIN public_courses pc ON sr.public_course_id = pc.id
      LEFT JOIN departments d ON sr.department_id = d.id
      LEFT JOIN subjects s ON sr.subject_id = s.id
      WHERE sr.uploaded_by = $1
      ORDER BY sr.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get my contributions error:', err);
    res.status(500).json({ message: 'Failed to retrieve your contributions.' });
  }
};

/**
 * Delete a user's pending or rejected contribution
 */
exports.deleteMyContribution = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const delRes = await db.query(
      `DELETE FROM student_resources WHERE id = $1 AND uploaded_by = $2 RETURNING id`,
      [id, userId]
    );

    if (delRes.rowCount === 0) {
      return res.status(404).json({ message: 'Contribution not found or unauthorized.' });
    }

    res.json({ success: true, message: 'Contribution submission removed.' });
  } catch (err) {
    console.error('Delete contribution error:', err);
    res.status(500).json({ message: 'Failed to delete contribution.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SAVED MATERIALS (Bookmarks)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bookmark an approved public resource
 */
exports.saveResource = async (req, res) => {
  const userId = req.user.id;
  const { resourceId } = req.params;

  try {
    // Verify resource is approved and public
    const resCheck = await db.query(
      `SELECT id FROM student_resources WHERE id = $1 AND status = 'APPROVED' AND is_public = TRUE`,
      [resourceId]
    );

    if (resCheck.rowCount === 0) {
      return res.status(404).json({ message: 'Resource not found or is not publicly available.' });
    }

    await db.query(
      `INSERT INTO saved_resources (user_id, resource_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, resource_id) DO NOTHING`,
      [userId, resourceId]
    );

    res.json({ success: true, message: 'Resource bookmarked to your Saved Materials.' });
  } catch (err) {
    console.error('Save resource error:', err);
    res.status(500).json({ message: 'Failed to save resource.' });
  }
};

/**
 * Remove bookmark
 */
exports.unsaveResource = async (req, res) => {
  const userId = req.user.id;
  const { resourceId } = req.params;

  try {
    await db.query(
      `DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2`,
      [userId, resourceId]
    );

    res.json({ success: true, message: 'Resource removed from Saved Materials.' });
  } catch (err) {
    console.error('Unsave resource error:', err);
    res.status(500).json({ message: 'Failed to remove saved resource.' });
  }
};

/**
 * Get all bookmarked resources for authenticated user
 */
exports.getSavedResources = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(`
      SELECT 
        sr.id,
        sr.title,
        sr.description,
        sr.tags,
        sr.file_name,
        sr.file_url,
        sr.file_type,
        sr.file_size,
        sr.external_url,
        sr.external_provider,
        sr.external_metadata,
        sr.created_at,
        saved.created_at as saved_at,
        u.name as contributor_name,
        pc.name as public_course_name,
        d.name as department_name,
        s.name as subject_name
      FROM saved_resources saved
      JOIN student_resources sr ON saved.resource_id = sr.id
      LEFT JOIN users u ON sr.uploaded_by = u.id
      LEFT JOIN public_courses pc ON sr.public_course_id = pc.id
      LEFT JOIN departments d ON sr.department_id = d.id
      LEFT JOIN subjects s ON sr.subject_id = s.id
      WHERE saved.user_id = $1 AND sr.status = 'APPROVED' AND sr.is_public = TRUE
      ORDER BY saved.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get saved resources error:', err);
    res.status(500).json({ message: 'Failed to retrieve saved materials.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. PERSONAL STUDY NOTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get user's personal study notes
 */
exports.getNotes = async (req, res) => {
  const userId = req.user.id;
  const { query, course, topic } = req.query;

  try {
    const conditions = ['pn.user_id = $1'];
    const params = [userId];

    if (query && typeof query === 'string' && query.trim()) {
      params.push(`%${query.trim()}%`);
      conditions.push(`(pn.title ILIKE $${params.length} OR pn.content ILIKE $${params.length} OR array_to_string(pn.tags, ' ') ILIKE $${params.length})`);
    }

    if (course) {
      params.push(course);
      conditions.push(`pn.course_name = $${params.length}`);
    }

    if (topic) {
      params.push(topic);
      conditions.push(`pn.topic_tag = $${params.length}`);
    }

    const result = await db.query(`
      SELECT 
        pn.id,
        pn.title,
        pn.content,
        pn.course_name,
        pn.topic_tag,
        pn.tags,
        pn.is_ai_generated,
        pn.source_resource_id,
        pn.created_at,
        pn.updated_at
      FROM personal_notes pn
      WHERE ${conditions.join(' AND ')}
      ORDER BY pn.updated_at DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Get personal notes error:', err);
    res.status(500).json({ message: 'Failed to retrieve notes.' });
  }
};

/**
 * Create a new personal study note
 */
exports.createNote = async (req, res) => {
  const userId = req.user.id;
  const { title, content, courseName, topicTag, tags, isAiGenerated, sourceResourceId } = req.body;

  try {
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Note title is required.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Note content is required.' });
    }

    let parsedTags = [];
    if (Array.isArray(tags)) parsedTags = tags;
    else if (typeof tags === 'string') parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const result = await db.query(`
      INSERT INTO personal_notes (user_id, title, content, course_name, topic_tag, tags, is_ai_generated, source_resource_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId,
      title.trim(),
      content.trim(),
      courseName?.trim() || null,
      topicTag?.trim() || null,
      parsedTags,
      Boolean(isAiGenerated),
      sourceResourceId || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ message: 'Failed to create note.' });
  }
};

/**
 * Update an existing personal note
 */
exports.updateNote = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { title, content, courseName, topicTag, tags } = req.body;

  try {
    let parsedTags = tags;
    if (typeof tags === 'string') {
      parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    const result = await db.query(`
      UPDATE personal_notes
      SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        course_name = COALESCE($3, course_name),
        topic_tag = COALESCE($4, topic_tag),
        tags = COALESCE($5, tags),
        updated_at = NOW()
      WHERE id = $6 AND user_id = $7
      RETURNING *
    `, [
      title?.trim() || null,
      content?.trim() || null,
      courseName?.trim() || null,
      topicTag?.trim() || null,
      Array.isArray(parsedTags) ? parsedTags : null,
      id,
      userId
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Note not found or unauthorized.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ message: 'Failed to update note.' });
  }
};

/**
 * Delete a personal note
 */
exports.deleteNote = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const result = await db.query(
      `DELETE FROM personal_notes WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Note not found or unauthorized.' });
    }

    res.json({ success: true, message: 'Note deleted.' });
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ message: 'Failed to delete note.' });
  }
};

/**
 * AI-Assisted Note Generation (Topic explanation, revision points, or summarization)
 */
exports.aiGenerateNote = async (req, res) => {
  const userId = req.user.id;
  const { topic, courseName, style = 'comprehensive', provider = 'gemini' } = req.body;

  try {
    if (!topic || !topic.trim()) {
      return res.status(400).json({ message: 'Topic is required to generate AI notes.' });
    }

    // 1. Quota Check
    const quotaCheck = await usageLedgerService.checkQuota(userId, 'NOTES_GENERATION');
    if (!quotaCheck.allowed) {
      return res.status(429).json({ message: quotaCheck.reason });
    }

    const cleanTopic = topic.trim();
    const prompt = `You are Academix AI, an elite academic note creation specialist.
Generate comprehensive, student-friendly academic study notes on: "${cleanTopic}" ${courseName ? `for the course "${courseName}"` : ''}.

Formatting requirements:
1. Provide a clear, intuitive introduction & definition.
2. Core concepts, theoretical mechanisms, and step-by-step breakdown with bullet points.
3. Relevant mathematical formulas, equations, or code syntax examples where applicable.
4. Key takeaways, common pitfalls, and memory revision mnemonics.
5. Format strictly in clean GitHub Flavored Markdown with appropriate headers (##, ###).`;

    const aiRes = await conversationalService.processConversationalQuery({
      query: prompt,
      provider,
      includeWebSearch: true
    });

    // Record Usage
    await usageLedgerService.recordUsage({
      userId,
      featureCategory: 'NOTES_GENERATION',
      provider: aiRes.providerUsed || provider,
      model: aiRes.providerUsed === 'openrouter' ? 'openrouter/auto' : 'gemini-2.5-flash',
      promptTokens: 250,
      completionTokens: 800,
      status: 'SUCCESS'
    });

    res.json({
      title: `${cleanTopic} - Academic Study Notes`,
      content: aiRes.answer,
      topic: cleanTopic,
      courseName: courseName || '',
      providerUsed: aiRes.providerUsed
    });
  } catch (err) {
    console.error('AI generate note error:', err);
    await usageLedgerService.recordUsage({
      userId,
      featureCategory: 'NOTES_GENERATION',
      provider,
      status: 'FAILURE',
      errorCategory: err.message?.includes('429') ? 'RESOURCE_EXHAUSTED' : 'SERVER_ERROR'
    });
    res.status(500).json({ message: 'Failed to generate AI notes. Please try again later.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. AI TEST GENERATOR & TEST ATTEMPTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a personalized practice test using AI
 */
exports.generatePracticeTest = async (req, res) => {
  const userId = req.user.id;
  const {
    topic,
    courseName,
    difficulty = 'MEDIUM',
    questionCount = 5,
    provider = 'gemini',
    customInstructions
  } = req.body;

  try {
    if (!topic || !topic.trim()) {
      return res.status(400).json({ message: 'Topic is required to generate practice test.' });
    }

    // Quota Check
    const quotaCheck = await usageLedgerService.checkQuota(userId, 'TEST_GENERATION');
    if (!quotaCheck.allowed) {
      return res.status(429).json({ message: quotaCheck.reason });
    }

    const count = Math.min(Math.max(parseInt(questionCount, 10) || 5, 3), 15);
    const cleanTopic = topic.trim();

    const prompt = `Generate a rigorous ${difficulty.toLowerCase()}-difficulty academic practice test with exactly ${count} multiple choice questions on "${cleanTopic}" ${courseName ? `for the course "${courseName}"` : ''}.
${customInstructions ? `Custom instruction: ${customInstructions}` : ''}

You MUST return ONLY a valid JSON array of objects with NO markdown code fences and NO surrounding conversation.
Each object must have the exact structure:
{
  "id": 1,
  "question": "Clear, precise academic question text?",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "correctAnswer": "Exact matching string from options",
  "explanation": "Thorough, clear explanation of why this is correct and why other options are wrong.",
  "topicTag": "${cleanTopic}"
}`;

    let rawOutput = '';
    let usedProvider = provider;

    try {
      const response = await conversationalService.processConversationalQuery({
        query: prompt,
        provider,
        includeWebSearch: false
      });
      rawOutput = response.answer;
      usedProvider = response.providerUsed;
    } catch (aiErr) {
      console.warn('Primary test generation failover:', aiErr.message);
      const fallbackProvider = provider === 'gemini' ? 'openrouter' : 'gemini';
      const response = await conversationalService.processConversationalQuery({
        query: prompt,
        provider: fallbackProvider,
        includeWebSearch: false
      });
      rawOutput = response.answer;
      usedProvider = response.providerUsed;
    }

    // Clean JSON fences if present
    let cleanedJson = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBracket = cleanedJson.indexOf('[');
    const lastBracket = cleanedJson.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      cleanedJson = cleanedJson.substring(firstBracket, lastBracket + 1);
    }

    const questions = JSON.parse(cleanedJson);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('AI returned an invalid question structure.');
    }

    // Save generated test into ai_generated_tests
    const testTitle = `${cleanTopic} Practice Assessment (${difficulty})`;
    const testRes = await db.query(`
      INSERT INTO ai_generated_tests (user_id, title, topic, course_name, difficulty, question_count, questions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userId,
      testTitle,
      cleanTopic,
      courseName?.trim() || null,
      difficulty,
      questions.length,
      JSON.stringify(questions)
    ]);

    // Record Usage
    await usageLedgerService.recordUsage({
      userId,
      featureCategory: 'TEST_GENERATION',
      provider: usedProvider,
      model: usedProvider === 'openrouter' ? 'openrouter/auto' : 'gemini-2.5-flash',
      promptTokens: 300,
      completionTokens: 1200,
      status: 'SUCCESS'
    });

    res.status(201).json(testRes.rows[0]);
  } catch (err) {
    console.error('Generate practice test error:', err);
    await usageLedgerService.recordUsage({
      userId,
      featureCategory: 'TEST_GENERATION',
      provider,
      status: 'FAILURE',
      errorCategory: err.message
    });
    res.status(500).json({ message: 'Failed to generate practice test. Please try again in a few moments.' });
  }
};

/**
 * Get saved tests for authenticated user
 */
exports.getSavedTests = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(`
      SELECT 
        t.id,
        t.title,
        t.topic,
        t.course_name,
        t.difficulty,
        t.question_count,
        t.created_at,
        COUNT(att.id) as attempt_count,
        MAX(att.score) as best_score,
        MAX(att.completed_at) as last_attempted_at
      FROM ai_generated_tests t
      LEFT JOIN ai_test_attempts att ON att.test_id = t.id
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get saved tests error:', err);
    res.status(500).json({ message: 'Failed to retrieve practice tests.' });
  }
};

/**
 * Get test by ID
 */
exports.getTestById = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM ai_generated_tests WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Test not found or unauthorized.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get test by ID error:', err);
    res.status(500).json({ message: 'Failed to retrieve test.' });
  }
};

/**
 * Submit test attempt, grade answers, calculate score, record attempt in DB
 */
exports.submitTestAttempt = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { userAnswers } = req.body; // { "0": "Selected Option", ... }

  try {
    const testRes = await db.query(
      `SELECT questions FROM ai_generated_tests WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (testRes.rowCount === 0) {
      return res.status(404).json({ message: 'Test not found or unauthorized.' });
    }

    const questions = testRes.rows[0].questions;
    let correctCount = 0;
    const totalQuestions = questions.length;

    const gradedAnswers = questions.map((q, idx) => {
      const selected = userAnswers?.[idx] || userAnswers?.[q.id] || null;
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) correctCount += 1;

      return {
        questionId: q.id || idx,
        question: q.question,
        selectedAnswer: selected,
        correctAnswer: q.correctAnswer,
        isCorrect,
        explanation: q.explanation,
        topicTag: q.topicTag
      };
    });

    const scorePct = totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(2) : 0;

    const attemptRes = await db.query(`
      INSERT INTO ai_test_attempts (test_id, user_id, score, total_questions, correct_count, user_answers)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      id,
      userId,
      scorePct,
      totalQuestions,
      correctCount,
      JSON.stringify(gradedAnswers)
    ]);

    res.json({
      attemptId: attemptRes.rows[0].id,
      score: parseFloat(scorePct),
      correctCount,
      totalQuestions,
      passed: parseFloat(scorePct) >= 50,
      gradedAnswers,
      completedAt: attemptRes.rows[0].completed_at
    });
  } catch (err) {
    console.error('Submit test attempt error:', err);
    res.status(500).json({ message: 'Failed to evaluate practice test attempt.' });
  }
};

/**
 * Get attempts history for a test
 */
exports.getTestAttempts = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        id,
        score,
        total_questions,
        correct_count,
        user_answers,
        completed_at
      FROM ai_test_attempts
      WHERE test_id = $1 AND user_id = $2
      ORDER BY completed_at DESC
    `, [id, userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get test attempts error:', err);
    res.status(500).json({ message: 'Failed to retrieve test attempts.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. MY HUB AGGREGATED METRICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete My Hub personal workspace summary
 */
exports.getMyHubOverview = async (req, res) => {
  const userId = req.user.id;

  try {
    const [
      savedCountRes,
      notesCountRes,
      contribCountRes,
      testsCountRes,
      recentSearchesRes,
      recentAiChatsRes,
      recentTestsRes,
      recentNotesRes,
      userUsageRes
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM saved_resources WHERE user_id = $1`, [userId]),
      db.query(`SELECT COUNT(*) FROM personal_notes WHERE user_id = $1`, [userId]),
      db.query(`SELECT COUNT(*) FROM student_resources WHERE uploaded_by = $1`, [userId]),
      db.query(`SELECT COUNT(*) FROM ai_generated_tests WHERE user_id = $1`, [userId]),
      db.query(`SELECT id, query, search_mode, created_at FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`, [userId]),
      db.query(`SELECT id, title, selected_provider, updated_at FROM ai_conversations WHERE user_id = $1 AND conversation_type = 'PUBLIC_AI_SEARCH' ORDER BY updated_at DESC LIMIT 5`, [userId]),
      db.query(`SELECT t.id, t.title, t.topic, t.difficulty, t.created_at, MAX(att.score) as best_score FROM ai_generated_tests t LEFT JOIN ai_test_attempts att ON att.test_id = t.id WHERE t.user_id = $1 GROUP BY t.id ORDER BY t.created_at DESC LIMIT 5`, [userId]),
      db.query(`SELECT id, title, course_name, topic_tag, updated_at FROM personal_notes WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5`, [userId]),
      usageLedgerService.getUserUsage(userId)
    ]);

    res.json({
      stats: {
        savedResourcesCount: parseInt(savedCountRes.rows[0]?.count || 0, 10),
        personalNotesCount: parseInt(notesCountRes.rows[0]?.count || 0, 10),
        contributionsCount: parseInt(contribCountRes.rows[0]?.count || 0, 10),
        practiceTestsCount: parseInt(testsCountRes.rows[0]?.count || 0, 10),
        aiRequestsToday: userUsageRes.totalRequestsToday
      },
      recentSearches: recentSearchesRes.rows,
      recentAiChats: recentAiChatsRes.rows,
      recentTests: recentTestsRes.rows,
      recentNotes: recentNotesRes.rows,
      aiQuotaUsage: userUsageRes
    });
  } catch (err) {
    console.error('Get My Hub overview error:', err);
    res.status(500).json({ message: 'Failed to load My Hub dashboard metrics.' });
  }
};
