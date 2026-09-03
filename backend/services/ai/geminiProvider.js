const AIProvider = require('./aiProvider');
const { GoogleGenAI } = require('@google/genai');

class GeminiProvider extends AIProvider {
  constructor() {
    super();
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.modelName = 'gemini-2.5-flash';
  }

  async summarizeContent(text) {
    const prompt = `Summarize this academic document concisely in a few paragraphs. Focus on the key points, definitions, and important concepts.\n\nMaterial Content:\n${text}`;
    
    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Gemini summarize error:', error);
      throw new Error('Gemini is currently unavailable. Please try DeepSeek.');
    }
  }

  async askQuestion(text, question) {
    const prompt = `You are an academic learning assistant. Answer the user's question based ONLY on the provided material content below. If the answer is not available in the material, respond honestly: "I couldn't find this information in the selected material." Do not confidently invent an answer or hallucinate.\n\nMaterial Content:\n${text}\n\nUser Question:\n${question}`;
    
    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Gemini askQuestion error:', error);
      throw new Error('Gemini is currently unavailable. Please try DeepSeek.');
    }
  }
}

module.exports = GeminiProvider;
