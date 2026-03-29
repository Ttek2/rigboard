const express = require('express');
const router = express.Router();

function getConfig(db, service) {
  const url = db.prepare(`SELECT value FROM settings WHERE key = '${service}_url'`).get()?.value;
  const apiKey = db.prepare(`SELECT value FROM settings WHERE key = '${service}_api_key'`).get()?.value;
  return { url, apiKey };
}

async function starrGet(url, apiKey, path) {
  const res = await fetch(`${url}/api/v3${path}`, {
    headers: { 'X-Api-Key': apiKey },
    signal: AbortSignal.timeout(8000)
  });
  return res.json();
}

// GET /api/v1/integrations/sonarr/calendar
router.get('/sonarr/calendar', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db, 'sonarr');
  if (!url || !apiKey) return res.json({ error: 'Sonarr not configured. Set sonarr_url and sonarr_api_key.' });
  try {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const data = await starrGet(url, apiKey, `/calendar?start=${start}&end=${end}`);
    res.json(data.map(ep => ({
      title: ep.series?.title || ep.title,
      episode: `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`,
      episodeTitle: ep.title,
      airDate: ep.airDateUtc,
      hasFile: ep.hasFile
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// GET /api/v1/integrations/radarr/calendar
router.get('/radarr/calendar', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db, 'radarr');
  if (!url || !apiKey) return res.json({ error: 'Radarr not configured. Set radarr_url and radarr_api_key.' });
  try {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const data = await starrGet(url, apiKey, `/calendar?start=${start}&end=${end}`);
    res.json(data.map(m => ({
      title: m.title,
      year: m.year,
      releaseDate: m.inCinemas || m.physicalRelease || m.digitalRelease,
      hasFile: m.hasFile
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// GET /api/v1/integrations/sonarr/queue
router.get('/sonarr/queue', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db, 'sonarr');
  if (!url || !apiKey) return res.json({ error: 'Not configured' });
  try {
    const data = await starrGet(url, apiKey, '/queue?pageSize=20');
    res.json((data.records || []).map(q => ({
      title: q.title || q.series?.title,
      status: q.status,
      progress: q.sizeleft && q.size ? Math.round((1 - q.sizeleft / q.size) * 100) : 0,
      timeleft: q.timeleft,
      size: q.size
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// GET /api/v1/integrations/radarr/queue
router.get('/radarr/queue', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db, 'radarr');
  if (!url || !apiKey) return res.json({ error: 'Not configured' });
  try {
    const data = await starrGet(url, apiKey, '/queue?pageSize=20');
    res.json((data.records || []).map(q => ({
      title: q.title || q.movie?.title,
      status: q.status,
      progress: q.sizeleft && q.size ? Math.round((1 - q.sizeleft / q.size) * 100) : 0,
      timeleft: q.timeleft,
      size: q.size
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// GET /api/v1/integrations/sonarr/stats
router.get('/sonarr/stats', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db, 'sonarr');
  if (!url || !apiKey) return res.json({ error: 'Sonarr not configured.' });
  try {
    const [series, diskspace, queue, wanted] = await Promise.all([
      starrGet(url, apiKey, '/series'),
      starrGet(url, apiKey, '/diskspace'),
      starrGet(url, apiKey, '/queue?pageSize=1'),
      starrGet(url, apiKey, '/wanted/missing?pageSize=1'),
    ]);
    const monitored = (Array.isArray(series) ? series : []).filter(s => s.monitored).length;
    const totalEpisodes = (Array.isArray(series) ? series : []).reduce((sum, s) => sum + (s.statistics?.episodeCount || 0), 0);
    const totalSize = (Array.isArray(series) ? series : []).reduce((sum, s) => sum + (s.statistics?.sizeOnDisk || 0), 0);
    const diskFree = (Array.isArray(diskspace) ? diskspace : []).reduce((sum, d) => sum + (d.freeSpace || 0), 0);
    const diskTotal = (Array.isArray(diskspace) ? diskspace : []).reduce((sum, d) => sum + (d.totalSpace || 0), 0);

    res.json({
      series_total: Array.isArray(series) ? series.length : 0,
      series_monitored: monitored,
      episodes_total: totalEpisodes,
      missing: wanted.totalRecords || 0,
      queue_count: queue.totalRecords || 0,
      size_on_disk: totalSize,
      disk_free: diskFree,
      disk_total: diskTotal
    });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// GET /api/v1/integrations/radarr/stats
router.get('/radarr/stats', async (req, res) => {
  const { url, apiKey } = getConfig(req.app.locals.db, 'radarr');
  if (!url || !apiKey) return res.json({ error: 'Radarr not configured.' });
  try {
    const [movies, diskspace, queue] = await Promise.all([
      starrGet(url, apiKey, '/movie'),
      starrGet(url, apiKey, '/diskspace'),
      starrGet(url, apiKey, '/queue?pageSize=1'),
    ]);
    const monitored = (Array.isArray(movies) ? movies : []).filter(m => m.monitored).length;
    const hasFile = (Array.isArray(movies) ? movies : []).filter(m => m.hasFile).length;
    const missing = (Array.isArray(movies) ? movies : []).filter(m => m.monitored && !m.hasFile).length;
    const totalSize = (Array.isArray(movies) ? movies : []).reduce((sum, m) => sum + (m.sizeOnDisk || 0), 0);
    const diskFree = (Array.isArray(diskspace) ? diskspace : []).reduce((sum, d) => sum + (d.freeSpace || 0), 0);
    const diskTotal = (Array.isArray(diskspace) ? diskspace : []).reduce((sum, d) => sum + (d.totalSpace || 0), 0);

    res.json({
      movies_total: Array.isArray(movies) ? movies.length : 0,
      movies_monitored: monitored,
      movies_downloaded: hasFile,
      missing,
      queue_count: queue.totalRecords || 0,
      size_on_disk: totalSize,
      disk_free: diskFree,
      disk_total: diskTotal
    });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
