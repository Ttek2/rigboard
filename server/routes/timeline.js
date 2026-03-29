const express = require('express');
const router = express.Router();

// GET /api/v1/rigs/:id/timeline
router.get('/:id/timeline', (req, res) => {
  const db = req.app.locals.db;
  const rigId = req.params.id;

  // Maintenance logs
  const logs = db.prepare(`
    SELECT ml.id, ml.action, ml.notes, ml.performed_at as timestamp,
      'maintenance' as event_type, c.name as component_name, c.category
    FROM maintenance_logs ml
    JOIN components c ON ml.component_id = c.id
    WHERE c.rig_id = ?
  `).all(rigId);

  // Component additions
  const additions = db.prepare(`
    SELECT id, name, category, model,
      created_at as timestamp, 'component_added' as event_type,
      name as component_name
    FROM components WHERE rig_id = ?
  `).all(rigId);

  // Combine and sort chronologically
  const timeline = [...logs, ...additions]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json(timeline);
});

module.exports = router;
