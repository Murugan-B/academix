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

const extractTextFromBuffer = async (buffer, filename, mimetype) => {
  const ext = filename.split('.').pop().toLowerCase();
  const mime = (mimetype || '').toLowerCase();

  try {
    if (ext === 'pdf' || mime.includes('pdf')) {
      const parser = new PDFParse(new Uint8Array(buffer), { verbosity: 0 });
      const data = await parser.getText();
      return data.text.trim();
    } else if (ext === 'docx' || mime.includes('wordprocessingml')) {
      return await withTempFile(buffer, 'docx', async (tempPath) => {
        const res = await officeParser.parseOffice(tempPath);
        return typeof res === 'string' ? res.trim() : (res?.toString() || '').trim();
      });
    } else if (ext === 'pptx' || mime.includes('presentationml')) {
      return await withTempFile(buffer, 'pptx', async (tempPath) => {
        const res = await officeParser.parseOffice(tempPath);
        return typeof res === 'string' ? res.trim() : (res?.toString() || '').trim();
      });
    } else if (ext === 'txt' || mime.includes('text/plain')) {
      return buffer.toString('utf-8').trim();
    } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || mime.includes('image/')) {
      try {
        const { createWorker } = require('tesseract.js');
        const worker = await createWorker('eng');
        const ret = await worker.recognize(buffer);
        await worker.terminate();
        if (ret && ret.data && ret.data.text && ret.data.text.trim().length > 10) {
          return ret.data.text.trim();
        }
      } catch (ocrErr) {
        console.error('Image OCR error:', ocrErr.message);
      }
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
  try {
    const userId = req.user.id;
    const { id: conversationId } = req.params;
    const { message, provider = 'local', attachmentId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const allowedProviders = ['local', 'gemini', 'deepseek'];
    if (!allowedProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({ success: false, message: `Invalid provider '${provider}'. Allowed providers: ${allowedProviders.join(', ')}` });
    }

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
      [updatedTitle, provider, conversationId]
    );

    // Save user message to DB
    const userMsgRes = await db.query(
      `INSERT INTO ai_messages (conversation_id, sender, content, provider) 
       VALUES ($1, 'user', $2, $3) RETURNING *`,
      [conversationId, message.trim(), provider]
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
      attachmentsRes.rows.forEach(att => {
        if (att.extracted_text && att.extracted_text.trim()) {
          texts.push(`--- File: ${att.file_name} ---\n${att.extracted_text}`);
        }
        if (att.file_type && att.file_type.includes('image/') && att.file_url && att.file_url.startsWith('data:')) {
          const parts = att.file_url.split(',');
          if (parts.length === 2) {
            imageBuffer = Buffer.from(parts[1], 'base64');
            mimeType = att.file_type;
          }
        }
      });
      contextText = texts.join('\n\n');
    }

    // Generate response via AI Service
    let assistantReply = '';
    try {
      assistantReply = await aiService.generateChatResponse(
        provider,
        historyRes.rows,
        message.trim(),
        contextText,
        imageBuffer,
        mimeType
      );
    } catch (aiErr) {
      console.error(`AI Generation Error (${provider}):`, aiErr.message);
      let userFriendlyMessage = aiErr.message;
      if (provider === 'local') {
        userFriendlyMessage = `Local Ollama is unavailable or taking too long. Please ensure Ollama is running. Error: ${aiErr.message}`;
      } else if (provider === 'gemini') {
        userFriendlyMessage = `Gemini API request failed. Please check backend GEMINI_API_KEY environment variable. Error: ${aiErr.message}`;
      } else if (provider === 'deepseek') {
        userFriendlyMessage = `DeepSeek API request failed. Please check backend DEEPSEEK_API_KEY environment variable. Error: ${aiErr.message}`;
      }
      return res.status(500).json({ success: false, message: userFriendlyMessage, error: aiErr.message });
    }

    // Save assistant message to DB
    const assistantMsgRes = await db.query(
      `INSERT INTO ai_messages (conversation_id, sender, content, provider) 
       VALUES ($1, 'assistant', $2, $3) RETURNING *`,
      [conversationId, assistantReply, provider]
    );

    // Update message_id on recent attachment if relevant
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
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to process message' });
  }
};

exports.getProvidersStatus = async (req, res) => {
  try {
    let localOnline = false;
    try {
      const baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434';
      await axios.get(baseUrl, { timeout: 2000 });
      localOnline = true;
    } catch (e) {
      localOnline = false;
    }

    const geminiAvailable = !!process.env.GEMINI_API_KEY;
    const deepseekAvailable = !!process.env.DEEPSEEK_API_KEY;

    res.json({
      local: { status: localOnline ? 'available' : 'unavailable', label: 'Ollama (Local)' },
      gemini: { status: geminiAvailable ? 'available' : 'unavailable', label: 'Gemini' },
      deepseek: { status: deepseekAvailable ? 'available' : 'unavailable', label: 'DeepSeek' }
    });
  } catch (err) {
    console.error('Providers status error:', err);
    res.status(500).json({ success: false, message: 'Failed to check AI providers status' });
  }
};
