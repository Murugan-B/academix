const GeminiProvider = require('./geminiProvider');
const DeepSeekProvider = require('./deepseekProvider');
const LocalProvider = require('./localProvider');
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
      deepseek: new DeepSeekProvider(),
      local: new LocalProvider(),
      openrouter: new OpenRouterProvider()
    };
  }

  getProvider(providerName) {
    const provider = this.providers[providerName.toLowerCase()];
    if (!provider) {
      throw new Error(`AI Provider '${providerName}' is not supported or misconfigured.`);
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

    // If there were many chunks, summarize the combined summaries to create a final coherent summary
    const combinedText = chunkSummaries.join('\\n\\n--- Next Section ---\\n\\n');
    return provider.summarizeContent(`This is a combination of summaries from sections of a large document. Please synthesize them into one cohesive, well-structured final summary:\\n\\n${combinedText}`);
  }

  async askQuestion(providerName, text, question, materialId = null) {
    const provider = this.getProvider(providerName);
    
    // For local RAG, query the vector DB instead of parsing raw text
    if (providerName.toLowerCase() === 'local' && materialId) {
      try {
        const db = require('../../db');
        const questionEmbedding = await provider.generateEmbeddings(question);
        const vectorStr = `[${questionEmbedding.join(',')}]`;
        
        // Find top 4 similar chunks
        const result = await db.query(`
          SELECT chunk_text, 1 - (embedding <=> $1::vector) as similarity
          FROM material_chunks
          WHERE material_id = $2
          ORDER BY embedding <=> $1::vector
          LIMIT 4
        `, [vectorStr, materialId]);

        if (result.rows.length > 0) {
          const contextBlocks = result.rows.map(r => r.chunk_text).join('\\n\\n--- Next Relevant Section ---\\n\\n');
          return provider.askQuestion(contextBlocks, question);
        } else {
          // Fallback if chunks aren't embedded yet
          let contextText = text;
          if (text.length > CHUNK_SIZE) {
             contextText = text.slice(0, CHUNK_SIZE) + "\\n\\n[Note: Document was truncated.]";
          }
          return provider.askQuestion(contextText, question);
        }
      } catch (err) {
        console.error('RAG Vector Search failed:', err);
        // Fallback
      }
    }

    let contextText = text;
    if (text.length > CHUNK_SIZE * 2) {
       contextText = text.slice(0, CHUNK_SIZE * 2) + "\\n\\n[Note: Document was truncated due to length limits.]";
    }

    return provider.askQuestion(contextText, question);
  }

  async generateQuiz(providerName, text) {
    const provider = this.getProvider(providerName);
    let contextText = text;
    if (text.length > CHUNK_SIZE * 2) {
       contextText = text.slice(0, CHUNK_SIZE * 2) + "\\n\\n[Note: Document was truncated due to length limits.]";
    }
    return provider.generateQuiz(contextText);
  }

  async generateMoreQuestions(providerName, text, existingQuestionsText) {
    const provider = this.getProvider(providerName);
    let contextText = text;
    if (text.length > CHUNK_SIZE * 2) {
       contextText = text.slice(0, CHUNK_SIZE * 2) + "\\n\\n[Note: Document was truncated due to length limits.]";
    }
    // Only Gemini has this explicitly implemented currently, but standard interface requires it
    if (typeof provider.generateMoreQuestions === 'function') {
      return provider.generateMoreQuestions(contextText, existingQuestionsText);
    }
    // Fallback if provider doesn't implement it
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

  async generateEmbeddingsForMaterial(materialId, text, providerName = 'local') {
    const provider = this.getProvider(providerName);
    const chunkingService = require('./chunkingService');
    const db = require('../../db');

    const chunks = chunkingService.chunkText(text);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      try {
        const embedding = await provider.generateEmbeddings(chunkText);
        
        // Convert embedding array to vector string format for pgvector: '[1,2,3]'
        const vectorStr = `[${embedding.join(',')}]`;
        
        await db.query(
          `INSERT INTO material_chunks (material_id, chunk_index, chunk_text, embedding) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (material_id, chunk_index) 
           DO UPDATE SET chunk_text = $3, embedding = $4`,
          [materialId, i, chunkText, vectorStr]
        );
      } catch (err) {
        console.error(`Error embedding chunk ${i} for material ${materialId}:`, err.message);
      }
    }
  }

  async generateChatResponse(providerName, history, question, contextText = '', imageBuffer = null, mimeType = '') {
    const provider = this.getProvider(providerName);
    return provider.generateChatResponse(history, question, contextText, imageBuffer, mimeType);
  }
}

// Export as singleton
module.exports = new AIService();

