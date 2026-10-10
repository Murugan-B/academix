const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const db = require('../../db');
const { searchWeb } = require('../search/searchService');
const { classifyQuery } = require('./freshnessService');
const geminiKeyManager = require('./geminiKeyManager');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class ConversationalService {
  constructor() {
    this.candidateGeminiModels = [
      'gemini-2.5-flash',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash'
    ];
    this.geminiQuotaExhaustedUntil = 0;
  }

  /**
   * Helper: Extract text from document buffer (PDF, DOCX, TXT)
   */
  async extractDocumentText(buffer, originalname, mimetype) {
    if (!buffer) return '';
    const ext = (originalname || '').split('.').pop().toLowerCase();
    
    try {
      if (mimetype === 'application/pdf' || ext === 'pdf') {
        const data = await pdfParse(buffer);
        return data.text || '';
      }
      
      if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === 'docx'
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      }

      if (
        mimetype.startsWith('text/') ||
        ['txt', 'csv', 'md', 'json', 'js', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)
      ) {
        return buffer.toString('utf-8');
      }
    } catch (err) {
      console.warn('[ConversationalAI] Document text extraction warning:', err.message);
    }
    return '';
  }

  /**
   * Execute chat completion via Gemini SDK with candidate model fallback
   * Supports Multimodal Image Understanding
   */
  async _callGemini(systemPrompt, messages, imageAttachment = null) {
    if (!geminiKeyManager.hasConfiguredKeys()) {
      throw new Error('GEMINI_API_KEY is not configured in the backend environment.');
    }

    const contents = messages.map((m, idx) => {
      const isLastUserMsg = (idx === messages.length - 1) && (m.role === 'user');
      const parts = [{ text: m.content }];

      if (isLastUserMsg && imageAttachment && imageAttachment.data && imageAttachment.mimeType) {
        parts.push({
          inlineData: {
            mimeType: imageAttachment.mimeType,
            data: imageAttachment.data
          }
        });
      }

      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    let lastError = null;

    for (const model of this.candidateGeminiModels) {
      const attemptedSlots = [];

      while (true) {
        const slot = geminiKeyManager.acquireKey(attemptedSlots);
        if (!slot) break;
        attemptedSlots.push(slot.slotId);

        try {
          const ai = new GoogleGenAI({ apiKey: slot.key });
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7
            }
          });
          geminiKeyManager.recordSuccess(slot.slotId);
          return response.text;
        } catch (err) {
          lastError = err;
          const msg = err?.message || String(err);
          console.warn(`[ConversationalAI] Gemini slot ${slot.slotId} model "${model}" error: ${msg}`);
          const failResult = geminiKeyManager.recordFailure(slot.slotId, err);
          if (failResult.isQuota || failResult.isInvalid) {
            continue;
          }
          break;
        }
      }
    }

    throw lastError || new Error('Failed to generate response using Gemini models.');
  }

  /**
   * Execute chat completion via OpenRouter API with multi-model failover
   * Supports Multimodal Vision Models
   */
  async _callOpenRouter(systemPrompt, messages, imageAttachment = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured in the backend environment.');
    }

    const payloadMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m, idx) => {
        const isLastUserMsg = (idx === messages.length - 1) && (m.role === 'user');
        
        if (isLastUserMsg && imageAttachment && imageAttachment.data && imageAttachment.mimeType) {
          return {
            role: 'user',
            content: [
              { type: 'text', text: m.content },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageAttachment.mimeType};base64,${imageAttachment.data}`
                }
              }
            ]
          };
        }

        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        };
      })
    ];

    // Select candidate models based on whether vision is required
    const modelsToTry = imageAttachment
      ? [
          process.env.OPENROUTER_VISION_MODEL,
          'openrouter/auto',
          'google/gemini-2.0-flash-001',
          'meta-llama/llama-3.2-11b-vision-instruct',
          'qwen/qwen-2-vl-72b-instruct',
          'openai/gpt-4o-mini'
        ].filter(Boolean)
      : [
          process.env.OPENROUTER_MODEL,
          'openrouter/auto',
          'qwen/qwen-2.5-72b-instruct',
          'meta-llama/llama-3.3-70b-instruct:free',
          'google/gemini-2.5-flash'
        ].filter(Boolean);

    // Remove duplicates while preserving priority
    const candidateModels = Array.from(new Set(modelsToTry));
    let lastError = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      try {
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model,
            messages: payloadMessages,
            temperature: 0.7
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://academix.edu',
              'X-Title': 'Academix Global Assistant'
            },
            timeout: 30000
          }
        );

        let answer = response.data?.choices?.[0]?.message?.content;
        if (Array.isArray(answer)) {
          answer = answer.map(p => p.text || '').join('\n');
        }

        if (typeof answer === 'string' && answer.trim().length > 0) {
          return answer.trim();
        }
      } catch (err) {
        lastError = err;
        const msg = err.response?.data?.error?.message || err.message;
        console.warn(`[ConversationalAI] OpenRouter model "${model}" notice (${i + 1}/${candidateModels.length}): ${msg}`);
      }
    }

    throw lastError || new Error('All OpenRouter candidate models failed to return a response.');
  }

  /**
   * Main Conversational Query Processor
   * Supports Text, Document Attachments (PDF, DOCX, TXT), and Multimodal Images (JPG, PNG, WEBP)
   * Powered by central SmartAIRouter with multi-key rotation and multi-provider fallback.
   */
  async processConversationalQuery({
    query,
    conversationHistory = [],
    provider = 'auto',
    model = 'auto',
    includeWebSearch = true,
    fileBuffer = null,
    fileName = null,
    fileMimeType = null,
    fileBase64 = null
  }) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error('User query is required.');
    }

    const routerService = require('./routerService');
    const cleanQuery = query.trim();
    classifyQuery(cleanQuery, false);

    let retrievedContext = '';
    let sources = [];
    let sourceClassification = 'GENERAL_AI_KNOWLEDGE';
    let citationDisclaimer = 'Synthesized from Academix General Academic Knowledge base.';
    let imageAttachment = null;
    let documentContext = '';

    // A. Handle Attachment Processing
    if (fileBuffer || fileBase64) {
      const mime = (fileMimeType || '').toLowerCase();
      const name = fileName || 'uploaded_document';
      const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].some(ext => name.toLowerCase().endsWith('.' + ext));

      if (isImage) {
        const base64Data = fileBase64 || (fileBuffer ? fileBuffer.toString('base64') : '');
        if (base64Data) {
          imageAttachment = {
            mimeType: mime || 'image/png',
            data: base64Data,
            fileName: name
          };
          sourceClassification = 'IMAGE_ANALYSIS';
          citationDisclaimer = `Multimodal visual analysis of attached image "${name}".`;
        }
      } else {
        // Document extraction (PDF, DOCX, TXT)
        let extractedText = '';
        if (fileBuffer) {
          extractedText = await this.extractDocumentText(fileBuffer, name, mime);
        } else if (fileBase64) {
          const buf = Buffer.from(fileBase64, 'base64');
          extractedText = await this.extractDocumentText(buf, name, mime);
        }

        if (extractedText && extractedText.trim().length > 0) {
          // Truncate to reasonable context window (~15,000 chars)
          const safeText = extractedText.trim().slice(0, 15000);
          documentContext = `\n=== USER ATTACHED DOCUMENT: "${name}" ===\n${safeText}\n\nINSTRUCTIONS FOR DOCUMENT: Analyze the document content above and directly address the user query regarding it. Provide clear, accurate, and comprehensive academic explanations.`;
          sourceClassification = 'DOCUMENT_GROUNDED';
          citationDisclaimer = `Grounded in attached document "${name}".`;
        }
      }
    }

    // B. Check if user requested web search (and no conflicting heavy document context)
    if (includeWebSearch && !documentContext && !imageAttachment) {
      try {
        const webData = await searchWeb({ query: cleanQuery, searchType: 'web', limit: 4 });
        if (webData.results && webData.results.length > 0) {
          sourceClassification = 'WEB_GROUNDED';
          citationDisclaimer = `Grounded in fresh verified web references from ${webData.provider}.`;
          sources = webData.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
            domain: r.domain,
            favicon: r.favicon,
            sourceType: 'WEB_GROUNDED',
            sourceName: r.source || r.domain
          }));

          retrievedContext = `\n=== LIVE VERIFIED WEB CONTEXT ===\n` +
            webData.results.map((r, idx) => `[Source ${idx + 1}] (${r.domain}) ${r.title}\nDetails: ${r.snippet}\nURL: ${r.url}`).join('\n\n') +
            `\n\nINSTRUCTIONS FOR WEB CITATIONS: Use the fresh information above to formulate an up-to-date answer. State verified facts, office holders, dates, or technical updates accurately.`;
        }
      } catch (searchErr) {
        console.warn('[ConversationalAI] Live web search grounding notice:', searchErr.message);
      }
    } else if (!includeWebSearch && !documentContext && !imageAttachment) {
      // Search ONLY strictly public approved academic resources (is_public = TRUE AND status = 'APPROVED')
      try {
        const searchTerm = `%${cleanQuery}%`;
        const publicDocsRes = await db.query(
          `SELECT id, title, description, tags, file_name, file_url
           FROM student_resources
           WHERE status = 'APPROVED' AND is_public = TRUE
             AND (title ILIKE $1 OR description ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1)
           ORDER BY created_at DESC
           LIMIT 3`,
          [searchTerm]
        );

        if (publicDocsRes.rows.length > 0) {
          sourceClassification = 'PUBLIC_ACADEMIC_RESOURCE';
          citationDisclaimer = 'Grounded in approved public community study materials.';
          sources = publicDocsRes.rows.map(doc => ({
            id: doc.id,
            title: doc.title,
            description: doc.description,
            fileUrl: doc.file_url,
            sourceType: 'PUBLIC_ACADEMIC_RESOURCE',
            sourceName: 'Approved Public Resource'
          }));

          retrievedContext = `\n=== APPROVED PUBLIC ACADEMIC MATERIAL ===\n` +
            publicDocsRes.rows.map((doc, idx) => `[Resource ${idx + 1}] Title: ${doc.title}\nDescription: ${doc.description || 'N/A'}`).join('\n\n') +
            `\n\nINSTRUCTIONS: If this public material contains relevant information, reference its concepts. Supplement with clear general educational explanations.`;
        }
      } catch (dbErr) {
        console.warn('[ConversationalAI] Public resource search notice:', dbErr.message);
      }
    }

    // C. Build System Prompt for friendly, pedagogical, grounded conversational AI
    const systemPrompt = `You are Academix AI, an intelligent, helpful, and friendly academic assistant.

CORE PRINCIPLES:
1. Provide comprehensive, accurate, and pedagogical answers to general academic, technical, programming, scientific, and knowledge questions.
2. If an image or diagram is provided, perform deep visual analysis: examine circuits, code snippets, graphs, mathematical problems, charts, and handwritten questions, and explain or solve them step-by-step.
3. If an attached document is provided, read and analyze its content thoroughly to answer summaries, MCQs, or conceptual questions.
4. NEVER say "I couldn't find this information in the selected material" when answering general domain questions. Use your broad knowledge base to explain concepts thoroughly with clear definitions, examples, formulas, and code blocks.
5. Format all responses with clean GitHub-flavored Markdown:
   - Use ## and ### for headings.
   - Use bullet points and bold key technical terms.
   - Use fenced code blocks with language tags (e.g. \`\`\`python, \`\`\`cpp) for code.
   - Use LaTeX / clean mathematical formatting for equations.
6. If the user asks a follow-up question, maintain context from previous conversation turns.

${documentContext ? documentContext : ''}
${retrievedContext ? retrievedContext : (!documentContext && !imageAttachment ? '\n[Note: Answering using Academix General Knowledge Base. No internal institutional material was retrieved.]' : '')}
`;

    // D. Construct messages history
    const sanitizedHistory = (conversationHistory || []).map(m => ({
      role: m.role === 'assistant' || m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.content || m.text || ''
    })).filter(m => Boolean(m.content && m.content.trim()));

    sanitizedHistory.push({ role: 'user', content: cleanQuery });

    // E. Determine preferred model from provider/model parameters
    const preferredModel = (model && model !== 'auto') ? model : (provider === 'openrouter' ? 'openrouter-default' : (provider === 'gemini' ? 'gemini-2.5-flash' : 'auto'));

    try {
      const result = await routerService.generateContent({
        systemPrompt,
        messages: sanitizedHistory,
        imageAttachment,
        preferredModel,
        temperature: 0.7
      });

      return {
        query: cleanQuery,
        answer: result.text,
        sourceClassification,
        citationDisclaimer,
        sources,
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed,
        slotUsed: result.slotUsed,
        fallbackOccurred: result.fallbackOccurred,
        fallbackReason: result.fallbackReason,
        hasImageAttachment: Boolean(imageAttachment),
        hasDocumentContext: Boolean(documentContext)
      };
    } catch (err) {
      console.error(`[ConversationalAI] Router generation error: ${err.message}`);
      return {
        query: cleanQuery,
        answer: "I apologize, but our AI services are currently experiencing temporary high volume or provider rate limits. Please try asking again in a few moments, or explore our Global Web & Public Resources Search for instant references.",
        sourceClassification: 'SERVICE_NOTICE',
        citationDisclaimer: 'AI service temporarily experiencing high traffic.',
        sources: [],
        providerUsed: 'fallback-notice',
        modelUsed: 'unavailable',
        fallbackOccurred: true,
        fallbackReason: err.message,
        hasImageAttachment: Boolean(imageAttachment),
        hasDocumentContext: Boolean(documentContext)
      };
    }
  }
}

module.exports = new ConversationalService();
