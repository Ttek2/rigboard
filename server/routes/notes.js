const express = require('express');
const router = express.Router();

// GET /api/v1/notes
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const notes = db.prepare('SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC').all();
  res.json(notes);
});

// POST /api/v1/notes
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { title, content, is_pinned } = req.body;
  const result = db.prepare(
    'INSERT INTO notes (title, content, is_pinned) VALUES (?, ?, ?)'
  ).run(title || 'Untitled', content || '', is_pinned ? 1 : 0);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(note);
});

// PUT /api/v1/notes/:id
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { title, content, is_pinned } = req.body;
  db.prepare(
    'UPDATE notes SET title = ?, content = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(title, content, is_pinned ? 1 : 0, req.params.id);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  res.json(note);
});

// DELETE /api/v1/notes/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
