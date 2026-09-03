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

class EmptyDocumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EmptyDocumentError';
  }
}

class DownloadError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'DownloadError';
    this.details = details;
  }
}

class ExtractionError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ExtractionError';
    this.details = details;
  }
}

/**
 * Helper to save buffer to a temporary file, run a function with the path, and clean up.
 */
const withTempFile = async (buffer, ext, fn) => {
  const tempPath = path.join(os.tmpdir(), `${randomUUID()}.${ext}`);
  try {
    fs.writeFileSync(tempPath, buffer);
    return await fn(tempPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
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
      const result = await officeParser.parseOffice(buffer);
      extractedText = typeof result === 'string' ? result : (result?.toString() || '');
    } else if (ext === 'pptx' || mime.includes('presentationml')) {
      const result = await officeParser.parseOffice(buffer);
      extractedText = typeof result === 'string' ? result : (result?.toString() || '');
    } else if (ext === 'doc' || mime.includes('msword')) {
      const extractor = new WordExtractor();
      extractedText = await withTempFile(buffer, 'doc', async (tempPath) => {
        const extracted = await extractor.extract(tempPath);
        return extracted.getBody();
      });
    } else if (ext === 'ppt' || mime.includes('ms-powerpoint')) {
      extractedText = await withTempFile(buffer, 'ppt', async (tempPath) => {
        return new Promise((resolve, reject) => {
          ppt2text(tempPath, (err, text) => {
            if (err) reject(err);
            else resolve(text);
          });
        });
      });
    } else if (ext === 'txt' || mime.includes('text/plain')) {
      extractedText = buffer.toString('utf-8');
    } else {
      throw new Error(`Unsupported file format: .${ext} (${mime}). Supported: pdf, docx, pptx, doc, ppt, txt.`);
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
    throw new ExtractionError(`Unable to extract text from ${ext.toUpperCase()}: ${err.message}`, err);
  }
};

module.exports = {
  extractTextFromMaterial,
  getSecureDownloadUrl,
  getCloudinaryType,
  EmptyDocumentError,
  DownloadError,
  ExtractionError,
};
