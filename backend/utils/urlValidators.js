/**
 * URL Validators and Metadata Extractors for Academix External Educational Resources
 */

/**
 * Validate and parse Google Drive file or folder share links
 * Supports:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://docs.google.com/document/d/DOC_ID/...
 * - https://docs.google.com/presentation/d/PRES_ID/...
 * - https://docs.google.com/spreadsheets/d/SHEET_ID/...
 * - https://drive.google.com/drive/folders/FOLDER_ID
 */
function parseGoogleDriveUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  try {
    const urlObj = new URL(trimmed);
    const hostname = urlObj.hostname.toLowerCase();

    if (!hostname.includes('drive.google.com') && !hostname.includes('docs.google.com')) {
      return null;
    }

    let fileId = null;
    let driveType = 'FILE'; // FILE, FOLDER, DOC, PRESENTATION, SPREADSHEET

    // Match /file/d/ID
    const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
      driveType = 'FILE';
    }

    // Match id=ID query param
    if (!fileId && urlObj.searchParams.has('id')) {
      fileId = urlObj.searchParams.get('id');
    }

    // Match Google Docs /document/d/ID
    const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      fileId = docMatch[1];
      driveType = 'DOC';
    }

    // Match Google Slides /presentation/d/ID
    const presMatch = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (presMatch) {
      fileId = presMatch[1];
      driveType = 'PRESENTATION';
    }

    // Match Google Sheets /spreadsheets/d/ID
    const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetMatch) {
      fileId = sheetMatch[1];
      driveType = 'SPREADSHEET';
    }

    // Match Google Drive Folder /drive/folders/ID
    const folderMatch = trimmed.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) {
      fileId = folderMatch[1];
      driveType = 'FOLDER';
    }

    if (!fileId) return null;

    let previewUrl = null;
    if (driveType === 'FILE') {
      previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    } else if (driveType === 'DOC') {
      previewUrl = `https://docs.google.com/document/d/${fileId}/preview`;
    } else if (driveType === 'PRESENTATION') {
      previewUrl = `https://docs.google.com/presentation/d/${fileId}/preview`;
    } else if (driveType === 'SPREADSHEET') {
      previewUrl = `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    }

    return {
      isValid: true,
      provider: 'GOOGLE_DRIVE',
      originalUrl: trimmed,
      fileId,
      driveType,
      previewUrl,
      embeddable: Boolean(previewUrl),
      permissionNotice: 'Ensure your Google Drive sharing setting is set to "Anyone with the link can view".'
    };
  } catch (err) {
    return null;
  }
}

/**
 * Validate and parse YouTube video URLs
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
function parseYouTubeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  try {
    const urlObj = new URL(trimmed);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');

    if (hostname !== 'youtube.com' && hostname !== 'youtu.be' && hostname !== 'm.youtube.com') {
      return null;
    }

    let videoId = null;

    // Pattern 1: youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1).split(/[?#&]/)[0];
    }
    // Pattern 2: youtube.com/watch?v=VIDEO_ID
    else if (urlObj.searchParams.has('v')) {
      videoId = urlObj.searchParams.get('v');
    }
    // Pattern 3: youtube.com/embed/VIDEO_ID or /shorts/VIDEO_ID
    else {
      const match = urlObj.pathname.match(/\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
      if (match) {
        videoId = match[2];
      }
    }

    // YouTube IDs must be 11 characters alphanumeric, hyphen, underscore
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return null;
    }

    return {
      isValid: true,
      provider: 'YOUTUBE',
      originalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      maxResThumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      embeddable: true
    };
  } catch (err) {
    return null;
  }
}

/**
 * Validate generic educational resource URL
 */
function parseGenericEducationalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  try {
    const urlObj = new URL(trimmed);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    return {
      isValid: true,
      provider: 'EXTERNAL_LINK',
      originalUrl: trimmed,
      domain: urlObj.hostname.replace(/^www\./, ''),
      embeddable: false
    };
  } catch (err) {
    return null;
  }
}

/**
 * Unified validator for external resource URLs
 */
function validateExternalResourceUrl(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  // 1. Check Google Drive
  const driveInfo = parseGoogleDriveUrl(url);
  if (driveInfo) return driveInfo;

  // 2. Check YouTube
  const ytInfo = parseYouTubeUrl(url);
  if (ytInfo) return ytInfo;

  // 3. Check Generic HTTP/HTTPS link
  const genericInfo = parseGenericEducationalUrl(url);
  if (genericInfo) return genericInfo;

  return { isValid: false, error: 'Invalid or unsupported external URL' };
}

module.exports = {
  parseGoogleDriveUrl,
  parseYouTubeUrl,
  parseGenericEducationalUrl,
  validateExternalResourceUrl
};
