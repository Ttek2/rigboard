const express = require('express');
const router = express.Router();

// In-memory cache: { data, ts }
let cache = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// GET /api/v1/version
router.get('/', async (req, res) => {
  const pkg = require('../package.json');
  const current = pkg.version;

  // Return cached result if still fresh
  if (cache && (Date.now() - cache.ts) < CACHE_TTL_MS) {
    return res.json({ ...cache.data, current });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.github.com/repos/Ttek2/rigboard/releases/latest', {
      headers: {
        'User-Agent': `RigBoard/${current}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      // No release exists yet (404) or other error
      const data = { current, latest: null, update_available: false };
      cache = { data, ts: Date.now() };
      return res.json(data);
    }

    const release = await response.json();
    const latest = {
      tag: release.tag_name,
      name: release.name,
      published: release.published_at,
      url: release.html_url
    };

    // Compare versions: strip leading 'v' for comparison
    const latestVersion = (release.tag_name || '').replace(/^v/, '');
    const update_available = latestVersion !== current && latestVersion > current;

    const data = { current, latest, update_available };
    cache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    // Network error, timeout, etc. — return current version with no update info
    const data = { current, latest: null, update_available: false };
    cache = { data, ts: Date.now() };
    res.json(data);
  }
});

module.exports = router;
