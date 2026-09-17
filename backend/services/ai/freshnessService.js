const axios = require('axios');

/**
 * Deterministic keyword & pattern lists for classification
 */
const TIME_SENSITIVE_PATTERNS = [
  /\b(who is (the )?(current|now|present))\b/i,
  /\b(current|present)\s+(chief minister|prime minister|president|governor|ceo|director|minister|pope|king|queen|chancellor|mayor)\b/i,
  /\b(latest|recent|newest|today'?s?|current)\s+(version|release|update|patch|election|news|poll|score|event|weather|stock|market|price|policy)\b/i,
  /\b(what happened (today|recently|this week|this month|this year))\b/i,
  /\b(today|yesterday|this week|this month|this year|2026)\b/i,
  /\b(current\s+\w+)\b/i,
  /\b(latest\s+\w+)\b/i,
  /\b(who won\b)/i,
  /\b(trending now)\b/i
];

const ACADEMIC_PATTERNS = [
  /\b(unit|lesson|topic|material|syllabus|subject|course|curriculum|module|lecture|textbook|notes|quiz|assessment|mcq|exam)\b/i,
  /\b(pdf|document|uploaded|attachment|file|doc|docx|pptx)\b/i,
  /\b(explain|summarize|define|derive|calculate|solve|differentiate|integrate|algorithm|data structure|pseudocode|proof)\b/i,
  /\b(backpropagation|neural network|operating system|database|binary search|sorting|microprocessor|compiler|thermodynamics)\b/i
];

/**
 * 1. Query Classifier: Determines if a query is Academic, General Stable, or Current / Time-Sensitive
 */
function classifyQuery(query, hasAttachment = false) {
  if (!query || typeof query !== 'string') {
    return { type: 'GENERAL_STABLE', isTimeSensitive: false, isAcademic: false };
  }

  const text = query.trim();

  // If there is an active attachment or explicit document reference, priority is always ACADEMIC
  if (hasAttachment || /\b(this (document|material|pdf|file|note|image)|uploaded|attachment)\b/i.test(text)) {
    return { type: 'ACADEMIC_GROUNDED', isTimeSensitive: false, isAcademic: true };
  }

  // Check time-sensitive / freshness keywords
  const hasTimePattern = TIME_SENSITIVE_PATTERNS.some(p => p.test(text));
  const hasAcademicPattern = ACADEMIC_PATTERNS.some(p => p.test(text));

  if (hasTimePattern && !hasAcademicPattern) {
    return { type: 'CURRENT_TIME_SENSITIVE', isTimeSensitive: true, isAcademic: false };
  }

  if (hasTimePattern && hasAcademicPattern) {
    // Check if query is explicitly asking about current/latest status of an office or live event
    if (/\b(current (chief minister|prime minister|president|governor|ceo|minister|news)|today|latest release|2026)\b/i.test(text)) {
      return { type: 'CURRENT_TIME_SENSITIVE', isTimeSensitive: true, isAcademic: false };
    }
    return { type: 'ACADEMIC_GROUNDED', isTimeSensitive: false, isAcademic: true };
  }

  if (hasAcademicPattern) {
    return { type: 'ACADEMIC_GROUNDED', isTimeSensitive: false, isAcademic: true };
  }

  return { type: 'GENERAL_STABLE', isTimeSensitive: false, isAcademic: false };
}

/**
 * 2. Fetch fresh multi-source search results for time-sensitive queries
 */
async function retrieveCurrentInformation(query) {
  const sources = [];
  const cleanQuery = query.replace(/[?.,!]/g, '').trim();

  // 1. Google News RSS for live/recent events & office-holders
  try {
    const rssRes = await axios.get(`https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-IN&gl=IN&ceid=IN:en`, {
      timeout: 4000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const xml = rssRes.data || '';
    const items = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g)];
    items.slice(0, 4).forEach(item => {
      const title = item[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
      const link = item[2].trim();
      const pubDate = item[3].trim();
      if (title && link) {
        sources.push({
          source: 'Google News (Live Verification)',
          title,
          snippet: `Reported on ${pubDate}: ${title}`,
          url: link,
          date: pubDate
        });
      }
    });
  } catch (err) {
    console.warn('[FreshnessService] News RSS retrieval notice:', err.message);
  }

  // 2. Wikipedia API search for institutional/office-holder/topic summaries
  try {
    const wikiSearch = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: cleanQuery,
        format: 'json',
        utf8: 1,
        srlimit: 2
      },
      headers: { 'User-Agent': 'AcademixAcademicBot/1.0' },
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
          headers: { 'User-Agent': 'AcademixAcademicBot/1.0' },
          timeout: 3500
        });

        const pages = pageRes.data?.query?.pages || {};
        const pageId = Object.keys(pages)[0];
        if (pageId && pages[pageId]?.extract) {
          sources.push({
            source: 'Wikipedia (Verified Reference)',
            title: pages[pageId].title,
            snippet: pages[pageId].extract.substring(0, 600),
            url: pages[pageId].fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pages[pageId].title.replace(/ /g, '_'))}`
          });
        }
      } catch (pErr) {
        // Ignore single page error
      }
    }
  } catch (err) {
    console.warn('[FreshnessService] Wikipedia retrieval notice:', err.message);
  }

  // 3. DuckDuckGo Instant Answer API fallback
  if (sources.length === 0) {
    try {
      const ddgRes = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`, {
        timeout: 4000,
        headers: { 'User-Agent': 'AcademixAcademicBot/1.0' }
      });
      const data = ddgRes.data;
      if (data.AbstractText) {
        sources.push({
          source: 'DuckDuckGo Instant Answer',
          title: data.Heading || cleanQuery,
          snippet: data.AbstractText,
          url: data.AbstractURL || 'https://duckduckgo.com'
        });
      }
    } catch (err) {
      console.warn('[FreshnessService] DDG API notice:', err.message);
    }
  }

  return sources;
}

/**
 * 3. Build a structured context block for the AI model
 */
function formatCurrentContextBlock(sources) {
  if (!sources || sources.length === 0) {
    return `\n=== CURRENT KNOWLEDGE STATUS ===\nNote: Live web verification was attempted, but real-time sources were unreachable. If answering time-sensitive facts, state that live verification was limited.\n`;
  }

  const formattedSources = sources.map((s, idx) => {
    return `[Source ${idx + 1}] (${s.source}) ${s.title}\nDetails: ${s.snippet}\nURL: ${s.url}${s.date ? `\nDate: ${s.date}` : ''}`;
  }).join('\n\n');

  return `\n=== CURRENT VERIFIED LIVE INFORMATION (FRESH CONTEXT) ===
The user's query is time-sensitive. Use the following fresh verified information retrieved right now to provide an accurate, up-to-date answer:

${formattedSources}

INSTRUCTIONS FOR TIME-SENSITIVE KNOWLEDGE:
1. Base your answer strictly on the fresh verified sources above.
2. Clearly state current facts, office holders, titles, and dates.
3. Include brief citation links/sources where appropriate.
4. Do not rely on outdated static model training data.
5. If the sources show a recent change or event, explain it accurately.
`;
}

module.exports = {
  classifyQuery,
  retrieveCurrentInformation,
  formatCurrentContextBlock
};
