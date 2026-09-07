const AIProvider = require('./aiProvider');
const axios = require('axios');

class LocalProvider extends AIProvider {
  constructor() {
    super();
    this.baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434';
    this.modelName = process.env.AI_MODEL || 'llama3.2';
    this.embeddingModel = process.env.AI_EMBEDDING_MODEL || 'nomic-embed-text';
    this.temperature = parseFloat(process.env.AI_TEMPERATURE || '0.3');
  }

  async _generateResponse(prompt, jsonFormat = false) {
    try {
      const payload = {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.temperature,
          num_ctx: 8192 // Ensure Ollama accepts larger context without silently slowing down or clipping
        }
      };

      if (jsonFormat) {
        payload.format = 'json';
      }

      const response = await axios.post(`${this.baseUrl}/api/generate`, payload, {
        timeout: 600000 // Increased from 120s to 600s (10 min) for slower local CPU inference
      });

      return response.data.response;
    } catch (error) {
      console.error('LocalProvider generation error:', error.message);
      if (error.response && error.response.data) {
        throw new Error(`Academix AI (Local) Error: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Academix AI (Local) is currently unavailable: ${error.message}`);
    }
  }

  async generateEmbeddings(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
        model: this.embeddingModel,
        prompt: text
      }, {
        timeout: 30000
      });
      return response.data.embedding;
    } catch (error) {
      console.error('LocalProvider embedding error:', error.message);
      throw new Error('Failed to generate embeddings using the local model.');
    }
  }

  async summarizeContent(text) {
    const prompt = `Summarize this academic document in a structured, student-friendly Markdown format.

Follow these strict formatting rules:
1. Return ONLY Markdown-formatted output.
2. Use clear headings with ## and ###.
3. Use bullet points for lists.
4. Use numbered lists for processes or sequences.
5. Use **bold** for important technical terms.
6. Keep paragraphs short and concise.
7. Add blank lines between sections.
8. Preserve all important technical terminology.
9. Do not hallucinate or invent information not in the text.
10. Do not write introductory or concluding conversational filler (e.g., "Here is the summary").

Material Content:
${text}`;

    const rawResponse = await this._generateResponse(prompt);
    return rawResponse.trim();
  }

  async askQuestion(contextText, question) {
    const prompt = `You are Academix AI, an academic learning assistant. Answer the user's question based ONLY on the provided Context Material below. 
If the answer is not available in the Context Material, respond honestly: "I couldn't find this information in the selected material." 
Do not confidently invent an answer or use external knowledge.

Context Material:
${contextText}

User Question:
${question}`;

    const rawResponse = await this._generateResponse(prompt);
    return rawResponse.trim();
  }

  async generateQuiz(text) {
    const prompt = `You are an academic quiz generator. Based on the material content below, generate up to 30 unique multiple-choice quiz questions. If the material is too short, generate as many as you reasonably can (at least 15-30).

STRICT JSON FORMAT RULES:
- Return ONLY a valid JSON object with a single root key "questions", which contains an array of question objects.
- Do NOT wrap in markdown fences. Return raw JSON.
- Each object must exactly match this structure:
{
  "question": "The question text",
  "option_a": "First option",
  "option_b": "Second option",
  "option_c": "Third option",
  "option_d": "Fourth option",
  "correct_answer": "A", // strictly "A", "B", "C", or "D"
  "explanation": "Brief explanation of why the answer is correct",
  "topic_tag": "1-3 word topic label",
  "difficulty": "easy" // "easy", "medium", or "hard"
}

Material Content:
${text}`;

    try {
      const raw = await this._generateResponse(prompt, true);
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleaned);
      
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      return parsed; // Fallback if it returned array directly
    } catch (error) {
      console.error('LocalProvider generateQuiz JSON parse error:', error);
      throw new Error('Failed to generate valid quiz questions from the local model.');
    }
  }

  async generateMoreQuestions(text, existingQuestionsText) {
    const prompt = `You are an academic quiz generator. Based on the material content below, generate exactly 10 NEW multiple-choice quiz questions.

CRITICAL REQUIREMENT:
Below is a list of questions that have ALREADY been generated. You MUST NOT generate any questions that are similar in phrasing or test the exact same concept as the existing questions. Create genuinely new questions covering different definitions, applications, examples, or advanced concepts.

Existing Questions to Avoid:
${existingQuestionsText}

STRICT JSON FORMAT RULES:
- Return ONLY a valid JSON object with a single root key "questions", which contains an array of question objects.
- Do NOT wrap in markdown fences. Return raw JSON.
- Each object must exactly match this structure:
{
  "question": "The question text",
  "option_a": "First option",
  "option_b": "Second option",
  "option_c": "Third option",
  "option_d": "Fourth option",
  "correct_answer": "A", 
  "explanation": "Brief explanation",
  "topic_tag": "1-3 word topic label",
  "difficulty": "medium"
}

Material Content:
${text}`;

    try {
      const raw = await this._generateResponse(prompt, true);
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(cleaned);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      return parsed;
    } catch (error) {
      console.error('LocalProvider generateMoreQuestions JSON parse error:', error);
      throw new Error('Failed to generate additional valid quiz questions.');
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

Be direct, specific, and encouraging. Do not use generic phrases.`;

    const rawResponse = await this._generateResponse(prompt);
    return rawResponse.trim();
  }

  async generateChatResponse(history, question, contextText = '', imageBuffer = null, mimeType = '') {
    let imageOcrText = '';
    if (imageBuffer) {
      try {
        const { createWorker } = require('tesseract.js');
        const worker = await createWorker('eng');
        const ret = await worker.recognize(imageBuffer);
        await worker.terminate();
        if (ret && ret.data && ret.data.text && ret.data.text.trim().length > 10) {
          imageOcrText = ret.data.text.trim();
        }
      } catch (ocrErr) {
        console.error('Local OCR error:', ocrErr.message);
      }
    }

    let systemInstruction = `You are Academix AI Assistant, an expert academic tutor and study partner. Provide helpful, accurate, structured Markdown responses.`;
    
    let contextBlock = '';
    if (contextText) {
      contextBlock += `\n\n=== UPLOADED DOCUMENT CONTEXT ===\n${contextText}\n\nSTRICT INSTRUCTION FOR DOCUMENT CONTEXT: Prioritize the uploaded document material to answer the question. If the requested information is not in the material, state clearly: "I couldn't find this information in the uploaded material." Do not invent or hallucinate missing details.\n`;
    }
    if (imageOcrText) {
      contextBlock += `\n\n=== UPLOADED IMAGE TEXT (OCR EXTRACTED) ===\n${imageOcrText}\n`;
    } else if (imageBuffer && !imageOcrText) {
      contextBlock += `\n\n[Note: An image was uploaded, but no readable text could be extracted via local OCR. If asking about image visual content, inform the user that local vision model analysis is currently unavailable.]\n`;
    }

    let historyBlock = '';
    if (history && history.length > 0) {
      const recentHistory = history.slice(-6);
      historyBlock = recentHistory.map(m => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');
    }

    let fullPrompt = `${systemInstruction}${contextBlock}\n\n=== CONVERSATION HISTORY ===\n${historyBlock}\n\nUSER: ${question}\nASSISTANT:`;

    const rawResponse = await this._generateResponse(fullPrompt);
    return rawResponse.trim();
  }
}

module.exports = LocalProvider;

