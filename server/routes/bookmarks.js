const express = require('express');
const router = express.Router();

// GET /api/v1/bookmarks
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const bookmarks = db.prepare('SELECT * FROM bookmarks ORDER BY group_name, sort_order').all();
  res.json(bookmarks);
});

// POST /api/v1/bookmarks
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name, url, icon, group_name, sort_order } = req.body;
  const result = db.prepare(
    'INSERT INTO bookmarks (name, url, icon, group_name, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(name, url, icon || null, group_name || 'Default', sort_order || 0);
  const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(bookmark);
});

// PUT /api/v1/bookmarks/:id
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name, url, icon, group_name, sort_order } = req.body;
  db.prepare(
    'UPDATE bookmarks SET name = ?, url = ?, icon = ?, group_name = ?, sort_order = ? WHERE id = ?'
  ).run(name, url, icon, group_name, sort_order, req.params.id);
  const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  res.json(bookmark);
});

// DELETE /api/v1/bookmarks/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
