const express = require('express');
const router = express.Router();

function getConfig(db) {
  const url = db.prepare("SELECT value FROM settings WHERE key = 'jellyseerr_url'").get()?.value;
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'jellyseerr_api_key'").get()?.value;
  return { url, apiKey };
}

async function proxyGet(url, apiKey, path) {
  const res = await fetch(`${url}/api/v1${path}`, {
    headers: { 'X-Api-Key': apiKey },
    signal: AbortSignal.timeout(8000)
  });
  return res.json();
}

// GET /api/v1/integrations/jellyseerr/requests
router.get('/requests', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url || !apiKey) return res.json({ error: 'Jellyseerr not configured. Set jellyseerr_url and jellyseerr_api_key in settings.' });
  try {
    const data = await proxyGet(url, apiKey, '/request?take=20&skip=0&sort=added');
    res.json(data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// POST /api/v1/integrations/jellyseerr/requests/:id/approve
router.post('/requests/:id/approve', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url || !apiKey) return res.status(400).json({ error: 'Not configured' });
  try {
    const r = await fetch(`${url}/api/v1/request/${req.params.id}/approve`, {
      method: 'POST', headers: { 'X-Api-Key': apiKey }, signal: AbortSignal.timeout(8000)
    });
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// POST /api/v1/integrations/jellyseerr/requests/:id/decline
router.post('/requests/:id/decline', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db);
  if (!url || !apiKey) return res.status(400).json({ error: 'Not configured' });
  try {
    const r = await fetch(`${url}/api/v1/request/${req.params.id}/decline`, {
      method: 'POST', headers: { 'X-Api-Key': apiKey }, signal: AbortSignal.timeout(8000)
    });
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
