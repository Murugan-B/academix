class ChunkingService {
  constructor() {
    this.defaultChunkSize = 1000;
    this.defaultOverlap = 200;
  }

  chunkText(text, chunkSize = this.defaultChunkSize, overlap = this.defaultOverlap) {
    if (!text || typeof text !== 'string') return [];
    
    // Clean text (remove excessive newlines/spaces)
    let cleanText = text.replace(/\\n{3,}/g, '\\n\\n').replace(/[ \\t]{3,}/g, ' ').trim();
    
    if (cleanText.length <= chunkSize) {
      return [cleanText];
    }

    const chunks = [];
    let start = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;
      
      if (end >= cleanText.length) {
        chunks.push(cleanText.substring(start));
        break;
      }

      // Try to find a good breaking point (newline or period)
      let breakPoint = cleanText.lastIndexOf('\\n', end);
      if (breakPoint <= start) {
        breakPoint = cleanText.lastIndexOf('. ', end);
      }
      
      // If no natural break found, hard break at end
      if (breakPoint <= start) {
        breakPoint = end;
      } else {
        // Include the period in the chunk if it was a sentence break
        if (cleanText[breakPoint] === '.') breakPoint++;
      }

      chunks.push(cleanText.substring(start, breakPoint).trim());
      start = breakPoint - overlap; // Move start forward, leaving overlap
    }

    return chunks;
  }
}

module.exports = new ChunkingService();
