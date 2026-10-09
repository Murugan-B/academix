const db = require('../db');
const aiService = require('../services/ai/aiService');
const axios = require('axios');
const { classifyQuery, retrieveCurrentInformation, formatCurrentContextBlock } = require('../services/ai/freshnessService');

/**
 * Fetch external educational resources via Wikipedia API & DuckDuckGo fallback
 */
async function fetchExternalEducationalResults(query) {
  const externalResults = [];
  const cleanQuery = query.replace(/[?.,!]/g, '').trim();

  if (!cleanQuery) return externalResults;

  // 1. Wikipedia API Search for encyclopedic concepts
  try {
    const wikiSearch = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: cleanQuery,
        format: 'json',
        utf8: 1,
        srlimit: 4
      },
      headers: { 'User-Agent': 'AcademixPublicSearch/1.0' },
      timeout: 4000
    });

    const hits = wikiSearch.data?.query?.search || [];
    for (const hit of hits) {
      try {
        const pageRes = await axios.get('https://en.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            prop: 'extracts|info',
            inprop: 'url',
            exintro: 1,
            explaintext: 1,
            titles: hit.title,
            format: 'json'
          },
          headers: { 'User-Agent': 'AcademixPublicSearch/1.0' },
          timeout: 3500
        });

        const pages = pageRes.data?.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        if (pageId && pages[pageId]?.extract) {
          externalResults.push({
            id: `wiki-${pageId}`,
            title: pages[pageId].title,
            snippet: pages[pageId].extract.substring(0, 300) + (pages[pageId].extract.length > 300 ? '...' : ''),
            url: pages[pageId].fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pages[pageId].title.replace(/ /g, '_'))}`,
            source: 'Wikipedia (Verified Reference)',
            sourceType: 'EXTERNAL_VERIFIED_REFERENCE',
            badge: 'External Reference'
          });
        }
      } catch (pageErr) {
        // Continue with other items
      }
    }
  } catch (err) {
    console.warn('[PublicSearch] Wikipedia external search notice:', err.message);
  }

  // 2. DuckDuckGo Instant Answer if Wikipedia returned few results
  if (externalResults.length < 2) {
    try {
      const ddgRes = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`, {
        timeout: 3500,
        headers: { 'User-Agent': 'AcademixPublicSearch/1.0' }
      });
      const data = ddgRes.data;
      if (data.AbstractText) {
        externalResults.push({
          id: `ddg-${Date.now()}`,
          title: data.Heading || cleanQuery,
          snippet: data.AbstractText,
          url: data.AbstractURL || 'https://duckduckgo.com',
          source: 'DuckDuckGo Instant Answer',
          sourceType: 'EXTERNAL_VERIFIED_REFERENCE',
          badge: 'External Reference'
        });
      }
    } catch (err) {
      console.warn('[PublicSearch] DuckDuckGo fallback search notice:', err.message);
    }
  }

  return externalResults;
}

/**
 * 1. Normal Search
 * Searches approved public student resources + external verified educational references
 */
exports.normalSearch = async (req, res) => {
  const { query, category } = req.query;

  try {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.json({
        query: '',
        internalResults: [],
        externalResults: [],
        totalInternal: 0,
        totalExternal: 0
      });
    }

    const searchTerm = `%${query.trim()}%`;

    // 1. Fetch ONLY approved public student resources
    // Strictly isolates internal confidential materials, unpublished syllabus, draft materials, and private records
    const internalSql = `
      SELECT 
        sr.id,
        sr.title,
        sr.description,
        sr.tags,
        sr.file_name,
        sr.file_url,
        sr.file_type,
        sr.file_size,
        sr.created_at,
        d.name as department_name,
        s.name as subject_name,
        'APPROVED_ACADEMIC_RESOURCE' as source_type
      FROM student_resources sr
      LEFT JOIN departments d ON sr.department_id = d.id
      LEFT JOIN subjects s ON sr.subject_id = s.id
      WHERE sr.status = 'APPROVED'
        AND (
          sr.title ILIKE $1 
          OR sr.description ILIKE $1 
          OR array_to_string(sr.tags, ' ') ILIKE $1
          OR s.name ILIKE $1
        )
      ORDER BY sr.created_at DESC
      LIMIT 20
    `;

    const internalRes = await db.query(internalSql, [searchTerm]);

    const formattedInternal = internalRes.rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description || 'Public academic notes & study material',
      tags: r.tags || [],
      fileName: r.file_name,
      fileUrl: r.file_url,
      fileType: r.file_type,
      fileSize: r.file_size,
      department: r.department_name,
      subject: r.subject_name,
      createdAt: r.created_at,
      sourceType: 'APPROVED_ACADEMIC_RESOURCE',
      sourceBadge: 'Approved Academic Note'
    }));

    // 2. Fetch external educational resources
    const externalResults = await fetchExternalEducationalResults(query.trim());

    res.json({
      query: query.trim(),
      internalResults: formattedInternal,
      externalResults,
      totalInternal: formattedInternal.length,
      totalExternal: externalResults.length
    });
  } catch (error) {
    console.error('Normal search error:', error);
    res.status(500).json({ message: 'Error processing public search.' });
  }
};

/**
 * 2. Public AI Search
 * Performs AI grounded answering without exposing private institutional materials
 */
exports.aiSearch = async (req, res) => {
  const { query, provider = 'gemini' } = req.body;

  try {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'Search question is required.' });
    }

    const cleanQuery = query.trim();
    const queryClassification = classifyQuery(cleanQuery, false);

    let retrievedContext = '';
    let sources = [];
    let sourceClassification = 'GENERAL_AI_KNOWLEDGE';
    let citationDisclaimer = 'Generated using general AI academic intelligence. No internal institutional material was retrieved.';

    // 1. Check if time-sensitive query (e.g. current office holders, latest news)
    if (queryClassification.isTimeSensitive) {
      const liveSources = await retrieveCurrentInformation(cleanQuery);
      if (liveSources.length > 0) {
        sourceClassification = 'EXTERNAL_VERIFIED_REFERENCE';
        citationDisclaimer = 'Grounded in fresh, verified external live sources.';
        sources = liveSources.map(s => ({
          title: s.title,
          url: s.url,
          snippet: s.snippet,
          sourceType: 'EXTERNAL_VERIFIED_REFERENCE',
          sourceName: s.source
        }));
        retrievedContext = formatCurrentContextBlock(liveSources);
      }
    } else {
      // 2. Search approved public student resources for relevant academic context
      const searchTerm = `%${cleanQuery}%`;
      const publicDocsRes = await db.query(
        `SELECT id, title, description, tags, file_name, file_url
         FROM student_resources
         WHERE status = 'APPROVED'
           AND (title ILIKE $1 OR description ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1)
         ORDER BY created_at DESC
         LIMIT 3`,
        [searchTerm]
      );

      if (publicDocsRes.rows.length > 0) {
        sourceClassification = 'APPROVED_ACADEMIC_RESOURCE';
        citationDisclaimer = 'Grounded in approved public academic resources.';
        sources = publicDocsRes.rows.map(doc => ({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          fileUrl: doc.file_url,
          sourceType: 'APPROVED_ACADEMIC_RESOURCE',
          sourceName: 'Academix Approved Resource'
        }));

        retrievedContext = `\n=== RETRIEVED APPROVED PUBLIC ACADEMIC MATERIALS ===\n` +
          publicDocsRes.rows.map((doc, idx) => `[Source ${idx + 1}] Title: ${doc.title}\nDescription: ${doc.description || 'N/A'}`).join('\n\n') +
          `\n\nINSTRUCTIONS: Answer the user question based on these public resources where applicable. If the context does not fully answer the question, supplement with accurate academic explanations. Do not hallucinate private data.`;
      }
    }

    // Call LLM provider pipeline
    const prompt = `You are Academix AI, an intelligent educational assistant.
User Question: "${cleanQuery}"

${retrievedContext}

Please provide a clear, accurate, and pedagogical explanation. Format your answer with clean Markdown (bullet points, clear headers, concise definitions).
If citing sources, reference only genuine verified sources from the context provided. If no internal academic material was retrieved, rely on general knowledge and explicitly explain the concept clearly.`;

    let aiAnswer = '';
    try {
      const selectedProvider = aiService.getProvider(provider || 'gemini');
      aiAnswer = await selectedProvider.askQuestion(retrievedContext || 'General academic domain knowledge', cleanQuery);
    } catch (aiErr) {
      console.error('[PublicAISearch] Primary AI provider error, fallback:', aiErr.message);
      // Try openrouter or gemini fallback
      const fallbackProvider = provider === 'gemini' ? 'openrouter' : 'gemini';
      try {
        const fallback = aiService.getProvider(fallbackProvider);
        aiAnswer = await fallback.askQuestion(retrievedContext || 'General academic domain knowledge', cleanQuery);
      } catch (fallbackErr) {
        throw new Error('AI search provider is temporarily unavailable.');
      }
    }

    res.json({
      query: cleanQuery,
      answer: aiAnswer,
      sourceClassification,
      citationDisclaimer,
      sources,
      providerUsed: provider || 'gemini'
    });
  } catch (error) {
    console.error('Public AI search error:', error);
    res.status(500).json({ message: error.message || 'Error processing AI search.' });
  }
};

/**
 * Get Featured Public Academic Resources for Landing/Search Page
 */
exports.getFeaturedResources = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        sr.id,
        sr.title,
        sr.description,
        sr.tags,
        sr.file_name,
        sr.file_url,
        sr.file_type,
        sr.file_size,
        sr.created_at,
        d.name as department_name,
        s.name as subject_name
      FROM student_resources sr
      LEFT JOIN departments d ON sr.department_id = d.id
      LEFT JOIN subjects s ON sr.subject_id = s.id
      WHERE sr.status = 'APPROVED'
      ORDER BY sr.created_at DESC
      LIMIT 8
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get featured resources error:', error);
    res.status(500).json({ message: 'Failed to fetch featured resources.' });
  }
};
