const express = require('express');
const router = express.Router();

function getConfig(db) {
  const url = db.prepare("SELECT value FROM settings WHERE key = 'pihole_url'").get()?.value;
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'pihole_api_key'").get()?.value;
  return { url, apiKey };
}

// Session cache for Pi-hole v6
let v6Session = { sid: null, expiresAt: 0 };

async function getV6Session(url, password) {
  if (v6Session.sid && Date.now() < v6Session.expiresAt) return v6Session.sid;

  const res = await fetch(`${url}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json();
  if (data.session?.valid && data.session?.sid) {
    v6Session = { sid: data.session.sid, expiresAt: Date.now() + (data.session.validity * 1000) - 60000 };
    return v6Session.sid;
  }
  return null;
}

async function piholeGet(url, apiKey, path) {
  // Try v6 API first
  try {
    const sid = await getV6Session(url, apiKey);
    if (sid) {
      const res = await fetch(`${url}/api${path}`, {
        headers: { 'sid': sid },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return { version: 6, data: await res.json() };
    }
  } catch {}

  // Fall back to v5 API
  try {
    const res = await fetch(`${url}/admin/api.php${path}${apiKey ? `&auth=${apiKey}` : ''}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return { version: 5, data: await res.json() };
  } catch {}

  return null;
}

// GET /api/v1/integrations/pihole/stats
router.get('/stats', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url) return res.json({ error: 'Pi-hole not configured. Set pihole_url and pihole_api_key in widget settings.' });

  try {
    // Try v6
    let sid;
    try { sid = await getV6Session(url, apiKey); } catch {}

    if (sid) {
      const r = await fetch(`${url}/api/stats/summary`, {
        headers: { 'sid': sid },
        signal: AbortSignal.timeout(5000),
      });
      const data = await r.json();
      if (!data.error) {
        return res.json({
          queries_today: data.queries?.total,
          blocked_today: data.queries?.blocked,
          percent_blocked: data.queries?.percent_blocked,
          domains_blocked: data.gravity?.domains_being_blocked,
          status: data.dns?.blocking_enabled ? 'enabled' : 'disabled',
          version: 6,
        });
      }
    }

    // Fall back to v5
    const r = await fetch(`${url}/admin/api.php?summaryRaw${apiKey ? `&auth=${apiKey}` : ''}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    res.json({
      queries_today: data.dns_queries_today,
      blocked_today: data.ads_blocked_today,
      percent_blocked: data.ads_percentage_today,
      domains_blocked: data.domains_being_blocked,
      status: data.status,
      version: 5,
    });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// POST /api/v1/integrations/pihole/toggle
router.post('/toggle', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url || !apiKey) return res.status(400).json({ error: 'API key required for toggle' });

  const { enable } = req.body;
  try {
    // Try v6
    let sid;
    try { sid = await getV6Session(url, apiKey); } catch {}

    if (sid) {
      const r = await fetch(`${url}/api/dns/blocking`, {
        method: 'POST',
        headers: { 'sid': sid, 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocking: enable }),
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const data = await r.json();
        return res.json({ status: data.blocking ? 'enabled' : 'disabled' });
      }
    }

    // Fall back to v5
    const action = enable ? 'enable' : 'disable';
    const r = await fetch(`${url}/admin/api.php?${action}&auth=${apiKey}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    res.json({ status: data.status || action });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// GET /api/v1/integrations/pihole/top
router.get('/top', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url) return res.json({ error: 'Pi-hole URL required' });

  try {
    // Try v6
    let sid;
    try { sid = apiKey ? await getV6Session(url, apiKey) : null; } catch (e) { console.error('Pi-hole v6 auth failed:', e.message); }

    if (sid) {
      try {
        const [queries, blocked, clients] = await Promise.all([
          fetch(`${url}/api/stats/top_domains?count=10`, { headers: { sid }, signal: AbortSignal.timeout(5000) }).then(r => r.json()),
          fetch(`${url}/api/stats/top_domains?blocked=true&count=10`, { headers: { sid }, signal: AbortSignal.timeout(5000) }).then(r => r.json()),
          fetch(`${url}/api/stats/top_clients?count=5`, { headers: { sid }, signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      ]);
        // v6 returns arrays of {domain, count} — normalize to {domain: count} objects
        const normalize = (arr) => {
          if (!arr) return {};
          if (Array.isArray(arr)) {
            const obj = {};
            for (const item of arr) obj[item.domain || item.name || item.ip || item.client || String(item)] = item.count || item.queries || 0;
            return obj;
          }
          return arr;
        };
        return res.json({
          top_queries: normalize(queries.top_domains || queries.domains || queries),
          top_ads: normalize(blocked.top_domains || blocked.domains || blocked),
          top_clients: normalize(clients.top_clients || clients.clients || clients),
          version: 6,
        });
      } catch (e) { console.error('Pi-hole v6 top failed:', e.message); }
    }

    // Fall back to v5
    const [topDomains, topAds, topClients, queryTypes] = await Promise.all([
      fetch(`${url}/admin/api.php?topItems=10&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${url}/admin/api.php?topItems=10&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${url}/admin/api.php?topClients=5&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
      fetch(`${url}/admin/api.php?getQueryTypes&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
    ]);
    res.json({ top_queries: topDomains.top_queries || {}, top_ads: topAds.top_ads || {}, top_clients: topClients.top_sources || {}, query_types: queryTypes.querytypes || {}, version: 5 });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
