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

  async generateQuiz(text) {
    const prompt = `You are an academic quiz generator. Based on the material content below, generate up to 30 unique multiple-choice quiz questions. If the material is too short, generate as many as you reasonably can, but aim for a large pool (at least 15-30).

STRICT JSON FORMAT RULES:
- Return ONLY a valid JSON array. No markdown, no code fences, no explanation text.
- Each object must have these exact fields:
  - "question": string
  - "option_a": string
  - "option_b": string
  - "option_c": string
  - "option_d": string
  - "correct_answer": one of "A", "B", "C", or "D"
  - "explanation": string (brief explanation of why the correct answer is correct)
  - "topic_tag": string (a short 1-3 word topic label, e.g. "Data Types", "OSI Model")

Generate questions of varying difficulty (easy, medium, hard). Do NOT include questions about the document structure itself.

Material Content:
${text}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const raw = response.text.trim();
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini generateQuiz error:', error);
      throw new Error('Failed to generate quiz. Please try again.');
    }
  }

  async generateMoreQuestions(text, existingQuestionsText) {
    const prompt = `You are an academic quiz generator. Based on the material content below, generate exactly 10 NEW multiple-choice quiz questions.

CRITICAL REQUIREMENT:
Below is a list of questions that have ALREADY been generated. You MUST NOT generate any questions that are similar in phrasing or test the exact same concept as the existing questions. Create genuinely new questions covering different definitions, applications, examples, or advanced concepts.

Existing Questions to Avoid:
${existingQuestionsText}

STRICT JSON FORMAT RULES:
- Return ONLY a valid JSON array. No markdown, no code fences, no explanation text.
- Each object must have these exact fields:
  - "question": string
  - "option_a": string
  - "option_b": string
  - "option_c": string
  - "option_d": string
  - "correct_answer": one of "A", "B", "C", or "D"
  - "explanation": string (brief explanation of why the correct answer is correct)
  - "topic_tag": string (a short 1-3 word topic label, e.g. "Data Types", "OSI Model")

Material Content:
${text}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      const raw = response.text.trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini generateMoreQuestions error:', error);
      throw new Error('Failed to generate additional questions. Please try again.');
    }
  }

  async generateRecommendation(stats) {
    const { quizTitle, score, percentage, wrongTopics, correctTopics } = stats;
    const prompt = `You are an academic learning advisor. A student just completed a quiz.

Quiz: ${quizTitle}
Score: ${score} (${percentage}%)
Topics answered correctly: ${correctTopics?.join(', ') || 'None'}
Topics answered incorrectly: ${wrongTopics?.join(', ') || 'None'}

Write a short, encouraging, and personalized 3-4 sentence recommendation for this student. Focus on:
1. Acknowledging their performance
2. Specifically mentioning which topics they should review based on their wrong answers
3. Suggesting a concrete study action (re-read, practice, etc.)

Be direct, specific, and encouraging. Do not use generic phrases like "keep it up" without context.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Gemini generateRecommendation error:', error);
      throw new Error('Failed to generate recommendation.');
    }
  }
}

module.exports = GeminiProvider;
