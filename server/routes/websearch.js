const express = require('express');
const router = express.Router();

// Search providers
async function searchBrave(query, apiKey, count = 5) {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`, {
    headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  return (data.web?.results || []).map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
    source: 'Brave'
  }));
}

async function searchSearxng(query, instanceUrl, count = 5) {
  const res = await fetch(`${instanceUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json&categories=general&pageno=1`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  return (data.results || []).slice(0, count).map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    source: 'SearXNG'
  }));
}

async function searchDuckDuckGo(query, count = 5) {
  // DDG instant answer API (limited but no key needed)
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  const results = [];
  if (data.AbstractText) {
    results.push({ title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText, source: 'DuckDuckGo' });
  }
  for (const r of (data.RelatedTopics || []).slice(0, count)) {
    if (r.Text && r.FirstURL) {
      results.push({ title: r.Text.split(' - ')[0], url: r.FirstURL, snippet: r.Text, source: 'DuckDuckGo' });
    }
  }
  return results.slice(0, count);
}

// GET /api/v1/websearch?q=query
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const { q, provider, count } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  const searchProvider = provider || db.prepare("SELECT value FROM settings WHERE key = 'search_provider'").get()?.value || 'duckduckgo';
  const resultCount = parseInt(count) || 5;

  try {
    let results;
    if (searchProvider === 'brave') {
      const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'brave_search_api_key'").get()?.value;
      if (!apiKey) return res.status(400).json({ error: 'Brave Search API key not configured. Set brave_search_api_key in settings.' });
      results = await searchBrave(q, apiKey, resultCount);
    } else if (searchProvider === 'searxng') {
      const instanceUrl = db.prepare("SELECT value FROM settings WHERE key = 'searxng_url'").get()?.value;
      if (!instanceUrl) return res.status(400).json({ error: 'SearXNG URL not configured. Set searxng_url in settings.' });
      results = await searchSearxng(q, instanceUrl, resultCount);
    } else {
      results = await searchDuckDuckGo(q, resultCount);
    }
    res.json({ ok: true, provider: searchProvider, query: q, results });
  } catch (err) {
    res.status(502).json({ error: `Search failed: ${err.message}` });
  }
});

module.exports = router;
