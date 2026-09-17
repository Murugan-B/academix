const axios = require('axios');
const { PDFParse } = require('pdf-parse');
const cloudinary = require('./cloudinary');
const officeParser = require('officeparser');
const WordExtractor = require('word-extractor');
const ppt2text = require('ppt-to-text');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const AdmZip = require('adm-zip');
const mammoth = require('mammoth');

class EmptyDocumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmptyDocumentError';
  }
}

class DownloadError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DownloadError';
    this.originalError = originalError;
  }
}

class ExtractionError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'ExtractionError';
    this.originalError = originalError;
  }
}

class UnsupportedFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

/**
 * Robust in-memory PPTX slide text extractor preserving slide numbers, titles, bullet points, tables, and notes.
 */
const extractPptxFromBuffer = (buffer) => {
  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    // Find all slide XML files and extract their index
    const slideEntries = [];
    const notesMap = {}; // slideNum -> notes text

    zipEntries.forEach(entry => {
      const name = entry.entryName;
      const slideMatch = name.match(/^ppt\/slides\/slide([0-9]+)\.xml$/i);
      if (slideMatch) {
        slideEntries.push({
          slideNum: parseInt(slideMatch[1], 10),
          entry
        });
      }
      const notesMatch = name.match(/^ppt\/notesSlides\/notesSlide([0-9]+)\.xml$/i);
      if (notesMatch) {
        try {
          const notesXml = entry.getData().toString('utf8');
          const textMatches = notesXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
          const text = textMatches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join(' ');
          if (text) notesMap[parseInt(notesMatch[1], 10)] = text;
        } catch (e) {
          // ignore notes error
        }
      }
    });

    if (slideEntries.length === 0) {
      return '';
    }

    // Sort slides numerically: Slide 1, Slide 2, ...
    slideEntries.sort((a, b) => a.slideNum - b.slideNum);

    const slideOutputs = [];

    slideEntries.forEach(({ slideNum, entry }) => {
      const xml = entry.getData().toString('utf8');

      // Helper to extract text from a node
      const getXmlText = (nodeXml) => {
        const matches = nodeXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
        return matches.map(m => m.replace(/<[^>]+>/g, '')).join('').trim();
      };

      // 1. Identify Title shapes vs Body shapes
      let titleText = '';
      const contentParagraphs = [];

      // Split XML by shape <p:sp>
      const shapeMatches = xml.match(/<p:sp[\s\S]*?<\/p:sp>/gi) || [];

      shapeMatches.forEach(shapeXml => {
        const isTitleShape = /type="(title|ctrTitle)"/i.test(shapeXml);
        const pMatches = shapeXml.match(/<a:p[\s\S]*?<\/a:p>/gi) || [];
        
        pMatches.forEach(pXml => {
          const pText = getXmlText(pXml);
          if (!pText) return;

          if (isTitleShape && !titleText) {
            titleText = pText;
          } else {
            // Check if bullet point
            const hasBullet = /<a:buChar|<a:buAutoNum/i.test(pXml) || pXml.includes('lvl="1"') || pXml.includes('lvl="2"');
            const prefix = hasBullet ? '- ' : '';
            contentParagraphs.push(`${prefix}${pText}`);
          }
        });
      });

      // 2. Extract Tables <a:tbl>
      const tableMatches = xml.match(/<a:tbl[\s\S]*?<\/a:tbl>/gi) || [];
      tableMatches.forEach(tblXml => {
        const trMatches = tblXml.match(/<a:tr[\s\S]*?<\/a:tr>/gi) || [];
        const tableRows = [];
        trMatches.forEach(trXml => {
          const tcMatches = trXml.match(/<a:tc[\s\S]*?<\/a:tc>/gi) || [];
          const cells = tcMatches.map(tcXml => getXmlText(tcXml)).filter(Boolean);
          if (cells.length > 0) {
            tableRows.push(cells.join(' | '));
          }
        });
        if (tableRows.length > 0) {
          contentParagraphs.push('\nTable:\n' + tableRows.join('\n'));
        }
      });

      // 3. Fallback: if no shapes found via <p:sp>, extract all <a:t>
      if (!titleText && contentParagraphs.length === 0) {
        const allText = getXmlText(xml);
        if (allText) {
          contentParagraphs.push(allText);
        }
      }

      // 4. Format slide block
      const hasContent = titleText || contentParagraphs.length > 0;
      if (!hasContent) {
        slideOutputs.push(`Slide ${slideNum}:\n[Image-only or diagram slide]`);
      } else {
        let block = `Slide ${slideNum}:`;
        if (titleText) {
          block += `\nTitle:\n${titleText}`;
        }
        if (contentParagraphs.length > 0) {
          block += `\nContent:\n${contentParagraphs.join('\n')}`;
        }
        if (notesMap[slideNum]) {
          block += `\nSpeaker Notes:\n${notesMap[slideNum]}`;
        }
        slideOutputs.push(block);
      }
    });

    return slideOutputs.join('\n\n');
  } catch (err) {
    console.error('[PPTX Extraction] Error:', err.message);
    throw new ExtractionError(`Failed to extract PPTX slides: ${err.message}`, err);
  }
};

/**
 * Robust DOCX text extractor using mammoth with structured heading and table support.
 */
const extractDocxFromBuffer = async (buffer) => {
  try {
    // 1. Try mammoth markdown conversion first (preserves headings, lists, tables)
    const result = await mammoth.convertToMarkdown({ buffer });
    if (result && result.value && result.value.trim().length > 15) {
      return result.value.trim();
    }

    // 2. Fallback to mammoth raw text
    const rawResult = await mammoth.extractRawText({ buffer });
    if (rawResult && rawResult.value && rawResult.value.trim().length > 15) {
      return rawResult.value.trim();
    }

    // 3. Fallback to direct XML parsing of word/document.xml via AdmZip
    const zip = new AdmZip(buffer);
    const docEntry = zip.getEntry('word/document.xml');
    if (docEntry) {
      const xml = docEntry.getData().toString('utf8');
      const pMatches = xml.match(/<w:p[\s\S]*?<\/w:p>/gi) || [];
      const lines = pMatches.map(pXml => {
        const isHeading = /<w:pStyle\s+w:val="Heading[1-6]"/i.test(pXml);
        const tMatches = pXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
        const text = tMatches.map(m => m.replace(/<[^>]+>/g, '')).join('').trim();
        if (!text) return '';
        return isHeading ? `## ${text}` : text;
      }).filter(Boolean);

      if (lines.length > 0) {
        return lines.join('\n\n');
      }
    }

    return '';
  } catch (err) {
    console.error('[DOCX Extraction] Error:', err.message);
    throw new ExtractionError(`Failed to extract DOCX text: ${err.message}`, err);
  }
};

/**
 * Determine the Cloudinary delivery type from the stored file_url.
 * - URLs containing '/authenticated/' → type is 'authenticated'
 * - All others (e.g. '/upload/') → type is 'upload' (public)
 */
const getCloudinaryType = (fileUrl) => {
  if (fileUrl && fileUrl.includes('/authenticated/')) return 'authenticated';
  return 'upload';
};

/**
 * Get the best URL to fetch a material from Cloudinary:
 * - authenticated type → signed private_download_url (bypasses ACL)
 * - upload type (public) → raw file_url works directly
 */
const getSecureDownloadUrl = (material) => {
  const cloudinaryType = getCloudinaryType(material.file_url);
  console.log(`[CLOUDINARY] Material ${material.id} type: ${cloudinaryType}`);

  if (cloudinaryType === 'authenticated') {
    if (!material.cloudinary_public_id) {
      throw new DownloadError('Material has no stored Cloudinary public ID.');
    }
    const signedUrl = cloudinary.utils.private_download_url(material.cloudinary_public_id, '', {
      resource_type: 'raw',
      type: 'authenticated',
    });
    console.log(`[CLOUDINARY] Using signed URL: ${signedUrl.substring(0, 80)}...`);
    return signedUrl;
  }

  // Public upload — raw URL works without signing
  console.log(`[CLOUDINARY] Using public URL: ${material.file_url.substring(0, 80)}...`);
  return material.file_url;
};

/**
 * Download a file buffer from a URL using axios (follows redirects automatically).
 */
const downloadBuffer = async (url) => {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    maxRedirects: 5,
    timeout: 30000,
  });
  return Buffer.from(response.data, 'binary');
};

/**
 * Main extraction entry point. Accepts a DB material record.
 * Returns { text, fileType } or throws a typed error.
 */
const extractTextFromMaterial = async (material) => {
  console.log(`[AI SUMMARY] ── Extraction started ──`);
  console.log(`[AI SUMMARY] Material ID  : ${material.id}`);
  console.log(`[AI SUMMARY] Filename     : ${material.file_name}`);
  console.log(`[AI SUMMARY] MIME type    : ${material.file_type}`);
  console.log(`[AI SUMMARY] Public ID    : ${material.cloudinary_public_id}`);
  console.log(`[AI SUMMARY] Stored URL   : ${material.file_url}`);

  // Step 0: Check DB Cache
  if (material.extracted_text) {
    console.log(`[AI SUMMARY] Returning cached extracted text from DB (0ms extraction time)`);
    return { text: material.extracted_text, fileType: material.file_name.split('.').pop().toLowerCase() };
  }

  // Step 1: Resolve fetch URL
  let fetchUrl;
  try {
    fetchUrl = getSecureDownloadUrl(material);
  } catch (err) {
    console.error(`[AI SUMMARY] URL resolution failed:`, err.message);
    throw err;
  }

  // Step 2: Download
  let buffer;
  try {
    console.log(`[AI SUMMARY] Downloading material...`);
    buffer = await downloadBuffer(fetchUrl);
    console.log(`[AI SUMMARY] Downloaded. Size: ${buffer.length} bytes`);
  } catch (err) {
    console.error(`[AI SUMMARY] Download error: HTTP ${err.response?.status}`, err.message);
    throw new DownloadError('Failed to access the material file.', err);
  }

  // Step 3: Detect file type
  const ext = material.file_name.split('.').pop().toLowerCase();
  const mime = (material.file_type || '').toLowerCase();
  console.log(`[AI SUMMARY] Format: .${ext} | MIME: ${mime}`);

  // Step 4: Extract text
  let extractedText = '';
  try {
    console.log(`[AI SUMMARY] Extracting text...`);

    if (ext === 'pdf' || mime.includes('pdf')) {
      const parser = new PDFParse(new Uint8Array(buffer), { verbosity: 0 });
      const data = await parser.getText();
      extractedText = data.text;
    } else if (ext === 'docx' || mime.includes('wordprocessingml')) {
      extractedText = await extractDocxFromBuffer(buffer);
    } else if (ext === 'pptx' || mime.includes('presentationml')) {
      extractedText = extractPptxFromBuffer(buffer);
    } else if (ext === 'doc' || mime.includes('msword')) {
      const WordExtractor = require('word-extractor');
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(buffer);
      extractedText = extracted.getBody();
    } else if (ext === 'ppt' || mime.includes('ms-powerpoint')) {
      const ppt2text = require('ppt-to-text');
      extractedText = ppt2text.extractText(buffer);
    } else if (ext === 'txt' || mime.includes('text/plain')) {
      extractedText = buffer.toString('utf-8');
    } else {
      throw new UnsupportedFormatError(`This file format is not supported for AI text extraction.`);
    }

    // Normalize whitespace — make sure it's a string first
    extractedText = String(extractedText)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{3,}/g, '  ')
      .trim();

    console.log(`[AI SUMMARY] Extracted text length: ${extractedText.length} chars`);

    if (!extractedText || extractedText.length < 20) {
      throw new EmptyDocumentError(
        'No readable text found in the material. ' +
        'It may be image-based (scanned), password-protected, or contain no text.'
      );
    }
    
    // Truncate to prevent huge payloads blocking the AI API (max 50,000 chars)
    if (extractedText.length > 50000) {
      console.log(`[AI SUMMARY] Truncating text from ${extractedText.length} to 50,000 chars`);
      extractedText = extractedText.substring(0, 50000) + '\n\n...[Content Truncated due to size limits]';
    }

    // Save to DB cache
    try {
      const db = require('../db');
      await db.query(
        'UPDATE materials SET extracted_text = $1, extraction_status = $2, extracted_at = NOW() WHERE id = $3',
        [extractedText, 'COMPLETED', material.id]
      );
      console.log(`[AI SUMMARY] Cached extracted text to DB for material ${material.id}`);
    } catch (dbErr) {
      console.error(`[AI SUMMARY] Failed to cache extracted text:`, dbErr.message);
    }

    return { text: extractedText, fileType: ext };
  } catch (err) {
    console.error(`[AI SUMMARY] Extraction error:`, err.message);
    console.error(`[AI SUMMARY] Stack:`, err.stack);
    if (err instanceof EmptyDocumentError) throw err;
    if (err instanceof UnsupportedFormatError) throw err;
    throw new ExtractionError(`Unable to extract readable text from this material.`, err);
  }
};

module.exports = {
  extractTextFromMaterial,
  extractPptxFromBuffer,
  extractDocxFromBuffer,
  getSecureDownloadUrl,
  getCloudinaryType,
  EmptyDocumentError,
  DownloadError,
  ExtractionError,
  UnsupportedFormatError,
};
