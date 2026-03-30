const express = require('express');
const router = express.Router();

// GET /api/v1/widgets/layout?tab_id=N
router.get('/layout', (req, res) => {
  const db = req.app.locals.db;
  const tabId = req.query.tab_id;

  // Auto-repair: adopt orphaned widgets (tab_id references non-existent tab)
  const existingTabIds = db.prepare('SELECT id FROM dashboard_tabs').all().map(t => t.id);
  if (existingTabIds.length > 0) {
    const defaultTabId = existingTabIds[0];
    const orphans = db.prepare('SELECT id FROM widget_layout WHERE tab_id IS NULL OR tab_id NOT IN (SELECT id FROM dashboard_tabs)').all();
    if (orphans.length > 0) {
      db.prepare('UPDATE widget_layout SET tab_id = ? WHERE tab_id IS NULL OR tab_id NOT IN (SELECT id FROM dashboard_tabs)').run(defaultTabId);
    }
  }

  let widgets;
  if (tabId) {
    widgets = db.prepare('SELECT * FROM widget_layout WHERE tab_id = ? ORDER BY grid_y, grid_x').all(tabId);
  } else {
    // Without tab_id, return widgets for the default tab (or all if no tabs exist)
    const defaultTab = db.prepare('SELECT id FROM dashboard_tabs WHERE is_default = 1').get();
    if (defaultTab) {
      widgets = db.prepare('SELECT * FROM widget_layout WHERE tab_id = ? ORDER BY grid_y, grid_x').all(defaultTab.id);
    } else {
      widgets = db.prepare('SELECT * FROM widget_layout ORDER BY grid_y, grid_x').all();
    }
  }
  const parsed = widgets.map(w => ({
    ...w,
    widget_config: JSON.parse(w.widget_config || '{}')
  }));
  res.json(parsed);
});

// PUT /api/v1/widgets/layout
router.put('/layout', (req, res) => {
  const db = req.app.locals.db;
  const widgets = req.body;
  if (!widgets.length) return res.json([]);

  const tabId = widgets[0]?.tab_id || null;

  const transaction = db.transaction(() => {
    // Always scope delete to the specific tab
    if (tabId) {
      db.prepare('DELETE FROM widget_layout WHERE tab_id = ?').run(tabId);
    } else {
      // If no tab_id, clean up orphans too
      db.prepare('DELETE FROM widget_layout WHERE tab_id IS NULL').run();
    }
    const insert = db.prepare(
      'INSERT INTO widget_layout (widget_type, widget_config, grid_x, grid_y, grid_w, grid_h, is_visible, tab_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const w of widgets) {
      insert.run(
        w.widget_type,
        JSON.stringify(w.widget_config || {}),
        w.grid_x,
        w.grid_y,
        w.grid_w,
        w.grid_h,
        w.is_visible !== undefined ? w.is_visible : 1,
        tabId
      );
    }
  });

  transaction();
  const saved = db.prepare('SELECT * FROM widget_layout WHERE tab_id = ? ORDER BY grid_y, grid_x').all(tabId);
  res.json(saved.map(w => ({ ...w, widget_config: JSON.parse(w.widget_config || '{}') })));
});

module.exports = router;
