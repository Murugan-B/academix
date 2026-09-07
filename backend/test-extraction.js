require('dotenv').config({ path: 'e:/academic-hub/backend/.env' });
const db = require('./db');
const { extractTextFromMaterial } = require('./utils/textExtractor');

async function test() {
  try {
    const result = await db.query('SELECT * FROM materials WHERE id = $1', ['9e135392-dc0d-4410-9824-49565fdf813c']);
    const material = result.rows[0];
    if (!material) throw new Error("Material not found");
    
    console.log("Material found:", material.title);
    
    console.log("Extracting text...");
    const { text, fileType } = await extractTextFromMaterial(material);
    
    console.log("Extraction successful!");
    console.log("Text length:", text.length);
    console.log("Snippet:", text.substring(0, 100));
  } catch (err) {
    console.error("FAILED:", err);
  }
  process.exit(0);
}

test();
