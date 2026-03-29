const express = require('express');
const router = express.Router();

// GET /api/v1/integrations/releases?repos=jellyfin/jellyfin,sonarr/sonarr
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const reposStr = req.query.repos || db.prepare("SELECT value FROM settings WHERE key = 'tracked_repos'").get()?.value || '';
  const repos = reposStr.split(',').map(r => r.trim()).filter(Boolean);

  if (repos.length === 0) return res.json([]);

  const releases = [];
  for (const repo of repos) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { 'User-Agent': 'RigBoard/1.0', Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) continue;
      const data = await r.json();
      releases.push({
        repo,
        tag: data.tag_name,
        name: data.name || data.tag_name,
        published: data.published_at,
        url: data.html_url,
        prerelease: data.prerelease
      });
    } catch { /* skip */ }
  }

  res.json(releases.sort((a, b) => new Date(b.published) - new Date(a.published)));
});

module.exports = router;
