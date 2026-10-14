require('dotenv').config();
const GeminiProvider = require('./services/ai/geminiProvider');
const gp = new GeminiProvider();

async function test() {
  console.log('Candidate models:', gp.candidateModels);
  try {
    const res = await gp._generateContentWithFallback({
      contents: 'Return JSON: {"test": 123}',
      config: { responseMimeType: 'application/json' }
    });
    console.log('Success:', res.text);
  } catch (err) {
    console.error('Caught error:', err.message);
  }
}

test().then(() => process.exit(0)).catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
