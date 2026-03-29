const express = require('express');
const router = express.Router();

function getConfig(db) {
  const url = db.prepare("SELECT value FROM settings WHERE key = 'pihole_url'").get()?.value;
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'pihole_api_key'").get()?.value;
  return { url, apiKey };
}

// GET /api/v1/integrations/pihole/stats
router.get('/stats', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url) return res.json({ error: 'Pi-hole not configured. Set pihole_url and pihole_api_key.' });

  try {
    const r = await fetch(`${url}/admin/api.php?summaryRaw${apiKey ? `&auth=${apiKey}` : ''}`, {
      signal: AbortSignal.timeout(5000)
    });
    const data = await r.json();
    res.json({
      queries_today: data.dns_queries_today,
      blocked_today: data.ads_blocked_today,
      percent_blocked: data.ads_percentage_today,
      domains_blocked: data.domains_being_blocked,
      status: data.status
    });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// POST /api/v1/integrations/pihole/toggle
router.post('/toggle', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url || !apiKey) return res.status(400).json({ error: 'API key required for toggle' });

  const { enable } = req.body;
  try {
    const action = enable ? 'enable' : 'disable';
    const r = await fetch(`${url}/admin/api.php?${action}&auth=${apiKey}`, {
      signal: AbortSignal.timeout(5000)
    });
    const data = await r.json();
    res.json({ status: data.status || action });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// GET /api/v1/integrations/pihole/top
router.get('/top', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url || !apiKey) return res.json({ error: 'API key required' });

  try {
    const [topDomains, topAds, topClients, queryTypes] = await Promise.all([
      fetch(`${url}/admin/api.php?topItems=10&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${url}/admin/api.php?topItems=10&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${url}/admin/api.php?topClients=5&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${url}/admin/api.php?getQueryTypes&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
    ]);

    res.json({
      top_queries: topDomains.top_queries || {},
      top_ads: topAds.top_ads || {},
      top_clients: topClients.top_sources || {},
      query_types: queryTypes.querytypes || {}
    });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
