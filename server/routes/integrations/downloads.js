const express = require('express');
const router = express.Router();

// qBittorrent: GET /api/v1/integrations/qbittorrent/torrents
router.get('/qbittorrent/torrents', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'qbittorrent_url'").get()?.value;
  if (!url) return res.json({ error: 'qBittorrent not configured. Set qbittorrent_url.' });

  try {
    // Login if credentials exist
    const user = db.prepare("SELECT value FROM settings WHERE key = 'qbittorrent_user'").get()?.value;
    const pass = db.prepare("SELECT value FROM settings WHERE key = 'qbittorrent_pass'").get()?.value;

    let cookie = '';
    if (user && pass) {
      const loginRes = await fetch(`${url}/api/v2/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
        signal: AbortSignal.timeout(5000)
      });
      cookie = loginRes.headers.get('set-cookie') || '';
    }

    const r = await fetch(`${url}/api/v2/torrents/info?filter=active&sort=progress`, {
      headers: cookie ? { Cookie: cookie } : {},
      signal: AbortSignal.timeout(5000)
    });
    const torrents = await r.json();
    res.json((Array.isArray(torrents) ? torrents : []).slice(0, 20).map(t => ({
      name: t.name,
      progress: Math.round(t.progress * 100),
      dlspeed: t.dlspeed,
      upspeed: t.upspeed,
      eta: t.eta,
      state: t.state,
      size: t.size
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Transmission: GET /api/v1/integrations/transmission/torrents
router.get('/transmission/torrents', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'transmission_url'").get()?.value;
  if (!url) return res.json({ error: 'Transmission not configured. Set transmission_url.' });

  try {
    // Get session ID first
    let sessionId = '';
    try {
      await fetch(`${url}/transmission/rpc`, {
        method: 'POST', body: '{}', signal: AbortSignal.timeout(3000)
      });
    } catch (e) {}

    const initRes = await fetch(`${url}/transmission/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'torrent-get', arguments: { fields: ['name', 'percentDone', 'rateDownload', 'rateUpload', 'eta', 'status', 'totalSize'] } }),
      signal: AbortSignal.timeout(5000)
    });

    if (initRes.status === 409) {
      sessionId = initRes.headers.get('x-transmission-session-id');
      const r = await fetch(`${url}/transmission/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Transmission-Session-Id': sessionId },
        body: JSON.stringify({ method: 'torrent-get', arguments: { fields: ['name', 'percentDone', 'rateDownload', 'rateUpload', 'eta', 'status', 'totalSize'] } }),
        signal: AbortSignal.timeout(5000)
      });
      const data = await r.json();
      const torrents = data.arguments?.torrents || [];
      return res.json(torrents.slice(0, 20).map(t => ({
        name: t.name,
        progress: Math.round(t.percentDone * 100),
        dlspeed: t.rateDownload,
        upspeed: t.rateUpload,
        eta: t.eta,
        state: t.status,
        size: t.totalSize
      })));
    }

    const data = await initRes.json();
    const torrents = data.arguments?.torrents || [];
    res.json(torrents.slice(0, 20).map(t => ({
      name: t.name,
      progress: Math.round(t.percentDone * 100),
      dlspeed: t.rateDownload,
      upspeed: t.rateUpload,
      eta: t.eta,
      state: t.status,
      size: t.totalSize
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
