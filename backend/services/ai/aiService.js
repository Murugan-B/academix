const GeminiProvider = require('./geminiProvider');
const DeepSeekProvider = require('./deepseekProvider');

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
      // academix: new AcademixAIProvider() // Future integration
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

  async askQuestion(providerName, text, question) {
    const provider = this.getProvider(providerName);
    
    // For Q&A, sending the whole document might exceed context, but models like Gemini support 1M tokens. 
    // DeepSeek might support less. For now, we will truncate the text to the first 2 chunks (50k chars) 
    // to prevent completely breaking context window limits, while keeping it modular for future semantic search/RAG.
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
}

// Export as singleton
module.exports = new AIService();
