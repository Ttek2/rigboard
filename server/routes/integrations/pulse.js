const express = require('express');
const router = express.Router();

let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// GET /api/v1/integrations/pulse
router.get('/', async (req, res) => {
  // Return cached data if fresh
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return res.json(cache.data);
  }

  try {
    const response = await fetch('https://ttek2.com/api/trending/pulse', {
      headers: { 'User-Agent': 'RigBoard/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    cache = { data, fetchedAt: Date.now() };
    res.json(data);
  } catch (err) {
    // Return stale cache if available
    if (cache.data) return res.json(cache.data);
    res.status(502).json({ error: 'Failed to fetch pulse data: ' + err.message });
  }
});

// GET /api/v1/integrations/pulse/rig-match — match topics against user's rig components
router.get('/rig-match', (req, res) => {
  const db = req.app.locals.db;
  const components = db.prepare(`
    SELECT c.name, c.model, c.category, r.name as rig_name
    FROM components c JOIN rigs r ON c.rig_id = r.id
  `).all();

  // Build a set of keywords from component names, models, and categories
  const keywords = new Set();
  for (const comp of components) {
    // Add individual words from name and model
    for (const field of [comp.name, comp.model, comp.category]) {
      if (!field) continue;
      // Add the full field and individual significant words
      keywords.add(field.toLowerCase());
      for (const word of field.split(/[\s\-_\/]+/)) {
        if (word.length > 2) keywords.add(word.toLowerCase());
      }
    }
  }

  res.json({ keywords: [...keywords], component_count: components.length });
});

// Proxy cache for per-topic endpoints (short TTL)
const topicCache = {};
const TOPIC_CACHE_TTL = 5 * 60 * 1000;

async function fetchTtek2(path) {
  const cacheKey = path;
  const cached = topicCache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < TOPIC_CACHE_TTL) return cached.data;

  const response = await fetch(`https://ttek2.com${path}`, {
    headers: { 'User-Agent': 'RigBoard/1.0' },
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json();
  topicCache[cacheKey] = { data, fetchedAt: Date.now() };
  return data;
}

// GET /api/v1/integrations/pulse/creator/:slug
router.get('/creator/:slug', async (req, res) => {
  try {
    const data = await fetchTtek2(`/api/trending/pulse/creator/${req.params.slug}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/v1/integrations/pulse/history/:slug
router.get('/history/:slug', async (req, res) => {
  try {
    const data = await fetchTtek2(`/api/trending/pulse/history/${req.params.slug}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
