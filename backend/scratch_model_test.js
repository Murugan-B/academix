require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const km = require('./services/ai/geminiKeyManager');
const slot = km.acquireKey([]);
if (!slot) { console.log('NO KEYS CONFIGURED'); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: slot.key });

async function testModel(modelId) {
  try {
    const res = await ai.models.generateContent({
      model: modelId,
      contents: 'Return valid JSON object: {"status": "ok"}',
      config: { responseMimeType: 'application/json' }
    });
    const text = res.text || '';
    return { ok: true, preview: text.slice(0, 100) };
  } catch (err) {
    return { ok: false, error: err.message.slice(0, 200) };
  }
}

async function run() {
  const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash'
  ];

  console.log('=== Testing candidate models ===');
  for (const m of modelsToTest) {
    process.stdout.write(`Testing ${m} ... `);
    const r = await testModel(m);
    if (r.ok) {
      console.log(`OK -> ${r.preview.trim()}`);
    } else {
      console.log(`FAIL -> ${r.error.trim()}`);
    }
  }
}

run().catch(e => console.error('Fatal:', e.message));
