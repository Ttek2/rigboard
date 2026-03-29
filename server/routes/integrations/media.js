const express = require('express');
const router = express.Router();

// === PLEX ===

router.get('/plex/playing', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'plex_url'").get()?.value;
  const token = db.prepare("SELECT value FROM settings WHERE key = 'plex_token'").get()?.value;
  if (!url || !token) return res.json({ error: 'Plex not configured. Set plex_url and plex_token.' });

  try {
    const r = await fetch(`${url}/status/sessions?X-Plex-Token=${token}`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000)
    });
    const data = await r.json();
    const sessions = data.MediaContainer?.Metadata || [];
    res.json(sessions.map(s => ({
      title: s.grandparentTitle ? `${s.grandparentTitle} - ${s.title}` : s.title,
      type: s.type,
      year: s.year,
      user: s.User?.title || 'Unknown',
      player: s.Player?.title || '',
      state: s.Player?.state || 'unknown',
      progress: s.viewOffset && s.duration ? Math.round((s.viewOffset / s.duration) * 100) : 0
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/plex/recent', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'plex_url'").get()?.value;
  const token = db.prepare("SELECT value FROM settings WHERE key = 'plex_token'").get()?.value;
  if (!url || !token) return res.json({ error: 'Not configured' });

  try {
    const r = await fetch(`${url}/library/recentlyAdded?X-Plex-Token=${token}&X-Plex-Container-Size=15`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000)
    });
    const data = await r.json();
    const items = (data.MediaContainer?.Metadata || []).slice(0, 15);
    res.json(items.map(m => ({
      title: m.grandparentTitle ? `${m.grandparentTitle} - ${m.title}` : m.title,
      type: m.type,
      year: m.year,
      addedAt: new Date(m.addedAt * 1000).toISOString(),
      duration: m.duration ? Math.round(m.duration / 60000) : null,
      rating: m.rating || null
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/plex/libraries', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'plex_url'").get()?.value;
  const token = db.prepare("SELECT value FROM settings WHERE key = 'plex_token'").get()?.value;
  if (!url || !token) return res.json({ error: 'Not configured' });

  try {
    const r = await fetch(`${url}/library/sections?X-Plex-Token=${token}`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000)
    });
    const data = await r.json();
    const libraries = data.MediaContainer?.Directory || [];
    const results = [];
    for (const lib of libraries) {
      const countRes = await fetch(`${url}/library/sections/${lib.key}/all?X-Plex-Token=${token}&X-Plex-Container-Size=0`, {
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000)
      });
      const countData = await countRes.json();
      results.push({
        name: lib.title,
        type: lib.type,
        count: countData.MediaContainer?.totalSize || 0
      });
    }
    res.json(results);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// === JELLYFIN ===

router.get('/jellyfin/playing', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'jellyfin_url'").get()?.value;
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'jellyfin_api_key'").get()?.value;
  if (!url || !apiKey) return res.json({ error: 'Jellyfin not configured. Set jellyfin_url and jellyfin_api_key.' });

  try {
    const r = await fetch(`${url}/Sessions?api_key=${apiKey}`, { signal: AbortSignal.timeout(5000) });
    const sessions = await r.json();
    const playing = sessions.filter(s => s.NowPlayingItem).map(s => ({
      title: s.NowPlayingItem.SeriesName
        ? `${s.NowPlayingItem.SeriesName} - ${s.NowPlayingItem.Name}`
        : s.NowPlayingItem.Name,
      type: s.NowPlayingItem.Type,
      user: s.UserName,
      player: s.DeviceName,
      state: s.PlayState?.IsPaused ? 'paused' : 'playing',
      progress: s.NowPlayingItem.RunTimeTicks
        ? Math.round((s.PlayState?.PositionTicks || 0) / s.NowPlayingItem.RunTimeTicks * 100) : 0
    }));
    res.json(playing);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/jellyfin/libraries', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'jellyfin_url'").get()?.value;
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'jellyfin_api_key'").get()?.value;
  if (!url || !apiKey) return res.json({ error: 'Not configured' });

  try {
    // Get virtual folders (libraries)
    const r = await fetch(`${url}/Library/VirtualFolders?api_key=${apiKey}`, { signal: AbortSignal.timeout(5000) });
    const folders = await r.json();

    // Get item counts per library
    const results = [];
    for (const folder of folders) {
      try {
        const countRes = await fetch(
          `${url}/Items/Counts?api_key=${apiKey}&parentId=${folder.ItemId}`,
          { signal: AbortSignal.timeout(5000) }
        );
        const counts = await countRes.json();
        results.push({
          name: folder.Name,
          type: folder.CollectionType || 'unknown',
          movieCount: counts.MovieCount || 0,
          seriesCount: counts.SeriesCount || 0,
          episodeCount: counts.EpisodeCount || 0,
          albumCount: counts.AlbumCount || 0,
          songCount: counts.SongCount || 0,
          totalCount: (counts.MovieCount || 0) + (counts.SeriesCount || 0) + (counts.EpisodeCount || 0) + (counts.AlbumCount || 0)
        });
      } catch {
        results.push({ name: folder.Name, type: folder.CollectionType || 'unknown', totalCount: 0 });
      }
    }
    res.json(results);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/jellyfin/recent', async (req, res) => {
  const db = req.app.locals.db;
  const url = db.prepare("SELECT value FROM settings WHERE key = 'jellyfin_url'").get()?.value;
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'jellyfin_api_key'").get()?.value;
  if (!url || !apiKey) return res.json({ error: 'Not configured' });

  try {
    const r = await fetch(
      `${url}/Items/Latest?api_key=${apiKey}&Limit=15&Fields=DateCreated,Overview`,
      { signal: AbortSignal.timeout(5000) }
    );
    const items = await r.json();
    res.json((Array.isArray(items) ? items : []).map(m => ({
      title: m.SeriesName ? `${m.SeriesName} - ${m.Name}` : m.Name,
      type: m.Type,
      year: m.ProductionYear,
      addedAt: m.DateCreated,
      overview: m.Overview ? m.Overview.slice(0, 150) : null,
      communityRating: m.CommunityRating || null
    })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
