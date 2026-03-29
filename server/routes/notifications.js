const express = require('express');
const router = express.Router();

// GET /api/v1/notifications
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(notifications);
});

// GET /api/v1/notifications/unread-count
router.get('/unread-count', (req, res) => {
  const db = req.app.locals.db;
  const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get().count;
  res.json({ count });
});

// PUT /api/v1/notifications/read-all
router.put('/read-all', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ success: true });
});

// PUT /api/v1/notifications/:id/read
router.put('/:id/read', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/v1/notifications/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/v1/notifications — clear all
router.delete('/', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM notifications').run();
  res.json({ success: true });
});

module.exports = router;
