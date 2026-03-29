const express = require('express');
const router = express.Router();

// GET /api/v1/maintenance/upcoming
router.get('/upcoming', (req, res) => {
  const db = req.app.locals.db;
  const items = db.prepare(`
    SELECT ms.*, c.name as component_name, c.category, r.name as rig_name, r.id as rig_id
    FROM maintenance_schedules ms
    JOIN components c ON ms.component_id = c.id
    JOIN rigs r ON c.rig_id = r.id
    WHERE ms.next_due IS NOT NULL
    ORDER BY ms.next_due ASC
  `).all();

  const now = new Date().toISOString();
  const upcoming = items.map(item => ({
    ...item,
    is_overdue: item.next_due < now
  }));

  res.json(upcoming);
});

// DELETE /api/v1/maintenance/schedules/:id
router.delete('/schedules/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM maintenance_schedules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
