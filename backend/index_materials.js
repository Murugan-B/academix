require('dotenv').config();
const db = require('./db');

function chunkMaterialText(materialId, text, materialTitle) {
  const pages = text.split(/(?=--\s*\d+\s*of\s*\d+\s*--|---\s*Page\s*\d+\s*---|Slide\s*\d+:)/i);
  const chunks = [];
  let chunkIndex = 0;

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageText = pages[pIdx].trim();
    if (!pageText) continue;

    let pageNum = pIdx + 1;
    const pageMatch = pageText.match(/--\s*(\d+)\s*of\s*\d+\s*--|---\s*Page\s*(\d+)\s*---|Slide\s*(\d+):/i);
    if (pageMatch) {
      pageNum = parseInt(pageMatch[1] || pageMatch[2] || pageMatch[3], 10);
    }

    const headingMatch = pageText.match(/(?:^[0-9.]+\s+([A-Z\s]{4,})|^([A-Z\s]{5,}))/m);
    const sectionTitle = headingMatch ? (headingMatch[1] || headingMatch[2]).trim() : null;

    if (pageText.length > 1200) {
      const subChunks = pageText.match(/[\s\S]{1,1000}(?:\n|$|\. )/g) || [pageText];
      for (const sub of subChunks) {
        if (sub.trim().length > 30) {
          chunks.push({
            material_id: materialId,
            chunk_index: chunkIndex++,
            chunk_text: sub.trim(),
            metadata: {
              page_number: pageNum,
              section_title: sectionTitle,
              material_title: materialTitle
            }
          });
        }
      }
    } else {
      chunks.push({
        material_id: materialId,
        chunk_index: chunkIndex++,
        chunk_text: pageText,
        metadata: {
          page_number: pageNum,
          section_title: sectionTitle,
          material_title: materialTitle
        }
      });
    }
  }

  return chunks;
}

async function indexAllMaterials() {
  const mats = await db.query('SELECT id, title, extracted_text FROM materials WHERE extracted_text IS NOT NULL');
  console.log('Found materials:', mats.rowCount);
  for (const m of mats.rows) {
    const chunks = chunkMaterialText(m.id, m.extracted_text, m.title);
    console.log('Material:', m.title, 'Generated chunks:', chunks.length);
    for (const c of chunks) {
      await db.query(
        `INSERT INTO material_chunks (material_id, chunk_index, chunk_text, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (material_id, chunk_index)
         DO UPDATE SET chunk_text = EXCLUDED.chunk_text, metadata = EXCLUDED.metadata`,
        [c.material_id, c.chunk_index, c.chunk_text, JSON.stringify(c.metadata)]
      );
    }
  }
  const countRes = await db.query('SELECT count(*) FROM material_chunks');
  console.log('Total material_chunks in DB:', countRes.rows[0].count);
}

indexAllMaterials().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
