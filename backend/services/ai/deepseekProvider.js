const AIProvider = require('./aiProvider');
const OpenAI = require('openai');

class DeepSeekProvider extends AIProvider {
  constructor() {
    super();
    // DeepSeek uses OpenAI-compatible API format
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
    });
    this.modelName = 'deepseek-chat';
  }

  async summarizeContent(text) {
    const systemPrompt = `You are an academic learning assistant. Summarize the provided academic document concisely in a few paragraphs. Focus on the key points, definitions, and important concepts.`;
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Material Content:\n${text}` }
        ]
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('DeepSeek summarize error:', error);
      throw new Error('DeepSeek is currently unavailable. Please try Gemini.');
    }
  }

  async askQuestion(text, question) {
    const systemPrompt = `You are an academic learning assistant. Answer the user's question based ONLY on the provided material content below. If the answer is not available in the material, respond honestly: "I couldn't find this information in the selected material." Do not confidently invent an answer or hallucinate.`;
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Material Content:\n${text}\n\nUser Question:\n${question}` }
        ]
      });
      return response.choices[0].message.content;
    } catch (error) {
      console.error('DeepSeek askQuestion error:', error);
      throw new Error('DeepSeek is currently unavailable. Please try Gemini.');
    }
  }
}

module.exports = DeepSeekProvider;
