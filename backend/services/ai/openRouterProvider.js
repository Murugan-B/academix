const AIProvider = require('./aiProvider');
const OpenAI = require('openai');

class OpenRouterProvider extends AIProvider {
  constructor() {
    super();
    this.client = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultHeaders: {
        'HTTP-Referer': 'https://academix.app',
        'X-Title': 'Academix'
      },
      timeout: 90000, // 90 second timeout
      maxRetries: 0    // don't retry on timeout — let the user retry explicitly
    });
    this.modelName = process.env.OPENROUTER_MODEL || 'openrouter/free';
  }

  _isConfigured() {
    return !!(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim());
  }

  async _chat(messages, jsonMode = false) {
    if (!this._isConfigured()) {
      throw new Error('OpenRouter API key is not configured. Set OPENROUTER_API_KEY in backend environment variables.');
    }
    console.log(`[AI][OpenRouter] request started | model=${this.modelName}`);
    const start = Date.now();
    try {
      const params = {
        model: this.modelName,
        messages
      };
      if (jsonMode) {
        params.response_format = { type: 'json_object' };
      }
      const response = await this.client.chat.completions.create(params);
      const duration = Date.now() - start;
      console.log(`[AI][OpenRouter] response received | model=${this.modelName} | duration=${duration}ms`);
      return response.choices[0].message.content;
    } catch (error) {
      const duration = Date.now() - start;
      const status = error?.status || error?.response?.status;
      if (error?.code === 'ETIMEDOUT' || error?.type === 'request-timeout' || duration >= 89000) {
        throw new Error(`OpenRouter request timed out after ${Math.round(duration / 1000)}s. Try a faster model or check your connection.`);
      }
      if (status === 401) throw new Error('OpenRouter: Invalid or missing API key. Check OPENROUTER_API_KEY.');
      if (status === 402) throw new Error('OpenRouter: Insufficient credits. Please top up your OpenRouter account.');
      if (status === 403) throw new Error(`OpenRouter: Access denied to model "${this.modelName}". Check your plan or model name.`);
      if (status === 429) throw new Error('OpenRouter: Rate limit exceeded. Please wait a moment and retry.');
      if (status >= 500) throw new Error(`OpenRouter: Provider server error (${status}). Please retry later.`);
      console.error(`[AI][OpenRouter] error after ${duration}ms:`, error.message);
      throw new Error(`OpenRouter request failed: ${error.message}`);
    }
  }

  _cleanJson(raw) {
    let cleaned = (raw || '').trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    return cleaned;
  }

  async summarizeContent(text) {
    console.log('[AI][OpenRouter] task=summary');
    const messages = [
      {
        role: 'system',
        content: `You are Academix AI, an expert academic tutor. Generate concise, well-structured academic summaries in Markdown format.`
      },
      {
        role: 'user',
        content: `Summarize this academic document in structured, student-friendly Markdown format.

FORMATTING RULES:
1. Return ONLY Markdown output — no preamble, no "here is the summary" filler.
2. Use ## and ### headings.
3. Use bullet points for lists, numbered lists for sequences/steps.
4. Use **bold** for key terms.
5. Keep paragraphs short and scannable.
6. Do NOT invent information not present in the text.
7. Preserve all technical terminology.

Structure the summary with these sections where relevant:
## Overview
## Key Concepts
## Important Points
## Definitions
## Examples
## Exam Focus
## Quick Revision

Material Content:
${text}`
      }
    ];
    const raw = await this._chat(messages);
    return raw.trim();
  }

  async askQuestion(contextText, question) {
    console.log('[AI][OpenRouter] task=chat');
    const messages = [
      {
        role: 'system',
        content: `You are Academix AI, an academic learning assistant. Answer ONLY based on the provided Context Material. If the answer is not in the material, say clearly: "I couldn't find this information in the selected material." Do not hallucinate or invent information.`
      },
      {
        role: 'user',
        content: `Context Material:\n${contextText}\n\nQuestion:\n${question}`
      }
    ];
    const raw = await this._chat(messages);
    return raw.trim();
  }

  async generateQuiz(text) {
    console.log('[AI][OpenRouter] task=quiz');
    const messages = [
      {
        role: 'system',
        content: `You are an expert academic quiz generator. Always return valid JSON only.`
      },
      {
        role: 'user',
        content: `Generate up to 30 multiple-choice quiz questions from the material below.

STRICT JSON FORMAT — return ONLY a JSON object like:
{"questions": [...]}

Each question object must have EXACTLY these fields:
{
  "question": "string",
  "option_a": "string",
  "option_b": "string",
  "option_c": "string",
  "option_d": "string",
  "correct_answer": "A" or "B" or "C" or "D",
  "explanation": "string",
  "topic_tag": "1-3 word topic label",
  "difficulty": "easy" or "medium" or "hard"
}

Do NOT wrap in markdown code fences. Return raw JSON only.

Material Content:
${text}`
      }
    ];
    try {
      const raw = await this._chat(messages, true);
      const cleaned = this._cleanJson(raw);
      const parsed = JSON.parse(cleaned);
      if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
      if (Array.isArray(parsed)) return parsed;
      throw new Error('Unexpected quiz JSON structure from OpenRouter');
    } catch (err) {
      console.error('[AI][OpenRouter] generateQuiz parse error:', err.message);
      throw new Error('OpenRouter returned malformed quiz data. Please retry.');
    }
  }

  async generateMoreQuestions(text, existingQuestionsText) {
    console.log('[AI][OpenRouter] task=generateMoreQuestions');
    const messages = [
      {
        role: 'system',
        content: `You are an expert academic quiz generator. Always return valid JSON only.`
      },
      {
        role: 'user',
        content: `Generate exactly 10 NEW multiple-choice questions from the material. Do NOT repeat or closely resemble these existing questions:

${existingQuestionsText}

Return ONLY a JSON object: {"questions": [...]}

Each question:
{
  "question": "string",
  "option_a": "string",
  "option_b": "string",
  "option_c": "string",
  "option_d": "string",
  "correct_answer": "A"/"B"/"C"/"D",
  "explanation": "string",
  "topic_tag": "short label",
  "difficulty": "medium"
}

Material Content:
${text}`
      }
    ];
    try {
      const raw = await this._chat(messages, true);
      const cleaned = this._cleanJson(raw);
      const parsed = JSON.parse(cleaned);
      if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
      if (Array.isArray(parsed)) return parsed;
      throw new Error('Unexpected JSON structure');
    } catch (err) {
      console.error('[AI][OpenRouter] generateMoreQuestions parse error:', err.message);
      throw new Error('OpenRouter returned malformed question data. Please retry.');
    }
  }

  async generateRecommendation(stats) {
    console.log('[AI][OpenRouter] task=recommendation');
    const { quizTitle, score, percentage, wrongTopics, correctTopics } = stats;
    const messages = [
      {
        role: 'system',
        content: `You are Academix AI, an academic learning advisor.`
      },
      {
        role: 'user',
        content: `A student completed a quiz. Write a short, encouraging, personalized 3-4 sentence recommendation.

Quiz: ${quizTitle}
Score: ${score} (${percentage}%)
Correct topics: ${correctTopics?.join(', ') || 'None'}
Incorrect topics: ${wrongTopics?.join(', ') || 'None'}

Focus on: acknowledging performance, mentioning specific topics to review, suggesting a concrete study action.
Be direct and specific. No generic filler phrases.`
      }
    ];
    const raw = await this._chat(messages);
    return raw.trim();
  }

  async generateChatResponse(history, question, contextText = '', imageBuffer = null, mimeType = '') {
    console.log('[AI][OpenRouter] task=chat_response');
    let systemContent = `You are Academix AI Assistant, an expert academic tutor and study partner.

LANGUAGE DETECTION: Detect the user's language and style from their message and respond accordingly:
- Casual Tamil/Thanglish (e.g. "Explain this da", "Idha sollu") → respond in simple Thanglish/Tamil
- Formal English → respond in structured academic English
- Mixed → match the user's style naturally

Provide helpful, accurate responses formatted in Markdown.`;

    if (contextText) {
      systemContent += `\n\n=== UPLOADED DOCUMENT CONTEXT ===\n${contextText}\n\nIMPORTANT: Prioritize the uploaded material. If the answer is not in the material, state: "I couldn't find this information in the uploaded material."`;
    }

    if (imageBuffer && !contextText) {
      systemContent += `\n\n[Note: An image was uploaded. OpenRouter text models cannot directly analyze images. Please use Gemini for image analysis, or describe the image content in text.]`;
    }

    const messages = [{ role: 'system', content: systemContent }];

    if (history && history.length > 0) {
      history.slice(-6).forEach(m => {
        messages.push({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content
        });
      });
    }

    messages.push({ role: 'user', content: question });

    const raw = await this._chat(messages);
    return raw.trim();
  }

  async generateLearningContent(topic, materialText, wrongQuestions = [], meta = {}) {
    console.log('[AI][OpenRouter] task=learning_content');
    let wrongQuestionsBlock = '';
    if (wrongQuestions && wrongQuestions.length > 0) {
      wrongQuestionsBlock = `\nSTUDENT'S PREVIOUS INCORRECT QUESTIONS IN THIS TOPIC:\n` +
        wrongQuestions.map((q, idx) => `Question ${idx + 1}: ${q.question}\nSelected (Wrong): ${q.selected_answer || 'N/A'}\nCorrect: ${q.correct_answer || 'N/A'}\nExplanation: ${q.explanation || ''}`).join('\n\n');
    }

    const messages = [
      {
        role: 'system',
        content: `You are Academix AI, an expert academic tutor. Generate grounded personalized learning content in strict JSON format only. Never output markdown code fences or conversational text.`
      },
      {
        role: 'user',
        content: `A student needs personalized academic learning on the topic: "${topic}".

Ground all content in the provided source material.
Address any specific gaps shown in their previous incorrect questions.

SOURCE ACADEMIC MATERIAL:
${materialText}
${wrongQuestionsBlock}

Return ONLY valid JSON matching this schema:
{
  "topic": "${topic}",
  "difficulty": "Easy" or "Medium" or "Hard",
  "whyWeak": "1-2 sentence explanation of the student's missed concept",
  "simpleExplanation": "Clear conceptual explanation in 2-3 paragraphs",
  "whyItMatters": "Significance of this topic",
  "importantConcepts": [
    { "concept": "Concept Name", "description": "Crisp description" }
  ],
  "importantPoints": [
    "Exam key point 1",
    "Exam key point 2"
  ],
  "importantSubtopics": [
    { "title": "Subtopic Title", "keyPoint": "Takeaway" }
  ],
  "materialBasedLearning": {
    "sourceType": "${meta.fileType || 'Material'}",
    "slidesOrSections": [
      {
        "title": "Section Title",
        "reference": "Slide/Section Reference",
        "keyTakeaway": "Key takeaway"
      }
    ]
  },
  "examples": [
    {
      "title": "Example",
      "problem": "Problem",
      "solution": "Solution",
      "explanation": "Why correct"
    }
  ],
  "stepByStep": [
    { "step": 1, "title": "Step 1", "description": "Details" }
  ],
  "commonMistakes": [
    {
      "mistake": "Mistake",
      "whyWrong": "Why wrong",
      "howToFix": "How to fix"
    }
  ],
  "quickRevision": [
    "Point 1",
    "Point 2"
  ],
  "practiceQuestions": [
    {
      "id": 1,
      "question": "Practice question?",
      "options": ["A", "B", "C", "D"],
      "correctAnswerIndex": 0,
      "explanation": "Explanation"
    },
    {
      "id": 2,
      "question": "Practice question 2?",
      "options": ["A", "B", "C", "D"],
      "correctAnswerIndex": 1,
      "explanation": "Explanation"
    },
    {
      "id": 3,
      "question": "Practice question 3?",
      "options": ["A", "B", "C", "D"],
      "correctAnswerIndex": 2,
      "explanation": "Explanation"
    }
  ]
}`
      }
    ];

    try {
      const raw = await this._chat(messages, true);
      const cleaned = this._cleanJson(raw);
      return JSON.parse(cleaned);
    } catch (err) {
      console.error('[AI][OpenRouter] generateLearningContent parse error:', err.message);
      throw new Error(`OpenRouter failed to generate learning content: ${err.message}`);
    }
  }
}

module.exports = OpenRouterProvider;
