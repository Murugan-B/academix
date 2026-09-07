const db = require('../db');
const aiService = require('../services/ai/aiService');
const { extractTextFromMaterial, EmptyDocumentError, DownloadError, ExtractionError, UnsupportedFormatError } = require('../utils/textExtractor');

const getMaterialWithAuth = async (materialId, userId) => {
  // Enforce strict department boundary. User must belong to the same department as the subject.
  const result = await db.query(`
    SELECT m.*, s.department_id, d.institute_id
    FROM materials m
    JOIN topics t ON m.topic_id = t.id
    JOIN lessons l ON t.lesson_id = l.id
    JOIN units u ON l.unit_id = u.id
    JOIN subjects s ON u.subject_id = s.id
    JOIN departments d ON s.department_id = d.id
    WHERE m.id = $1
  `, [materialId]);

  if (result.rows.length === 0) {
    throw new Error('Material not found');
  }
  const material = result.rows[0];

  const userRes = await db.query('SELECT department_id, institute_id, role FROM users WHERE id = $1', [userId]);
  const user = userRes.rows[0];

  // Bypass for Super Admin or Institute Admin
  if (user.role === 'SUPER_ADMIN') return material;
  if (user.role === 'INSTITUTE_ADMIN' && user.institute_id === material.institute_id) return material;

  // Enforce department access
  if (user.department_id !== material.department_id) {
    throw new Error('Unauthorized: You do not have access to academic materials from other departments.');
  }

  return material;
};

exports.generateSummary = async (req, res) => {
  console.log(`[AI SUMMARY] Request received`);
  try {
    const { materialId, provider, forceRegenerate } = req.body;
    const userId = req.user.id;

    if (!materialId || !provider) {
      return res.status(400).json({ success: false, message: 'Material ID and provider are required.', error: 'Bad Request' });
    }

    const material = await getMaterialWithAuth(materialId, userId);
    
    // Check if summary already exists, unless forceRegenerate is true
    if (!forceRegenerate) {
      const cachedRes = await db.query(
        `SELECT * FROM ai_summaries WHERE material_id = $1 AND user_id = $2 AND provider = $3 ORDER BY created_at DESC LIMIT 1`,
        [materialId, userId, provider]
      );
      if (cachedRes.rowCount > 0) {
        console.log(`[AI SUMMARY] Returning cached summary from DB for ${provider}`);
        return res.json(cachedRes.rows[0]);
      }
    }

    // Extract text (Download & Extract is logged inside extractTextFromMaterial)
    console.time('[AI SUMMARY] Text Extraction Time');
    const { text, fileType } = await extractTextFromMaterial(material);
    console.timeEnd('[AI SUMMARY] Text Extraction Time');

    console.log(`[AI SUMMARY] Selected model: ${provider}`);
    console.log(`[AI SUMMARY] Calling ${provider}...`);
    
    // Generate summary
    let summaryContent;
    try {
      console.time(`[AI SUMMARY] AI Generation Time (${provider})`);
      summaryContent = await aiService.summarizeContent(provider, text);
      console.timeEnd(`[AI SUMMARY] AI Generation Time (${provider})`);
    } catch (aiError) {
      console.error(`[AI SUMMARY] AI Error:`, aiError.message, aiError.stack);
      let providerName = provider.toLowerCase();
      
      // Extract specific error details if it's an Axios error
      let details = aiError.message;
      if (aiError.response && aiError.response.data) {
        details = JSON.stringify(aiError.response.data);
      }
      
      throw new Error(`${provider} API request failed: ${details}`);
    }
    
    console.log(`[AI SUMMARY] AI response received`);
    console.log(`[AI SUMMARY] Saving summary...`);

    // Save history
    let saveResult;
    try {
      saveResult = await db.query(
        `INSERT INTO ai_summaries (material_id, user_id, provider, summary_content) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [materialId, userId, provider, summaryContent]
      );
    } catch (dbError) {
      console.error(`[AI SUMMARY] Database Error:`, dbError.message, dbError.stack);
      throw new Error('Failed to save summary.');
    }

    console.log(`[AI SUMMARY] Summary completed`);
    res.json(saveResult.rows[0]);
  } catch (err) {
    if (err instanceof EmptyDocumentError) {
      return res.status(400).json({ success: false, message: err.message, error: 'Empty Document' });
    }
    if (err instanceof UnsupportedFormatError) {
      return res.status(400).json({ success: false, message: err.message, error: 'Unsupported Format' });
    }
    if (err instanceof DownloadError) {
      return res.status(502).json({ success: false, message: err.message, error: 'Download Error' });
    }
    if (err instanceof ExtractionError) {
      return res.status(500).json({ success: false, message: err.message, error: 'Extraction Error' });
    }
    
    const message = err.message || 'Failed to generate summary';
    console.error(`[AI SUMMARY] Unexpected Error:`, err);
    return res.status(500).json({ success: false, message, error: 'Internal Server Error' });
  }
};

exports.getSummaries = async (req, res) => {
  try {
    const { materialId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM ai_summaries 
       WHERE material_id = $1 AND user_id = $2 
       ORDER BY created_at DESC`,
      [materialId, userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get Summaries Error:', err);
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
};

exports.askQuestion = async (req, res) => {
  console.log(`[AI CHAT] Request received`);
  try {
    const { materialId, provider, question } = req.body;
    const userId = req.user.id;

    if (!materialId || !provider || !question) {
      return res.status(400).json({ success: false, message: 'Material ID, provider, and question are required.', error: 'Bad Request' });
    }

    const material = await getMaterialWithAuth(materialId, userId);
    
    // Extract text
    const { text } = await extractTextFromMaterial(material);

    // Save user question to history
    await db.query(
      `INSERT INTO ai_chat_messages (material_id, user_id, provider, role, message) 
       VALUES ($1, $2, $3, $4, $5)`,
      [materialId, userId, provider, 'user', question]
    );

    let answerContent;
    try {
      console.log(`[AI CHAT] Calling ${provider}...`);
      console.time(`[AI CHAT] AI Generation Time (${provider})`);
      answerContent = await aiService.askQuestion(provider, text, question, materialId);
      console.timeEnd(`[AI CHAT] AI Generation Time (${provider})`);
    } catch (aiError) {
      console.error(`[AI CHAT] AI Error:`, aiError.message, aiError.stack);
      let providerName = provider.toLowerCase();
      if (providerName === 'gemini') throw new Error('Gemini API request failed.');
      if (providerName === 'deepseek') throw new Error('DeepSeek API request failed.');
      throw new Error(`${provider} API request failed.`);
    }

    // Save assistant answer to history
    let saveResult;
    try {
      saveResult = await db.query(
        `INSERT INTO ai_chat_messages (material_id, user_id, provider, role, message) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [materialId, userId, provider, 'assistant', answerContent]
      );
    } catch (dbError) {
      console.error(`[AI CHAT] Database Error:`, dbError.message, dbError.stack);
      throw new Error('Failed to save chat message.');
    }

    console.log(`[AI CHAT] Completed`);
    res.json(saveResult.rows[0]);
  } catch (err) {
    if (err instanceof EmptyDocumentError) {
      return res.status(400).json({ success: false, message: err.message, error: 'Empty Document' });
    }
    if (err instanceof DownloadError) {
      return res.status(502).json({ success: false, message: err.message, error: 'Download Error' });
    }
    if (err instanceof ExtractionError) {
      return res.status(500).json({ success: false, message: err.message, error: 'Extraction Error' });
    }
    
    const message = err.message || 'Failed to ask question';
    return res.status(500).json({ success: false, message, error: 'Internal Server Error' });
  }
};

exports.getChatHistory = async (req, res) => {
  try {
    const { materialId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM ai_chat_messages 
       WHERE material_id = $1 AND user_id = $2 
       ORDER BY created_at ASC`,
      [materialId, userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get Chat Error:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

exports.getHealth = async (req, res) => {
  try {
    const provider = process.env.AI_PROVIDER || 'local';
    
    // Check vector DB status
    let indexedMaterials = 0;
    let vectorChunks = 0;
    
    try {
      const matRes = await db.query('SELECT COUNT(DISTINCT material_id) FROM material_chunks');
      indexedMaterials = parseInt(matRes.rows[0].count);
      
      const chunkRes = await db.query('SELECT COUNT(*) FROM material_chunks');
      vectorChunks = parseInt(chunkRes.rows[0].count);
    } catch (dbErr) {
      console.error('Vector DB check failed:', dbErr.message);
    }

    let isOnline = false;
    
    if (provider === 'local') {
      try {
        const axios = require('axios');
        const baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434';
        await axios.get(baseUrl, { timeout: 3000 });
        isOnline = true;
      } catch (e) {
        isOnline = false;
      }
    } else {
      isOnline = true; // For Gemini/Deepseek, assume online if API key exists
    }

    res.json({
      status: isOnline ? 'ok' : 'unavailable',
      provider: provider,
      model: process.env.AI_MODEL || 'default',
      embeddingModel: process.env.AI_EMBEDDING_MODEL || 'default',
      indexedMaterials,
      vectorChunks
    });
  } catch (err) {
    res.status(500).json({ error: 'Health check failed' });
  }
};
