const db = require('../db');
const axios = require('axios');
const pdf = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const generateAiSummary = async (resourceId, fileUrl) => {
  console.log(`Starting background AI processing for resource: ${resourceId}`);
  
  try {
    // 1. Download the PDF from Cloudinary
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    // 2. Parse text from PDF
    const data = await pdf(buffer);
    // Limit to ~30k characters to stay well within token limits and optimize speed
    const extractedText = data.text.substring(0, 30000); 

    if (!extractedText.trim()) {
      throw new Error("No text extracted from PDF");
    }

    const generateWithFallback = async (contents) => {
      const candidates = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
      for (const m of candidates) {
        try {
          return await ai.models.generateContent({ model: m, contents });
        } catch (e) {
          console.warn(`[aiHelpers] Model ${m} failed: ${e.message}`);
        }
      }
      throw new Error('All candidate models failed in aiHelpers');
    };

    // 3. Generate Summary, Quiz, and Flashcards concurrently with Gemini
    const [summaryRes, quizRes, flashcardsRes] = await Promise.all([
      generateWithFallback(`Summarize this academic document concisely in a few paragraphs:\n\n${extractedText}`),
      generateWithFallback(`Create a 3-question multiple choice quiz from this text. Output ONLY valid JSON in this exact format: [{"q": "Question?", "options": ["A", "B", "C", "D"], "a": "A"}]. Text:\n\n${extractedText}`),
      generateWithFallback(`Create 3 flashcards from this text for studying. Output ONLY valid JSON in this exact format: [{"front": "Concept", "back": "Definition"}]. Text:\n\n${extractedText}`)
    ]);

    const summary = summaryRes.text;
    
    // Helper to parse JSON that might be wrapped in markdown code blocks
    const cleanJson = (str) => {
      let cleaned = str.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    };

    const quiz = JSON.stringify(cleanJson(quizRes.text));
    const flashcards = JSON.stringify(cleanJson(flashcardsRes.text));

    // 4. Update the DB
    await db.query(
      `UPDATE resources 
       SET ai_summary = $1, ai_quiz = $2, ai_flashcards = $3
       WHERE id = $4`,
      [summary, quiz, flashcards, resourceId]
    );

    console.log(`Finished AI processing for resource: ${resourceId}`);
  } catch (error) {
    console.error(`AI processing failed for resource ${resourceId}:`, error.message);
  }
};

module.exports = { generateAiSummary };
