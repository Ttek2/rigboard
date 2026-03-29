const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// POST /api/v1/share/rig/:id — create a share link
router.post('/rig/:id', (req, res) => {
  const db = req.app.locals.db;
  const rigId = req.params.id;
  const rig = db.prepare('SELECT * FROM rigs WHERE id = ?').get(rigId);
  if (!rig) return res.status(404).json({ error: 'Rig not found' });

  // Check for existing share
  const existing = db.prepare('SELECT * FROM shared_rigs WHERE rig_id = ?').get(rigId);
  if (existing) return res.json({ token: existing.share_token });

  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO shared_rigs (rig_id, share_token) VALUES (?, ?)').run(rigId, token);
  res.json({ token });
});

// DELETE /api/v1/share/rig/:id — remove share link
router.delete('/rig/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM shared_rigs WHERE rig_id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/v1/share/:token — public endpoint to view shared rig
router.get('/:token', (req, res) => {
  const db = req.app.locals.db;
  const share = db.prepare('SELECT * FROM shared_rigs WHERE share_token = ?').get(req.params.token);
  if (!share) return res.status(404).json({ error: 'Share not found' });

  const rig = db.prepare('SELECT * FROM rigs WHERE id = ?').get(share.rig_id);
  if (!rig) return res.status(404).json({ error: 'Rig not found' });

  const components = db.prepare('SELECT * FROM components WHERE rig_id = ? ORDER BY sort_order, created_at').all(rig.id);
  const totalCost = db.prepare('SELECT SUM(purchase_price) as total FROM components WHERE rig_id = ?').get(rig.id).total || 0;

  res.json({ ...rig, components, total_cost: totalCost, shared: true });
});

module.exports = router;
