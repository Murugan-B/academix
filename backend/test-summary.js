require('dotenv').config({ path: 'e:/academic-hub/backend/.env' });
const aiService = require('./services/ai/aiService');

async function test() {
  try {
    console.log("Testing summarize with large payload...");
    const largeText = "This is a test document. ".repeat(1500); // 1500 * 25 = 37,500 chars
    const res = await aiService.summarizeContent('local', largeText);
    console.log("SUCCESS:", res.substring(0, 100) + "...");
  } catch (err) {
    console.error("FAILED:", err);
  }
}

test();
