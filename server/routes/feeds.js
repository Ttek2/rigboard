const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { fetchFeed } = require('../services/feedParser');

// GET /api/v1/feeds/defaults — configurable starter feeds (edit server/defaults/feeds.json)
router.get('/defaults', (req, res) => {
  const defaultsPath = path.join(__dirname, '..', 'defaults', 'feeds.json');
  try {
    const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
    res.json(defaults);
  } catch (err) {
    res.json([]);
  }
});

// GET /api/v1/feeds/opml — export as OPML
router.get('/opml', (req, res) => {
  const db = req.app.locals.db;
  const feeds = db.prepare('SELECT * FROM feeds ORDER BY group_name, title').all();
  const groups = {};
  for (const f of feeds) {
    if (!groups[f.group_name]) groups[f.group_name] = [];
    groups[f.group_name].push(f);
  }

  let opml = '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n<head><title>RigBoard Feeds</title></head>\n<body>\n';
  for (const [group, groupFeeds] of Object.entries(groups)) {
    opml += `  <outline text="${group}" title="${group}">\n`;
    for (const f of groupFeeds) {
      opml += `    <outline type="rss" text="${(f.title || '').replace(/"/g, '&quot;')}" title="${(f.title || '').replace(/"/g, '&quot;')}" xmlUrl="${f.url}" htmlUrl="${f.site_url || ''}"/>\n`;
    }
    opml += '  </outline>\n';
  }
  opml += '</body>\n</opml>';

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename=rigboard-feeds.opml');
  res.send(opml);
});

// POST /api/v1/feeds/opml — import from OPML
router.post('/opml', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const db = req.app.locals.db;
  const opmlText = req.body;
  // Simple OPML parser — extract xmlUrl and group
  const outlineRegex = /<outline[^>]*xmlUrl="([^"]*)"[^>]*\/>/gi;
  const groupRegex = /<outline[^>]*text="([^"]*)"[^>]*>\s*(?:<outline)/gi;

  // Parse groups
  const groupMatches = [...opmlText.matchAll(/<outline[^/]*text="([^"]*)"[^/]*>\s*\n?\s*<outline/gi)];
  let currentGroup = 'Imported';

  const feedUrls = [];
  const lines = opmlText.split('\n');
  for (const line of lines) {
    const groupMatch = line.match(/<outline[^/]*text="([^"]*)"[^/]*>\s*$/);
    if (groupMatch) currentGroup = groupMatch[1];
    const feedMatch = line.match(/xmlUrl="([^"]*)"/);
    if (feedMatch) {
      feedUrls.push({ url: feedMatch[1], group_name: currentGroup });
    }
  }

  let imported = 0;
  for (const { url, group_name } of feedUrls) {
    try {
      const existing = db.prepare('SELECT id FROM feeds WHERE url = ?').get(url);
      if (existing) continue;
      const feedData = await fetchFeed(url);
      db.prepare('INSERT INTO feeds (url, title, site_url, favicon_url, group_name) VALUES (?, ?, ?, ?, ?)')
        .run(url, feedData.title || url, feedData.link || null,
          feedData.link ? `https://www.google.com/s2/favicons?domain=${new URL(feedData.link).hostname}&sz=32` : null,
          group_name);
      imported++;
    } catch (e) { /* skip failed feeds */ }
  }

  res.json({ success: true, imported, total: feedUrls.length });
});

// GET /api/v1/feeds
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const feeds = db.prepare('SELECT * FROM feeds ORDER BY group_name, title').all();
  res.json(feeds);
});

// GET /api/v1/feeds/groups
router.get('/groups', (req, res) => {
  const db = req.app.locals.db;
  const groups = db.prepare('SELECT DISTINCT group_name FROM feeds ORDER BY group_name').all();
  res.json(groups.map(g => g.group_name));
});

// GET /api/v1/feeds/items/latest — MUST be before /:id routes
router.get('/items/latest', (req, res) => {
  const db = req.app.locals.db;
  const limit = parseInt(req.query.limit) || 30;
  const group = req.query.group;

  let query = `
    SELECT fi.*, f.title as feed_title, f.favicon_url, f.group_name
    FROM feed_items fi
    JOIN feeds f ON fi.feed_id = f.id
    WHERE f.is_enabled = 1
  `;
  const params = [];

  if (group) {
    query += ' AND f.group_name = ?';
    params.push(group);
  }

  query += ' ORDER BY fi.published_at DESC LIMIT ?';
  params.push(limit);

  const items = db.prepare(query).all(...params);
  res.json(items);
});

// POST /api/v1/feeds
router.post('/', async (req, res) => {
  const db = req.app.locals.db;
  const { url, group_name, refresh_interval_minutes } = req.body;

  try {
    const feedData = await fetchFeed(url);
    const result = db.prepare(
      'INSERT INTO feeds (url, title, site_url, favicon_url, group_name, refresh_interval_minutes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      url,
      feedData.title || url,
      feedData.link || null,
      feedData.link ? `https://www.google.com/s2/favicons?domain=${new URL(feedData.link).hostname}&sz=32` : null,
      group_name || 'Uncategorized',
      refresh_interval_minutes || 30
    );

    const feedId = result.lastInsertRowid;

    const insertItem = db.prepare(
      'INSERT OR IGNORE INTO feed_items (feed_id, guid, title, link, summary, author, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const item of feedData.items || []) {
      insertItem.run(
        feedId,
        item.guid || item.link || item.title,
        item.title,
        item.link,
        item.contentSnippet || item.summary || null,
        item.creator || item.author || null,
        item.isoDate || item.pubDate || null
      );
    }

    db.prepare('UPDATE feeds SET last_fetched = CURRENT_TIMESTAMP WHERE id = ?').run(feedId);
    const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(feedId);
    res.status(201).json(feed);
  } catch (err) {
    res.status(400).json({ error: 'Failed to fetch feed: ' + err.message });
  }
});

// PUT /api/v1/feeds/:id
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { title, group_name, refresh_interval_minutes, is_enabled } = req.body;
  db.prepare(
    'UPDATE feeds SET title = COALESCE(?, title), group_name = COALESCE(?, group_name), refresh_interval_minutes = COALESCE(?, refresh_interval_minutes), is_enabled = COALESCE(?, is_enabled) WHERE id = ?'
  ).run(title, group_name, refresh_interval_minutes, is_enabled, req.params.id);
  const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(req.params.id);
  res.json(feed);
});

// DELETE /api/v1/feeds/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM feeds WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/v1/feeds/:id/items
router.get('/:id/items', (req, res) => {
  const db = req.app.locals.db;
  const limit = parseInt(req.query.limit) || 50;
  const items = db.prepare(
    'SELECT * FROM feed_items WHERE feed_id = ? ORDER BY published_at DESC LIMIT ?'
  ).all(req.params.id, limit);
  res.json(items);
});

// PUT /api/v1/feeds/items/:itemId/read — mark item as read/unread
router.put('/items/:itemId/read', (req, res) => {
  const db = req.app.locals.db;
  const { is_read } = req.body;
  db.prepare('UPDATE feed_items SET is_read = ? WHERE id = ?').run(is_read ? 1 : 0, req.params.itemId);
  res.json({ success: true });
});

// POST /api/v1/feeds/items/:itemId/star — toggle star on feed item
router.post('/items/:itemId/star', (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT id FROM starred_items WHERE feed_item_id = ?').get(req.params.itemId);
  if (existing) {
    db.prepare('DELETE FROM starred_items WHERE feed_item_id = ?').run(req.params.itemId);
    res.json({ starred: false });
  } else {
    db.prepare('INSERT INTO starred_items (feed_item_id) VALUES (?)').run(req.params.itemId);
    res.json({ starred: true });
  }
});

// GET /api/v1/feeds/items/starred — get all starred items
router.get('/items/starred', (req, res) => {
  const db = req.app.locals.db;
  const items = db.prepare(`
    SELECT fi.*, f.title as feed_title, f.favicon_url, f.group_name, si.created_at as starred_at
    FROM starred_items si
    JOIN feed_items fi ON si.feed_item_id = fi.id
    JOIN feeds f ON fi.feed_id = f.id
    ORDER BY si.created_at DESC
  `).all();
  res.json(items);
});

// POST /api/v1/feeds/:id/refresh
router.post('/:id/refresh', async (req, res) => {
  const db = req.app.locals.db;
  const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(req.params.id);
  if (!feed) return res.status(404).json({ error: 'Feed not found' });

  try {
    const feedData = await fetchFeed(feed.url);
    const insertItem = db.prepare(
      'INSERT OR IGNORE INTO feed_items (feed_id, guid, title, link, summary, author, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const item of feedData.items || []) {
      insertItem.run(
        feed.id,
        item.guid || item.link || item.title,
        item.title,
        item.link,
        item.contentSnippet || item.summary || null,
        item.creator || item.author || null,
        item.isoDate || item.pubDate || null
      );
    }
    db.prepare('UPDATE feeds SET last_fetched = CURRENT_TIMESTAMP WHERE id = ?').run(feed.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/feeds/refresh-all — manually refresh all feeds
router.post('/refresh-all', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { refreshAllFeeds } = require('../services/feedParser');
    await refreshAllFeeds(db);
    const count = db.prepare('SELECT COUNT(*) as c FROM feed_items').get().c;
    res.json({ success: true, items: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
