const AIProvider = require('./aiProvider');
const { GoogleGenAI } = require('@google/genai');

class GeminiProvider extends AIProvider {
  constructor() {
    super();
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.modelName = 'gemini-2.5-flash';
  }

  async summarizeContent(text) {
    const prompt = `Summarize this academic document in a structured, student-friendly Markdown format.

Follow these strict formatting rules:
1. Return Markdown-formatted output.
2. Use clear headings with ## and ###.
3. Use bullet points for lists.
4. Use numbered lists for processes or sequences.
5. Use **bold** for important technical terms.
6. Keep paragraphs short.
7. Add blank lines between sections.
8. Do not create one huge paragraph.
9. Preserve all important technical information from the source.
10. Do not invent information.
11. Do not unnecessarily repeat the same information.
12. Make the summary easy for a college student to study and revise.
13. Maintain the terminology used in the source material.

Ensure the summary identifies the main topic, explains important concepts, and highlights key points. For PPTX, combine information across slides rather than summarizing only the first slide.

Material Content:
${text}`;
    
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
