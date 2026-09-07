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

  async generateChatResponse(history, question, contextText = '', imageBuffer = null, mimeType = 'image/png') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured in backend environment.');
    }

    let systemInstruction = `You are Academix AI Assistant, an expert academic tutor and study partner. Provide helpful, accurate, structured Markdown responses.`;
    
    let contextBlock = '';
    if (contextText) {
      contextBlock += `\n\n=== UPLOADED DOCUMENT CONTEXT ===\n${contextText}\n\nSTRICT INSTRUCTION FOR DOCUMENT CONTEXT: Prioritize the uploaded document material to answer the question. If the requested information is not in the material, state clearly: "I couldn't find this information in the uploaded material." Do not invent or hallucinate missing details.\n`;
    }

    let historyBlock = '';
    if (history && history.length > 0) {
      const recentHistory = history.slice(-6);
      historyBlock = recentHistory.map(m => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');
    }

    let fullPrompt = `${systemInstruction}${contextBlock}\n\n=== CONVERSATION HISTORY ===\n${historyBlock}\n\nUSER: ${question}\nASSISTANT:`;

    try {
      let contentsPayload = fullPrompt;
      if (imageBuffer) {
        contentsPayload = [
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType || 'image/png'
            }
          },
          fullPrompt
        ];
      }

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: contentsPayload,
      });
      return response.text.trim();
    } catch (error) {
      console.error('Gemini generateChatResponse error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  async generateLearningContent(topic, materialText, wrongQuestions = [], meta = {}) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured in backend environment.');
    }

    let wrongQuestionsBlock = '';
    if (wrongQuestions && wrongQuestions.length > 0) {
      wrongQuestionsBlock = `\nSTUDENT'S PREVIOUS INCORRECT QUESTIONS IN THIS TOPIC:\n` +
        wrongQuestions.map((q, idx) => `Question ${idx + 1}: ${q.question}\nSelected (Wrong): ${q.selected_answer || 'N/A'}\nCorrect: ${q.correct_answer || 'N/A'}\nExplanation: ${q.explanation || ''}`).join('\n\n');
    }

    const prompt = `You are Academix AI, an expert personalized learning tutor.
A student needs to improve on the topic: "${topic}".

Generate comprehensive, grounded, student-friendly learning material using ONLY the provided academic source material. Address any specific gaps shown in the student's previous incorrect questions.

SOURCE ACADEMIC MATERIAL:
${materialText}
${wrongQuestionsBlock}

CRITICAL RULES:
1. Ground all explanations, concepts, and examples in the provided source material.
2. Do not invent page numbers or slide references not supported by the text.
3. Return ONLY a valid JSON object without markdown fences or extraneous text.

STRICT JSON STRUCTURE REQUIRED:
{
  "topic": "${topic}",
  "difficulty": "Easy" or "Medium" or "Hard",
  "whyWeak": "Clear 1-2 sentence explanation of why the student struggled or what key concept was missed",
  "simpleExplanation": "Clear, very easy to understand conceptual explanation in 2-3 paragraphs",
  "whyItMatters": "Academic and real-world significance of this topic",
  "importantConcepts": [
    { "concept": "Concept Name", "description": "Crisp explanation" }
  ],
  "importantPoints": [
    "Exam-focused key point 1",
    "Exam-focused key point 2"
  ],
  "importantSubtopics": [
    { "title": "Subtopic Title", "keyPoint": "Essential takeaway" }
  ],
  "materialBasedLearning": {
    "sourceType": "${meta.fileType || 'Material'}",
    "slidesOrSections": [
      {
        "title": "Section or Concept Title",
        "reference": "Slide/Section Reference if known",
        "keyTakeaway": "Key takeaway from this section"
      }
    ]
  },
  "examples": [
    {
      "title": "Example Title",
      "problem": "Problem statement or scenario",
      "solution": "Clear solution",
      "explanation": "Why this solution is correct"
    }
  ],
  "stepByStep": [
    { "step": 1, "title": "Step 1 Title", "description": "Step 1 details" }
  ],
  "commonMistakes": [
    {
      "mistake": "Common conceptual mistake or pitfall",
      "whyWrong": "Why students make this mistake",
      "howToFix": "How to remember or solve it correctly"
    }
  ],
  "quickRevision": [
    "Quick bullet 1",
    "Quick bullet 2"
  ],
  "practiceQuestions": [
    {
      "id": 1,
      "question": "Multiple-choice practice question targeting weak points?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Detailed explanation of correct answer"
    },
    {
      "id": 2,
      "question": "Second practice question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 1,
      "explanation": "Detailed explanation"
    },
    {
      "id": 3,
      "question": "Third practice question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 2,
      "explanation": "Detailed explanation"
    }
  ]
}`;

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
      console.error('Gemini generateLearningContent error:', error);
      throw new Error(`Failed to generate personalized learning content: ${error.message}`);
    }
  }
}

module.exports = GeminiProvider;

