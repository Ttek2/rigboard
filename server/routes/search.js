const express = require('express');
const router = express.Router();

// GET /api/v1/search?q=query
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const q = req.query.q;
  if (!q || q.length < 2) return res.json({ feeds: [], rigs: [], components: [], bookmarks: [], notes: [] });

  const pattern = `%${q}%`;

  const feeds = db.prepare(`
    SELECT fi.id, fi.title, fi.link, fi.published_at, f.title as feed_title, f.favicon_url
    FROM feed_items fi JOIN feeds f ON fi.feed_id = f.id
    WHERE fi.title LIKE ? OR fi.summary LIKE ?
    ORDER BY fi.published_at DESC LIMIT 10
  `).all(pattern, pattern);

  const rigs = db.prepare(`
    SELECT id, name, description FROM rigs WHERE name LIKE ? OR description LIKE ? LIMIT 10
  `).all(pattern, pattern);

  const components = db.prepare(`
    SELECT c.id, c.name, c.model, c.category, r.name as rig_name, r.id as rig_id
    FROM components c JOIN rigs r ON c.rig_id = r.id
    WHERE c.name LIKE ? OR c.model LIKE ? OR c.serial_number LIKE ?
    LIMIT 10
  `).all(pattern, pattern, pattern);

  const bookmarks = db.prepare(`
    SELECT id, name, url FROM bookmarks WHERE name LIKE ? OR url LIKE ? LIMIT 10
  `).all(pattern, pattern);

  const notes = db.prepare(`
    SELECT id, title, content FROM notes WHERE title LIKE ? OR content LIKE ? LIMIT 10
  `).all(pattern, pattern);

  res.json({ feeds, rigs, components, bookmarks, notes });
});

module.exports = router;
