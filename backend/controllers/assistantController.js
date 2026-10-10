const db = require('../db');
const aiService = require('../services/ai/aiService');
const cloudinary = require('../utils/cloudinary');
const { PDFParse } = require('pdf-parse');
const officeParser = require('officeparser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const axios = require('axios');
const { classifyQuery, retrieveCurrentInformation, formatCurrentContextBlock } = require('../services/ai/freshnessService');

const withTempFile = async (buffer, ext, fn) => {
  const tempPath = path.join(os.tmpdir(), `${randomUUID()}.${ext}`);
  try {
    fs.writeFileSync(tempPath, buffer);
    return await fn(tempPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
};

const { extractPptxFromBuffer, extractDocxFromBuffer } = require('../utils/textExtractor');

const extractTextFromBuffer = async (buffer, filename, mimetype) => {
  const ext = filename.split('.').pop().toLowerCase();
  const mime = (mimetype || '').toLowerCase();

  try {
    if (ext === 'pdf' || mime.includes('pdf')) {
      const parser = new PDFParse(new Uint8Array(buffer), { verbosity: 0 });
      const data = await parser.getText();
      return (data.text || '').trim();
    } else if (ext === 'docx' || mime.includes('wordprocessingml')) {
      const text = await extractDocxFromBuffer(buffer);
      return (text || '').trim();
    } else if (ext === 'pptx' || mime.includes('presentationml')) {
      const text = extractPptxFromBuffer(buffer);
      return (text || '').trim();
    } else if (ext === 'txt' || mime.includes('text/plain')) {
      return buffer.toString('utf-8').trim();
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || mime.includes('image/')) {
      return '';
    }
    return '';
  } catch (err) {
    console.error('Buffer extraction error:', err.message);
    return '';
  }
};

exports.createConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, provider } = req.body;
    const selectedProvider = provider || 'local';

    const result = await db.query(
      `INSERT INTO ai_conversations (user_id, title, selected_provider) 
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, title || 'New Conversation', selectedProvider]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ success: false, message: 'Failed to create conversation' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.query;

    let sql = `SELECT * FROM ai_conversations WHERE user_id = $1`;
    let params = [userId];

    if (query && query.trim()) {
      sql += ` AND title ILIKE $2`;
      params.push(`%${query.trim()}%`);
    }

    sql += ` ORDER BY updated_at DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
};

exports.getConversationDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const convRes = await db.query(
      `SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (convRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied.' });
    }

    const messagesRes = await db.query(
      `SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const attachmentsRes = await db.query(
      `SELECT * FROM ai_chat_attachments WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      conversation: convRes.rows[0],
      messages: messagesRes.rows,
      attachments: attachmentsRes.rows
    });
  } catch (err) {
    console.error('Get conversation details error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch conversation details' });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied.' });
    }

    res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete conversation' });
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // Auth verification
    const convRes = await db.query(
      `SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (convRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied.' });
    }

    const { originalname, mimetype, size, buffer } = req.file;

    // Extract text from buffer
    const extractedText = await extractTextFromBuffer(buffer, originalname, mimetype);

    // Upload file to Cloudinary if available, or generate data URI / local path placeholder
    let fileUrl = '';
    try {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const uploadRes = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'academix_ai_chat' },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
          stream.end(buffer);
        });
        fileUrl = uploadRes.secure_url;
      } else {
        fileUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
      }
    } catch (cErr) {
      console.error('Cloudinary upload warning:', cErr.message);
      fileUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
    }

    const result = await db.query(
      `INSERT INTO ai_chat_attachments 
       (conversation_id, file_name, file_type, file_size, file_url, extracted_text) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [conversationId, originalname, mimetype, size, fileUrl, extractedText]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload attachment error:', err);
    res.status(500).json({ success: false, message: 'Failed to process attachment.' });
  }
};

exports.sendMessage = async (req, res) => {
  let clientDisconnected = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
    }
  });

  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;
    const { message, provider = 'gemini', attachmentId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const allowedProviders = ['gemini', 'openrouter'];
    const chosenProvider = allowedProviders.includes(provider.toLowerCase()) ? provider.toLowerCase() : 'gemini';

    // Verify ownership
    const convRes = await db.query(
      `SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (convRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied.' });
    }

    const conversation = convRes.rows[0];

    // Check message count to auto-generate title on first message
    const msgCountRes = await db.query(
      `SELECT COUNT(*) FROM ai_messages WHERE conversation_id = $1`,
      [conversationId]
    );
    const isFirstMessage = parseInt(msgCountRes.rows[0].count) === 0;

    let updatedTitle = conversation.title;
    if (isFirstMessage || conversation.title === 'New Conversation') {
      updatedTitle = message.trim().length > 35 ? message.trim().substring(0, 35) + '...' : message.trim();
    }

    // Update conversation selected_provider and updated_at
    await db.query(
      `UPDATE ai_conversations 
       SET title = $1, selected_provider = $2, updated_at = NOW() 
       WHERE id = $3`,
      [updatedTitle, chosenProvider, conversationId]
    );

    // Save user message to DB
    const userMsgRes = await db.query(
      `INSERT INTO ai_messages (conversation_id, sender, content, provider) 
       VALUES ($1, 'user', $2, $3) RETURNING *`,
      [conversationId, message.trim(), chosenProvider]
    );

    // Fetch conversation history
    const historyRes = await db.query(
      `SELECT sender, content FROM ai_messages 
       WHERE conversation_id = $1 AND id != $2 
       ORDER BY created_at ASC`,
      [conversationId, userMsgRes.rows[0].id]
    );

    // Prepare context from attachments and authorized academic knowledge base
    let contextText = '';
    let imageBuffer = null;
    let mimeType = '';
    const citations = [];
    let grounding = 'GENERAL';

    const attachmentsRes = await db.query(
      `SELECT * FROM ai_chat_attachments WHERE conversation_id = $1 ORDER BY created_at DESC`,
      [conversationId]
    );

    if (attachmentsRes.rowCount > 0) {
      const texts = [];
      for (const att of attachmentsRes.rows) {
        if (att.extracted_text && att.extracted_text.trim()) {
          texts.push(`--- File: ${att.file_name} ---\n${att.extracted_text}`);

          // Extract citation from attachment
          citations.push({
            materialTitle: att.file_name,
            fileType: att.file_type || 'DOCUMENT',
            sourceType: 'ATTACHMENT',
            isAttachment: true
          });
          grounding = 'GROUNDED';
        }
        if (att.file_type && (att.file_type.includes('image/') || /\.(png|jpg|jpeg|webp)$/i.test(att.file_name))) {
          if (!imageBuffer && att.file_url) {
            try {
              if (att.file_url.startsWith('data:')) {
                const parts = att.file_url.split(',');
                if (parts.length === 2) {
                  imageBuffer = Buffer.from(parts[1], 'base64');
                  mimeType = att.file_type || 'image/png';
                }
              } else if (att.file_url.startsWith('http')) {
                const imgRes = await axios.get(att.file_url, { responseType: 'arraybuffer', timeout: 15000 });
                imageBuffer = Buffer.from(imgRes.data);
                mimeType = att.file_type || 'image/png';
              }
            } catch (imgErr) {
              console.warn('[AI Assistant] Failed to load image buffer for multimodal input:', imgErr.message);
            }
          }
        }
      }
      contextText = texts.join('\n\n');
    }

    // Academic Curriculum RAG Retrieval (with strict department & institute authorization)
    try {
      const subjectId = req.body.subjectId || null;
      let ragQuery = `
        SELECT mc.id, mc.material_id, mc.chunk_index, mc.chunk_text, mc.metadata,
               m.title as material_title, m.file_name, m.file_type,
               s.id as subject_id, s.name as subject_name, s.code as subject_code, u.title as unit_title,
               t.title as topic_title
        FROM material_chunks mc
        JOIN materials m ON mc.material_id = m.id
        LEFT JOIN topics t ON m.topic_id = t.id
        LEFT JOIN lessons l ON t.lesson_id = l.id
        LEFT JOIN units u ON l.unit_id = u.id
        LEFT JOIN subjects s ON u.subject_id = s.id
        LEFT JOIN departments d ON s.department_id = d.id
        WHERE (m.source_type = 'OFFICIAL' OR m.source_type IS NULL)
      `;
      const ragParams = [];

      // Multi-tenant isolation
      if (req.user.role !== 'SUPER_ADMIN') {
        if (req.user.institute_id) {
          ragParams.push(req.user.institute_id);
          ragQuery += ` AND (d.institute_id = $${ragParams.length} OR d.institute_id IS NULL)`;
        }
        if (req.user.department_id) {
          ragParams.push(req.user.department_id);
          ragQuery += ` AND (s.department_id = $${ragParams.length} OR s.department_id IS NULL)`;
        }
      }

      // Subject-scoped retrieval
      if (subjectId) {
        ragParams.push(subjectId);
        ragQuery += ` AND s.id = $${ragParams.length}`;
      }

      // Filter query tokens (removing general conversational stop-words)
      const stopWords = new Set([
        'the', 'is', 'are', 'was', 'were', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'on', 'with',
        'by', 'at', 'from', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against',
        'during', 'without', 'before', 'under', 'around', 'among', 'what', 'who', 'where', 'when', 'why',
        'how', 'which', 'explain', 'tell', 'about', 'this', 'that', 'these', 'those', 'can', 'could',
        'should', 'would', 'may', 'might', 'must', 'have', 'has', 'had', 'do', 'does', 'did', 'help',
        'give', 'some', 'more', 'based', 'material', 'academic', 'notes', 'course', 'curriculum', 'please',
        'know', 'learn', 'study', 'me', 'my', 'you', 'your', 'it', 'its', 'they', 'them', 'their'
      ]);
      const rawKeywords = message.trim().replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/)
        .map(w => w.trim().toLowerCase())
        .filter(w => w.length >= 3 && !stopWords.has(w));
      const keywords = Array.from(new Set(rawKeywords)).slice(0, 5);

      if (keywords.length > 0) {
        const likeClauses = keywords.map(kw => {
          ragParams.push(`%${kw}%`);
          return `(mc.chunk_text ILIKE $${ragParams.length} OR m.title ILIKE $${ragParams.length} OR t.title ILIKE $${ragParams.length})`;
        });
        ragQuery += ` AND (${likeClauses.join(' OR ')})`;
        ragQuery += ` ORDER BY mc.chunk_index ASC LIMIT 5`;

        const ragRes = await db.query(ragQuery, ragParams);

        if (ragRes.rowCount > 0) {
          const ragTexts = [];
          for (const chunk of ragRes.rows) {
            ragTexts.push(`--- Course Material: ${chunk.material_title || chunk.file_name} (${chunk.subject_name || 'Subject'}) ---\n${chunk.chunk_text}`);

            // Extract citation without fabricating page or slide numbers
            const citationItem = extractCitationMetadata(chunk);

            // Deduplicate citations
            const alreadyExists = citations.some(c => 
              c.material_title === citationItem.material_title && 
              c.page_number === citationItem.page_number && 
              c.slide_number === citationItem.slide_number &&
              c.section_title === citationItem.section_title
            );
            if (!alreadyExists) {
              citations.push(citationItem);
            }
          }

          const joinedRag = ragTexts.join('\n\n');
          contextText = contextText ? `${contextText}\n\n=== OFFICIAL COURSE MATERIAL ===\n${joinedRag}` : `=== OFFICIAL COURSE MATERIAL ===\n${joinedRag}`;
          
          // Grounding status: If strong academic match with matching keywords
          grounding = determineGroundingStatus(citations, 0.85);
        }
      }
    } catch (ragErr) {
      console.warn('[AI Assistant] Curriculum RAG search warning:', ragErr.message);
    }

    // If partial or general
    if (grounding === 'GENERAL' && contextText && contextText.trim() && citations.length > 0) {
      grounding = 'PARTIAL';
    }

    // Query classification & Freshness routing layer
    const queryClassification = classifyQuery(message.trim(), Boolean(contextText && contextText.trim()));
    if (queryClassification.isTimeSensitive) {
      try {
        const freshSources = await retrieveCurrentInformation(message.trim());
        const freshContextBlock = formatCurrentContextBlock(freshSources);
        contextText = contextText ? `${contextText}\n\n${freshContextBlock}` : freshContextBlock;
        if (freshSources && freshSources.length > 0) {
          freshSources.forEach(s => {
            citations.push({
              materialTitle: s.title || s.source,
              fileType: 'WEB',
              url: s.url,
              sourceType: 'LIVE_WEB'
            });
          });
        }
      } catch (freshErr) {
        console.warn('[AI Assistant] Freshness retrieval notice:', freshErr.message);
      }
    }

    // Bail out early if client already disconnected before AI generation
    if (clientDisconnected) {
      console.log(`[AI][${chosenProvider}] Client disconnected before AI generation — skipping.`);
      return;
    }

    // Generate response via AI Service
    let assistantReply = '';
    try {
      assistantReply = await aiService.generateChatResponse(
        chosenProvider,
        historyRes.rows,
        message.trim(),
        contextText,
        imageBuffer,
        mimeType
      );
    } catch (aiErr) {
      if (clientDisconnected) {
        console.log(`[AI][${chosenProvider}] Generation cancelled (client disconnected).`);
        return;
      }
      console.error(`AI Generation Error (${chosenProvider}):`, aiErr.message);
      let userFriendlyMessage = aiErr.message;
      if (chosenProvider === 'gemini') {
        userFriendlyMessage = `Gemini API request failed. Please check backend GEMINI_API_KEY. Error: ${aiErr.message}`;
      } else if (chosenProvider === 'openrouter') {
        userFriendlyMessage = `OpenRouter request failed. Please check OPENROUTER_API_KEY. Error: ${aiErr.message}`;
      }
      return res.status(500).json({ success: false, message: userFriendlyMessage, error: aiErr.message });
    }

    if (clientDisconnected) {
      console.log(`[AI][${chosenProvider}] Response generated but client disconnected — not saving assistant message.`);
      return;
    }

    // Save assistant message to DB with citations and grounding
    const assistantMsgRes = await db.query(
      `INSERT INTO ai_messages (conversation_id, sender, content, provider, citations, grounding) 
       VALUES ($1, 'assistant', $2, $3, $4, $5) RETURNING *`,
      [conversationId, assistantReply, chosenProvider, JSON.stringify(citations), grounding]
    );

    // Update message_id on attachment if relevant
    if (attachmentId) {
      await db.query(
        `UPDATE ai_chat_attachments SET message_id = $1 WHERE id = $2 AND conversation_id = $3`,
        [userMsgRes.rows[0].id, attachmentId, conversationId]
      );
    }

    res.json({
      userMessage: userMsgRes.rows[0],
      assistantMessage: assistantMsgRes.rows[0],
      conversationTitle: updatedTitle
    });
  } catch (err) {
    if (clientDisconnected) return; // suppress errors after client disconnect
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to process message' });
  }
};

exports.getProvidersStatus = async (req, res) => {
  try {
    const routerService = require('../services/ai/routerService');
    const systemStatus = routerService.getSystemStatus();
    const models = routerService.getAvailableModels();

    res.json({
      gemini: { 
        status: systemStatus.gemini.availableSlots > 0 ? 'available' : (systemStatus.gemini.configured ? 'cooling' : 'unavailable'), 
        label: 'Gemini (Google)',
        model: systemStatus.gemini.preferredModel,
        configured: systemStatus.gemini.configured,
        totalSlots: systemStatus.gemini.totalSlots,
        availableSlots: systemStatus.gemini.availableSlots,
        slots: systemStatus.gemini.slots
      },
      openrouter: {
        status: systemStatus.openrouter.status,
        label: 'OpenRouter AI',
        model: systemStatus.openrouter.defaultModel,
        visionModel: systemStatus.openrouter.visionModel,
        configured: systemStatus.openrouter.configured
      },
      models
    });
  } catch (err) {
    console.error('Providers status error:', err);
    res.status(500).json({ success: false, message: 'Failed to check AI providers status' });
  }
};

/**
 * Extracts verified citation metadata from a material chunk without fabricating page/slide numbers
 */
function extractCitationMetadata(chunk) {
  const chunkText = chunk.chunk_text || chunk.content || '';
  const meta = chunk.metadata || {};

  const citation = {
    material_id: chunk.material_id || meta.material_id || null,
    material_title: chunk.material_title || meta.material_title || chunk.file_name || 'Course Material',
    file_type: chunk.file_type || meta.file_type || 'PDF',
    subject_name: chunk.subject_name || meta.subject_name || null,
    unit_name: chunk.unit_title || chunk.unit_name || meta.unit_name || null,
    topic_title: chunk.topic_title || meta.topic_title || null,
    page_number: meta.page_number || null,
    slide_number: meta.slide_number || null,
    section_title: meta.section_title || null,
    excerpt: chunkText.substring(0, 160).trim()
  };

  // Check for real PPTX slide markers
  const slideMatch = chunkText.match(/(?:--- Slide\s*(\d+) ---|Slide\s*(\d+)[:\s]*(.*?)(?:\n|$))/i);
  if (slideMatch && !citation.slide_number) {
    citation.slide_number = parseInt(slideMatch[1] || slideMatch[2], 10);
    if (slideMatch[3] && slideMatch[3].trim() && !citation.section_title) {
      citation.section_title = slideMatch[3].trim().replace(/^[:\-\s]+/, '');
    }
  }

  // Check for real PDF page markers
  const pageMatch = chunkText.match(/(?:--- Page\s*(\d+) ---|\[Page\s*(\d+)\]|page\s*:\s*(\d+)|\b--\s*(\d+)\s*of\s*\d+\s*--)/i);
  if (pageMatch && !citation.page_number) {
    citation.page_number = parseInt(pageMatch[1] || pageMatch[2] || pageMatch[3] || pageMatch[4], 10);
  }

  // Check for real DOCX section heading markers
  const headingMatch = chunkText.match(/##\s+([^\n]+)/);
  if (headingMatch && headingMatch[1] && !citation.section_title) {
    citation.section_title = headingMatch[1].trim();
  }

  return citation;
}

/**
 * Calculates transparent grounding status
 */
function determineGroundingStatus(citations, topSimilarity = 0) {
  if (!citations || citations.length === 0) return 'GENERAL';
  if (topSimilarity >= 0.75) return 'GROUNDED';
  return 'PARTIAL';
}

exports.extractCitationMetadata = extractCitationMetadata;
exports.determineGroundingStatus = determineGroundingStatus;



