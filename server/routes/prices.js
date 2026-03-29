const express = require('express');
const router = express.Router();

// POST /api/v1/prices/:componentId — record a price
router.post('/:componentId', (req, res) => {
  const db = req.app.locals.db;
  const { price, currency, source } = req.body;
  const result = db.prepare(
    'INSERT INTO price_history (component_id, price, currency, source) VALUES (?, ?, ?, ?)'
  ).run(req.params.componentId, price, currency || 'EUR', source || 'manual');

  // Also update the component's current price
  db.prepare('UPDATE components SET purchase_price = ?, currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(price, currency || 'EUR', req.params.componentId);

  const entry = db.prepare('SELECT * FROM price_history WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// GET /api/v1/prices/:componentId — get price history
router.get('/:componentId', (req, res) => {
  const db = req.app.locals.db;
  const history = db.prepare(
    'SELECT * FROM price_history WHERE component_id = ? ORDER BY recorded_at ASC'
  ).all(req.params.componentId);
  res.json(history);
});

// GET /api/v1/prices/:componentId/summary
router.get('/:componentId/summary', (req, res) => {
  const db = req.app.locals.db;
  const stats = db.prepare(`
    SELECT MIN(price) as min_price, MAX(price) as max_price, AVG(price) as avg_price,
      COUNT(*) as entries, currency
    FROM price_history WHERE component_id = ?
  `).get(req.params.componentId);
  res.json(stats);
});

module.exports = router;
