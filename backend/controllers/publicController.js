const db = require('../db');
const { searchWeb } = require('../services/search/searchService');
const conversationalService = require('../services/ai/conversationalService');

/**
 * 1. Global Normal Search
 * Searches genuine Web Index + Public Academix Community Resources (is_public = TRUE & status = APPROVED)
 */
exports.normalSearch = async (req, res) => {
  const { query, search_type = 'web', page = 1, limit = 10 } = req.query;

  try {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.json({
        query: '',
        searchType: search_type,
        webResults: [],
        images: [],
        publicResources: [],
        totalWeb: 0,
        totalPublicResources: 0,
        provider: 'None'
      });
    }

    const cleanQuery = query.trim();

    // 1. Fetch genuine web / image search results
    const webSearchPromise = searchWeb({
      query: cleanQuery,
      searchType: search_type,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10
    });

    // 2. Fetch ONLY strictly public and approved academic resources
    // CRITICAL SECURITY: is_public = TRUE AND status = 'APPROVED'
    const publicResourcePromise = db.query(`
      SELECT 
        sr.id,
        sr.title,
        sr.description,
        sr.tags,
        sr.file_name,
        sr.file_url,
        sr.file_type,
        sr.file_size,
        sr.created_at,
        d.name as department_name,
        s.name as subject_name,
        'PUBLIC_ACADEMIC_RESOURCE' as source_type
      FROM student_resources sr
      LEFT JOIN departments d ON sr.department_id = d.id
      LEFT JOIN subjects s ON sr.subject_id = s.id
      WHERE sr.status = 'APPROVED' AND sr.is_public = TRUE
        AND (
          sr.title ILIKE $1 
          OR sr.description ILIKE $1 
          OR array_to_string(sr.tags, ' ') ILIKE $1
          OR s.name ILIKE $1
        )
      ORDER BY sr.created_at DESC
      LIMIT 10
    `, [`%${cleanQuery}%`]);

    const [webData, publicResourceRes] = await Promise.all([webSearchPromise, publicResourcePromise]);

    const formattedPublicResources = (publicResourceRes.rows || []).map(r => ({
      id: r.id,
      title: r.title,
      description: r.description || 'Public community study note',
      tags: r.tags || [],
      fileName: r.file_name,
      fileUrl: r.file_url,
      fileType: r.file_type,
      fileSize: r.file_size,
      department: r.department_name,
      subject: r.subject_name,
      createdAt: r.created_at,
      sourceType: 'PUBLIC_ACADEMIC_RESOURCE',
      sourceBadge: 'Open Academix Resource'
    }));

    // 3. Persistent History for Authenticated User
    if (req.user?.id) {
      try {
        await db.query(
          `INSERT INTO search_history (user_id, query, search_mode, result_count)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, cleanQuery, search_type, (webData.results?.length || 0) + (webData.images?.length || 0) + formattedPublicResources.length]
        );
      } catch (histErr) {
        console.warn('[PublicSearch] Save search history warning:', histErr.message);
      }
    }

    res.json({
      query: cleanQuery,
      searchType: search_type,
      page: parseInt(page, 10) || 1,
      webResults: webData.results || [],
      images: webData.images || [],
      publicResources: formattedPublicResources,
      totalWeb: webData.totalResults || 0,
      totalImages: webData.totalImages || 0,
      totalPublicResources: formattedPublicResources.length,
      provider: webData.provider
    });
  } catch (error) {
    console.error('Normal search error:', error);
    res.status(500).json({ message: 'Error processing global search.', error: error.message });
  }
};

/**
 * 2. Featured Open Academic Resources
 * Returns ONLY verified public resources (is_public = TRUE AND status = 'APPROVED')
 */
exports.getFeaturedResources = async (req, res) => {
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
        sr.created_at,
        d.name as department_name,
        s.name as subject_name,
        u.name as contributor_name
      FROM student_resources sr
      LEFT JOIN departments d ON sr.department_id = d.id
      LEFT JOIN subjects s ON sr.subject_id = s.id
      LEFT JOIN users u ON sr.uploaded_by = u.id
      WHERE sr.status = 'APPROVED' AND sr.is_public = TRUE
      ORDER BY sr.created_at DESC
      LIMIT 12
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get featured resources error:', error);
    res.status(500).json({ message: 'Failed to fetch public resources.' });
  }
};

/**
 * 3. Conversational AI Assistant & Search
 * Supports multi-turn conversation, multimodal vision, document attachment, and persistent chat history
 */
const usageLedgerService = require('../services/ai/usageLedgerService');

exports.aiChat = async (req, res) => {
  const {
    query,
    conversationId,
    provider = 'auto',
    model = 'auto',
    includeWebSearch = true,
    fileName,
    fileMimeType,
    fileBase64
  } = req.body;
  const userId = req.user?.id;

  try {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'Query is required.' });
    }

    const cleanQuery = query.trim();

    // Determine category based on attachments
    const isImage = (fileMimeType && fileMimeType.startsWith('image/')) || (req.file?.mimetype && req.file.mimetype.startsWith('image/'));
    const isDoc = (req.file && !isImage) || (fileName && !isImage);
    const featureCategory = isImage ? 'VISION_IMAGE_ANALYSIS' : (isDoc ? 'DOCUMENT_ANALYSIS' : 'CONVERSATIONAL_CHAT');

    // 1. Enforce AI Quota check
    const quotaCheck = await usageLedgerService.checkQuota(userId, featureCategory);
    if (!quotaCheck.allowed) {
      return res.status(429).json({ message: quotaCheck.reason });
    }

    let historyMessages = [];
    let currentConvId = conversationId;

    // Load past conversation messages if conversationId is provided and owned by user
    if (currentConvId && userId) {
      const convCheck = await db.query(
        `SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2`,
        [currentConvId, userId]
      );
      if (convCheck.rowCount > 0) {
        const msgRes = await db.query(
          `SELECT sender, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
          [currentConvId]
        );
        historyMessages = msgRes.rows.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
      } else {
        currentConvId = null; // Invalid or unauthorized conversation, generate new
      }
    }

    // Process file attachment if uploaded via multipart/form-data (req.file) or base64 JSON
    const uploadedFileBuffer = req.file?.buffer || null;
    const effectiveFileName = req.file?.originalname || fileName || null;
    const effectiveMimeType = req.file?.mimetype || fileMimeType || null;
    const effectiveBase64 = fileBase64 || null;

    // Call Conversational AI Service
    const aiResult = await conversationalService.processConversationalQuery({
      query: cleanQuery,
      conversationHistory: historyMessages,
      provider,
      model,
      includeWebSearch: includeWebSearch === 'true' || includeWebSearch === true,
      fileBuffer: uploadedFileBuffer,
      fileName: effectiveFileName,
      fileMimeType: effectiveMimeType,
      fileBase64: effectiveBase64
    });

    // Record Usage in Ledger
    await usageLedgerService.recordUsage({
      userId,
      featureCategory,
      provider: aiResult.providerUsed || provider,
      model: aiResult.modelUsed || 'auto',
      promptTokens: 200,
      completionTokens: Math.max(50, Math.floor((aiResult.answer || '').length / 4)),
      status: aiResult.providerUsed === 'fallback-notice' ? 'FAILED' : 'SUCCESS',
      ipAddress: req.ip
    });

    // Save to Persistent Conversation History if User is Authenticated
    if (userId) {
      try {
        if (!currentConvId) {
          const convTitle = cleanQuery.length > 45 ? cleanQuery.substring(0, 45) + '...' : cleanQuery;
          const convRes = await db.query(
            `INSERT INTO ai_conversations (user_id, title, selected_provider, conversation_type)
             VALUES ($1, $2, $3, 'PUBLIC_AI_SEARCH') RETURNING id`,
            [userId, convTitle, aiResult.providerUsed]
          );
          currentConvId = convRes.rows[0].id;
        } else {
          await db.query(
            `UPDATE ai_conversations SET updated_at = NOW(), selected_provider = $1 WHERE id = $2`,
            [aiResult.providerUsed, currentConvId]
          );
        }

        // Store User Message
        await db.query(
          `INSERT INTO ai_messages (conversation_id, sender, content, provider)
           VALUES ($1, 'user', $2, $3)`,
          [currentConvId, cleanQuery, aiResult.providerUsed]
        );

        // Store Assistant Response with Citations
        await db.query(
          `INSERT INTO ai_messages (conversation_id, sender, content, provider, citations, grounding)
           VALUES ($1, 'assistant', $2, $3, $4, $5)`,
          [
            currentConvId,
            aiResult.answer,
            aiResult.providerUsed,
            JSON.stringify(aiResult.sources || []),
            aiResult.sourceClassification
          ]
        );
      } catch (histDbErr) {
        console.warn('[PublicSearch] Persistent AI conversation storage warning:', histDbErr.message);
      }
    }

    res.json({
      conversationId: currentConvId,
      query: cleanQuery,
      answer: aiResult.answer,
      sourceClassification: aiResult.sourceClassification,
      citationDisclaimer: aiResult.citationDisclaimer,
      sources: aiResult.sources,
      providerUsed: aiResult.providerUsed,
      modelUsed: aiResult.modelUsed,
      slotUsed: aiResult.slotUsed,
      fallbackOccurred: aiResult.fallbackOccurred,
      fallbackReason: aiResult.fallbackReason,
      hasImageAttachment: aiResult.hasImageAttachment,
      hasDocumentContext: aiResult.hasDocumentContext,
      quotaWarning: quotaCheck.warning
    });
  } catch (error) {
    console.error('AI chat processing error:', error);
    await usageLedgerService.recordUsage({
      userId,
      featureCategory: 'CONVERSATIONAL_CHAT',
      provider: 'auto',
      status: 'FAILURE',
      errorCategory: error.message?.includes('429') ? 'RESOURCE_EXHAUSTED' : 'SERVER_ERROR',
      ipAddress: req.ip
    });
    res.status(500).json({ message: error.message || 'Error processing AI question.' });
  }
};

/**
 * 4. SEARCH HISTORY: Normal Search Queries
 */
exports.getNormalSearchHistory = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT id, query, search_mode, result_count, created_at
       FROM search_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get normal search history error:', err);
    res.status(500).json({ message: 'Failed to retrieve search history.' });
  }
};

exports.deleteNormalSearchHistoryItem = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const delRes = await db.query(`DELETE FROM search_history WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ message: 'Search history item not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Search history item deleted.' });
  } catch (err) {
    console.error('Delete search history item error:', err);
    res.status(500).json({ message: 'Failed to delete search history item.' });
  }
};

exports.clearNormalSearchHistory = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query(`DELETE FROM search_history WHERE user_id = $1`, [userId]);
    res.json({ success: true, message: 'Normal search history cleared.' });
  } catch (err) {
    console.error('Clear search history error:', err);
    res.status(500).json({ message: 'Failed to clear search history.' });
  }
};

/**
 * 5. SEARCH HISTORY: AI Search Conversations
 */
exports.getAiConversations = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT id, title, selected_provider, conversation_type, created_at, updated_at
       FROM ai_conversations
       WHERE user_id = $1 AND conversation_type = 'PUBLIC_AI_SEARCH'
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get AI conversations error:', err);
    res.status(500).json({ message: 'Failed to retrieve AI conversations.' });
  }
};

exports.getAiConversationDetails = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const convRes = await db.query(
      `SELECT id, title, selected_provider, created_at, updated_at
       FROM ai_conversations
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (convRes.rowCount === 0) {
      return res.status(404).json({ message: 'Conversation not found or unauthorized.' });
    }

    const messagesRes = await db.query(
      `SELECT id, sender, content, provider, citations, grounding, created_at
       FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    const formattedMessages = messagesRes.rows.map(m => ({
      id: m.id,
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
      provider: m.provider,
      citations: m.citations ? (typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations) : [],
      grounding: m.grounding,
      timestamp: m.created_at
    }));

    res.json({
      conversation: convRes.rows[0],
      messages: formattedMessages
    });
  } catch (err) {
    console.error('Get conversation details error:', err);
    res.status(500).json({ message: 'Failed to retrieve conversation details.' });
  }
};

exports.deleteAiConversation = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const delRes = await db.query(
      `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    if (delRes.rowCount === 0) {
      return res.status(404).json({ message: 'Conversation not found or unauthorized.' });
    }
    res.json({ success: true, message: 'AI conversation deleted.' });
  } catch (err) {
    console.error('Delete AI conversation error:', err);
    res.status(500).json({ message: 'Failed to delete AI conversation.' });
  }
};

exports.clearAiConversations = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query(`DELETE FROM ai_conversations WHERE user_id = $1 AND conversation_type = 'PUBLIC_AI_SEARCH'`, [userId]);
    res.json({ success: true, message: 'All AI conversations cleared.' });
  } catch (err) {
    console.error('Clear AI conversations error:', err);
    res.status(500).json({ message: 'Failed to clear AI conversations.' });
  }
};
