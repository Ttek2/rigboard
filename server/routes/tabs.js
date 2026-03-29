const express = require('express');
const router = express.Router();

// GET /api/v1/tabs
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  let tabs = db.prepare('SELECT * FROM dashboard_tabs ORDER BY sort_order, id').all();

  // Create default tab if none exist
  if (tabs.length === 0) {
    db.prepare('INSERT INTO dashboard_tabs (name, is_default, cols) VALUES (?, 1, 4)').run('Dashboard');
    // Assign existing widgets to the new default tab
    const defaultTab = db.prepare('SELECT id FROM dashboard_tabs WHERE is_default = 1').get();
    if (defaultTab) {
      db.prepare('UPDATE widget_layout SET tab_id = ? WHERE tab_id IS NULL').run(defaultTab.id);
    }
    tabs = db.prepare('SELECT * FROM dashboard_tabs ORDER BY sort_order, id').all();
  }
  res.json(tabs);
});

// POST /api/v1/tabs
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name, cols } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM dashboard_tabs').get().m || 0;
  const result = db.prepare('INSERT INTO dashboard_tabs (name, sort_order, cols) VALUES (?, ?, ?)').run(name, maxOrder + 1, cols || 4);
  const tab = db.prepare('SELECT * FROM dashboard_tabs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tab);
});

// PUT /api/v1/tabs/:id
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name, sort_order, cols } = req.body;
  const existing = db.prepare('SELECT * FROM dashboard_tabs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tab not found' });

  db.prepare('UPDATE dashboard_tabs SET name = ?, sort_order = ?, cols = ? WHERE id = ?')
    .run(name || existing.name, sort_order !== undefined ? sort_order : existing.sort_order, cols || existing.cols, req.params.id);
  const tab = db.prepare('SELECT * FROM dashboard_tabs WHERE id = ?').get(req.params.id);
  res.json(tab);
});

// DELETE /api/v1/tabs/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  // Don't delete the last tab
  const count = db.prepare('SELECT COUNT(*) as c FROM dashboard_tabs').get().c;
  if (count <= 1) return res.status(400).json({ error: 'Cannot delete last tab' });
  db.prepare('DELETE FROM widget_layout WHERE tab_id = ?').run(req.params.id);
  db.prepare('DELETE FROM dashboard_tabs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
