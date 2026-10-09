const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const db = require('../../db');
const { searchWeb } = require('../search/searchService');
const { classifyQuery, retrieveCurrentInformation, formatCurrentContextBlock } = require('./freshnessService');

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
   * Execute chat completion via Gemini SDK with candidate model fallback
   */
  async _callGemini(systemPrompt, messages) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured in the backend environment.');
    }

    if (Date.now() < this.geminiQuotaExhaustedUntil) {
      throw new Error('Gemini quota is currently exhausted. Skipping to OpenRouter fallback.');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let lastError = null;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    for (let i = 0; i < this.candidateGeminiModels.length; i++) {
      const model = this.candidateGeminiModels[i];
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7
          }
        });
        return response.text;
      } catch (err) {
        lastError = err;
        const msg = err.message || String(err);
        
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('rate-limits')) {
          // Cooldown for 15 minutes before retrying Gemini to avoid repeated failing network requests
          this.geminiQuotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
          console.warn(`[ConversationalAI] Gemini quota exhausted on model "${model}". Setting 15m cooldown and switching to OpenRouter.`);
          break;
        }

        console.warn(`[ConversationalAI] Gemini model "${model}" notice (${i + 1}/${this.candidateGeminiModels.length}): ${msg}`);
        if (i < this.candidateGeminiModels.length - 1) {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }
      }
    }
    throw lastError || new Error('Failed to generate response using Gemini models.');
  }

  /**
   * Execute chat completion via OpenRouter API with multi-model failover
   */
  async _callOpenRouter(systemPrompt, messages) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured in the backend environment.');
    }

    const payloadMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const modelsToTry = [
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
            timeout: 25000
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
   */
  async processConversationalQuery({
    query,
    conversationHistory = [],
    provider = 'gemini',
    includeWebSearch = true
  }) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error('User query is required.');
    }

    const cleanQuery = query.trim();
    const queryClassification = classifyQuery(cleanQuery, false);

    let retrievedContext = '';
    let sources = [];
    let sourceClassification = 'GENERAL_AI_KNOWLEDGE';
    let citationDisclaimer = 'Synthesized from Academix General Academic Knowledge base.';

    // 1. Check if user requested web search or query is time-sensitive
    if (includeWebSearch) {
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
    } else {
      // 2. Search ONLY strictly public approved academic resources (is_public = TRUE AND status = 'APPROVED')
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

    // 3. Build System Prompt for friendly, pedagogical, grounded conversational AI
    const systemPrompt = `You are Academix AI, an intelligent, helpful, and friendly academic assistant.

CORE PRINCIPLES:
1. Provide comprehensive, accurate, and pedagogical answers to general academic, technical, programming, scientific, and knowledge questions.
2. NEVER say "I couldn't find this information in the selected material" when answering general domain questions. Use your broad knowledge base to explain concepts thoroughly with clear definitions, examples, formulas, and code blocks.
3. When Context is provided below:
   - If Web context is provided, ground your answer in the verified web facts and reference sources.
   - If Public Academic Resource context is provided, reference the public note topics.
4. Format all responses with clean GitHub-flavored Markdown:
   - Use ## and ### for headings.
   - Use bullet points and bold key technical terms.
   - Use fenced code blocks with language tags (e.g. \`\`\`python, \`\`\`cpp) for code.
   - Use LaTeX / clean mathematical formatting for equations.
5. If the user asks a follow-up question, maintain context from the previous conversation turns.

${retrievedContext ? retrievedContext : '\n[Note: Answering using Academix General Knowledge Base. No internal institutional material was retrieved.]'}
`;

    // 4. Construct messages history
    const sanitizedHistory = (conversationHistory || []).map(m => ({
      role: m.role === 'assistant' || m.sender === 'assistant' ? 'assistant' : 'user',
      content: m.content || m.text || ''
    })).filter(m => Boolean(m.content.trim()));

    sanitizedHistory.push({ role: 'user', content: cleanQuery });

    // 5. Determine initial provider (skip Gemini directly if quota cooldown is active)
    let usedProvider = provider || 'gemini';
    if (usedProvider === 'gemini' && Date.now() < this.geminiQuotaExhaustedUntil) {
      usedProvider = 'openrouter';
    }

    let answer = '';

    try {
      if (usedProvider === 'openrouter') {
        answer = await this._callOpenRouter(systemPrompt, sanitizedHistory);
      } else {
        answer = await this._callGemini(systemPrompt, sanitizedHistory);
      }
    } catch (primaryErr) {
      console.warn(`[ConversationalAI] Primary provider "${usedProvider}" failed: ${primaryErr.message}. Attempting automatic fallback...`);
      const fallbackProvider = usedProvider === 'gemini' ? 'openrouter' : 'gemini';
      try {
        if (fallbackProvider === 'openrouter') {
          answer = await this._callOpenRouter(systemPrompt, sanitizedHistory);
        } else {
          answer = await this._callGemini(systemPrompt, sanitizedHistory);
        }
        usedProvider = fallbackProvider;
      } catch (fallbackErr) {
        console.error(`[ConversationalAI] Both providers failed: ${fallbackErr.message}`);
        return {
          query: cleanQuery,
          answer: "I apologize, but our AI services are currently experiencing temporary high volume or provider rate limits. Please try asking again in a few moments, or explore our Global Web & Public Resources Search for instant references.",
          sourceClassification: 'SERVICE_NOTICE',
          citationDisclaimer: 'AI service temporarily experiencing high traffic.',
          sources: [],
          providerUsed: 'fallback-notice'
        };
      }
    }

    return {
      query: cleanQuery,
      answer,
      sourceClassification,
      citationDisclaimer,
      sources,
      providerUsed: usedProvider
    };
  }
}

module.exports = new ConversationalService();
