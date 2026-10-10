const GeminiProvider = require('./geminiProvider');
const OpenRouterProvider = require('./openRouterProvider');
const routerService = require('./routerService');

const CHUNK_SIZE = 25000; // Character limit per chunk (approx 5000 tokens)

function splitTextIntoChunks(text, chunkSize = CHUNK_SIZE) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks;
}

class AIService {
  constructor() {
    this.providers = {
      gemini: new GeminiProvider(),
      openrouter: new OpenRouterProvider()
    };
  }

  getProvider(providerName = 'gemini') {
    const key = (providerName || 'gemini').toLowerCase();
    if (key === 'auto') return this.providers.gemini;
    const provider = this.providers[key];
    if (!provider) {
      return this.providers.gemini;
    }
    return provider;
  }

  /**
   * Safe execution wrapper with multi-provider fallback
   */
  async _executeWithFallback(providerName, fn) {
    const primary = (providerName || 'gemini').toLowerCase();
    const fallback = primary === 'gemini' ? 'openrouter' : 'gemini';

    try {
      const prov = this.getProvider(primary);
      return await fn(prov);
    } catch (primaryErr) {
      console.warn(`[AIService] Primary provider "${primary}" failed: ${primaryErr.message}. Trying fallback provider "${fallback}"...`);
      try {
        const fallProv = this.getProvider(fallback);
        return await fn(fallProv);
      } catch (fallbackErr) {
        console.error(`[AIService] Both providers failed: ${fallbackErr.message}`);
        throw primaryErr;
      }
    }
  }

  async summarizeContent(providerName, text) {
    return this._executeWithFallback(providerName, async (provider) => {
      const chunks = splitTextIntoChunks(text);

      if (chunks.length === 1) {
        return provider.summarizeContent(text);
      }

      // Summarize each chunk
      const chunkSummaries = [];
      for (const chunk of chunks) {
        const sum = await provider.summarizeContent(chunk);
        chunkSummaries.push(sum);
      }

      // Synthesize combined summaries
      const combinedText = chunkSummaries.join('\n\n--- Next Section ---\n\n');
      return provider.summarizeContent(`This is a combination of summaries from sections of a large document. Please synthesize them into one cohesive, well-structured final summary:\n\n${combinedText}`);
    });
  }

  async askQuestion(providerName, text, question, materialId = null) {
    return this._executeWithFallback(providerName, async (provider) => {
      // If materialId provided, query database chunks for RAG context
      if (materialId) {
        try {
          const db = require('../../db');
          const result = await db.query(`
            SELECT chunk_text
            FROM material_chunks
            WHERE material_id = $1
            ORDER BY chunk_index ASC
            LIMIT 6
          `, [materialId]);

          if (result.rows.length > 0) {
            const contextBlocks = result.rows.map(r => r.chunk_text).join('\n\n--- Next Relevant Section ---\n\n');
            return provider.askQuestion(contextBlocks, question);
          }
        } catch (err) {
          console.warn('RAG chunk search fallback to full text:', err.message);
        }
      }

      let contextText = text;
      if (text && text.length > CHUNK_SIZE * 2) {
        contextText = text.slice(0, CHUNK_SIZE * 2) + "\n\n[Note: Document was truncated due to length limits.]";
      }

      return provider.askQuestion(contextText, question);
    });
  }

  async generateQuiz(providerName, text) {
    return this._executeWithFallback(providerName, async (provider) => {
      let contextText = text;
      if (text && text.length > CHUNK_SIZE * 2) {
        contextText = text.slice(0, CHUNK_SIZE * 2) + "\n\n[Note: Document was truncated due to length limits.]";
      }
      return provider.generateQuiz(contextText);
    });
  }

  async generateMoreQuestions(providerName, text, existingQuestionsText) {
    return this._executeWithFallback(providerName, async (provider) => {
      let contextText = text;
      if (text && text.length > CHUNK_SIZE * 2) {
        contextText = text.slice(0, CHUNK_SIZE * 2) + "\n\n[Note: Document was truncated due to length limits.]";
      }
      if (typeof provider.generateMoreQuestions === 'function') {
        return provider.generateMoreQuestions(contextText, existingQuestionsText);
      }
      return provider.generateQuiz(contextText);
    });
  }

  async generateRecommendation(providerName, stats) {
    return this._executeWithFallback(providerName, async (provider) => {
      return provider.generateRecommendation(stats);
    });
  }

  async generateLearningContent(providerName, topic, materialText, wrongQuestions = [], meta = {}) {
    return this._executeWithFallback(providerName, async (provider) => {
      let contextText = materialText;
      if (materialText && materialText.length > CHUNK_SIZE * 2) {
        contextText = materialText.slice(0, CHUNK_SIZE * 2) + "\n\n[Note: Document truncated for prompt size.]";
      }
      return provider.generateLearningContent(topic, contextText, wrongQuestions, meta);
    });
  }

  async generateFlashcards(providerName, topic, materialText) {
    return this._executeWithFallback(providerName, async (provider) => {
      let contextText = materialText;
      if (materialText && materialText.length > CHUNK_SIZE * 2) {
        contextText = materialText.slice(0, CHUNK_SIZE * 2);
      }
      return provider.generateFlashcards(topic, contextText);
    });
  }

  async generateStudyPlan(providerName, studentProfile, weakTopics = [], strongTopics = []) {
    return this._executeWithFallback(providerName, async (provider) => {
      return provider.generateStudyPlan(studentProfile, weakTopics, strongTopics);
    });
  }

  async generateSmartRevision(providerName, topic, materialText, wrongQuestions = []) {
    return this._executeWithFallback(providerName, async (provider) => {
      let contextText = materialText;
      if (materialText && materialText.length > CHUNK_SIZE * 2) {
        contextText = materialText.slice(0, CHUNK_SIZE * 2);
      }
      return provider.generateSmartRevision(topic, contextText, wrongQuestions);
    });
  }

  async generateChatResponse(providerName, history, question, contextText = '', imageBuffer = null, mimeType = '') {
    return this._executeWithFallback(providerName, async (provider) => {
      return provider.generateChatResponse(history, question, contextText, imageBuffer, mimeType);
    });
  }
}

module.exports = new AIService();
