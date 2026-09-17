const GeminiProvider = require('./geminiProvider');
const OpenRouterProvider = require('./openRouterProvider');

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
    const provider = this.providers[key];
    if (!provider) {
      throw new Error(`AI Provider '${providerName}' is not supported. Supported providers: gemini, openrouter.`);
    }
    return provider;
  }

  async summarizeContent(providerName, text) {
    const provider = this.getProvider(providerName);
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
  }

  async askQuestion(providerName, text, question, materialId = null) {
    const provider = this.getProvider(providerName);

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
  }

  async generateQuiz(providerName, text) {
    const provider = this.getProvider(providerName);
    let contextText = text;
    if (text && text.length > CHUNK_SIZE * 2) {
      contextText = text.slice(0, CHUNK_SIZE * 2) + "\n\n[Note: Document was truncated due to length limits.]";
    }
    return provider.generateQuiz(contextText);
  }

  async generateMoreQuestions(providerName, text, existingQuestionsText) {
    const provider = this.getProvider(providerName);
    let contextText = text;
    if (text && text.length > CHUNK_SIZE * 2) {
      contextText = text.slice(0, CHUNK_SIZE * 2) + "\n\n[Note: Document was truncated due to length limits.]";
    }
    if (typeof provider.generateMoreQuestions === 'function') {
      return provider.generateMoreQuestions(contextText, existingQuestionsText);
    }
    return provider.generateQuiz(contextText);
  }

  async generateRecommendation(providerName, stats) {
    const provider = this.getProvider(providerName);
    return provider.generateRecommendation(stats);
  }

  async generateLearningContent(providerName, topic, materialText, wrongQuestions = [], meta = {}) {
    const provider = this.getProvider(providerName);
    let contextText = materialText;
    if (materialText && materialText.length > CHUNK_SIZE * 2) {
      contextText = materialText.slice(0, CHUNK_SIZE * 2) + "\n\n[Note: Document truncated for prompt size.]";
    }
    return provider.generateLearningContent(topic, contextText, wrongQuestions, meta);
  }

  async generateFlashcards(providerName, topic, materialText) {
    const provider = this.getProvider(providerName);
    let contextText = materialText;
    if (materialText && materialText.length > CHUNK_SIZE * 2) {
      contextText = materialText.slice(0, CHUNK_SIZE * 2);
    }
    return provider.generateFlashcards(topic, contextText);
  }

  async generateStudyPlan(providerName, studentProfile, weakTopics = [], strongTopics = []) {
    const provider = this.getProvider(providerName);
    return provider.generateStudyPlan(studentProfile, weakTopics, strongTopics);
  }

  async generateSmartRevision(providerName, topic, materialText, wrongQuestions = []) {
    const provider = this.getProvider(providerName);
    let contextText = materialText;
    if (materialText && materialText.length > CHUNK_SIZE * 2) {
      contextText = materialText.slice(0, CHUNK_SIZE * 2);
    }
    return provider.generateSmartRevision(topic, contextText, wrongQuestions);
  }

  async generateChatResponse(providerName, history, question, contextText = '', imageBuffer = null, mimeType = '') {
    const provider = this.getProvider(providerName);
    return provider.generateChatResponse(history, question, contextText, imageBuffer, mimeType);
  }
}

module.exports = new AIService();
