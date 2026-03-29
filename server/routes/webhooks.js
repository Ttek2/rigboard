const express = require('express');
const router = express.Router();

// POST /api/v1/webhooks/incoming — receive webhooks from external tools
router.post('/incoming', (req, res) => {
  const db = req.app.locals.db;
  const payload = req.body;
  const source = req.headers['x-webhook-source'] || req.query.source || 'unknown';

  // Store in log
  db.prepare('INSERT INTO webhook_log (source, payload) VALUES (?, ?)').run(source, JSON.stringify(payload));

  // Auto-generate notification from common webhook formats
  let title = `Webhook from ${source}`;
  let message = '';

  // Uptime Kuma format
  if (payload.heartbeat) {
    title = `${payload.monitor?.name || 'Service'}: ${payload.heartbeat.status === 1 ? 'UP' : 'DOWN'}`;
    message = payload.heartbeat.msg || payload.monitor?.url || '';
  }
  // Grafana alert format
  else if (payload.state || payload.ruleName) {
    title = payload.title || payload.ruleName || 'Grafana Alert';
    message = payload.message || payload.state || '';
  }
  // GitHub webhook format
  else if (payload.action && payload.repository) {
    title = `${payload.repository.full_name}: ${payload.action}`;
    message = payload.pull_request?.title || payload.issue?.title || '';
  }
  // Generic: try common fields
  else if (payload.title || payload.text || payload.message) {
    title = payload.title || `Webhook from ${source}`;
    message = payload.text || payload.message || payload.body || '';
  }

  db.prepare('INSERT INTO notifications (type, title, message, link) VALUES (?, ?, ?, ?)')
    .run('webhook', title, message, null);

  // Prune old webhook logs (keep 500)
  db.prepare('DELETE FROM webhook_log WHERE id NOT IN (SELECT id FROM webhook_log ORDER BY created_at DESC LIMIT 500)').run();

  res.json({ success: true });
});

// GET /api/v1/webhooks/log
router.get('/log', (req, res) => {
  const db = req.app.locals.db;
  const logs = db.prepare('SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT 50').all();
  res.json(logs.map(l => ({ ...l, payload: JSON.parse(l.payload || '{}') })));
});

module.exports = router;
