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

    // Prepare context from attachments
    let contextText = '';
    let imageBuffer = null;
    let mimeType = '';

    const attachmentsRes = await db.query(
      `SELECT * FROM ai_chat_attachments WHERE conversation_id = $1 ORDER BY created_at DESC`,
      [conversationId]
    );

    if (attachmentsRes.rowCount > 0) {
      const texts = [];
      for (const att of attachmentsRes.rows) {
        if (att.extracted_text && att.extracted_text.trim()) {
          texts.push(`--- File: ${att.file_name} ---\n${att.extracted_text}`);
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

    // Query classification & Freshness routing layer
    const queryClassification = classifyQuery(message.trim(), Boolean(contextText && contextText.trim()));
    if (queryClassification.isTimeSensitive) {
      try {
        const freshSources = await retrieveCurrentInformation(message.trim());
        const freshContextBlock = formatCurrentContextBlock(freshSources);
        contextText = contextText ? `${contextText}\n\n${freshContextBlock}` : freshContextBlock;
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
      // If client disconnected during generation, suppress the error
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

    // If client disconnected after generation completed, skip saving incomplete state
    if (clientDisconnected) {
      console.log(`[AI][${chosenProvider}] Response generated but client disconnected — not saving assistant message.`);
      return;
    }

    // Save assistant message to DB
    const assistantMsgRes = await db.query(
      `INSERT INTO ai_messages (conversation_id, sender, content, provider) 
       VALUES ($1, 'assistant', $2, $3) RETURNING *`,
      [conversationId, assistantReply, chosenProvider]
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
    const geminiAvailable = !!process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY || '';
    const openrouterAvailable = !!(openrouterKey && openrouterKey.trim() && openrouterKey !== 'your_new_key_here');

    res.json({
      gemini: { 
        status: geminiAvailable ? 'available' : 'unavailable', 
        label: 'Gemini',
        model: 'gemini-2.5-flash',
        configured: geminiAvailable 
      },
      openrouter: {
        status: openrouterAvailable ? 'available' : 'unavailable',
        label: 'OpenRouter',
        model: process.env.OPENROUTER_MODEL || 'openrouter/free',
        configured: openrouterAvailable
      }
    });
  } catch (err) {
    console.error('Providers status error:', err);
    res.status(500).json({ success: false, message: 'Failed to check AI providers status' });
  }
};

