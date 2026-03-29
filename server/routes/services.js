const express = require('express');
const router = express.Router();

// GET /api/v1/services
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const services = db.prepare('SELECT * FROM services ORDER BY group_name, name').all();
  res.json(services);
});

// POST /api/v1/services
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name, url, icon, group_name, check_interval_seconds } = req.body;
  const result = db.prepare(
    'INSERT INTO services (name, url, icon, group_name, check_interval_seconds) VALUES (?, ?, ?, ?, ?)'
  ).run(name, url, icon || null, group_name || 'Default', check_interval_seconds || 60);
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(service);
});

// PUT /api/v1/services/:id
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Service not found' });

  const { name, url, icon, group_name, check_interval_seconds, is_enabled } = req.body;
  db.prepare(
    'UPDATE services SET name = ?, url = ?, icon = ?, group_name = ?, check_interval_seconds = ?, is_enabled = ? WHERE id = ?'
  ).run(
    name || existing.name, url || existing.url, icon !== undefined ? icon : existing.icon,
    group_name || existing.group_name, check_interval_seconds || existing.check_interval_seconds,
    is_enabled !== undefined ? is_enabled : existing.is_enabled, req.params.id
  );
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  res.json(service);
});

// DELETE /api/v1/services/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/v1/services/status
router.get('/status', (req, res) => {
  const db = req.app.locals.db;
  const services = db.prepare('SELECT * FROM services WHERE is_enabled = 1 ORDER BY group_name, name').all();

  // Attach last 48 checks for sparklines + uptime percentage (30 days)
  const servicesWithHistory = services.map(s => {
    const checks = db.prepare(
      'SELECT status, response_ms, checked_at FROM service_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 48'
    ).all(s.id);

    // Calculate uptime percentage over last 30 days
    const totalChecks = db.prepare(
      "SELECT COUNT(*) as total FROM service_checks WHERE service_id = ? AND checked_at > datetime('now', '-30 days')"
    ).get(s.id).total;
    const onlineChecks = db.prepare(
      "SELECT COUNT(*) as online FROM service_checks WHERE service_id = ? AND status IN ('online', 'slow') AND checked_at > datetime('now', '-30 days')"
    ).get(s.id).online;
    const uptime = totalChecks > 0 ? Math.round((onlineChecks / totalChecks) * 1000) / 10 : null;

    // Response time stats (last 24h)
    const responseTimes = db.prepare(
      "SELECT response_ms FROM service_checks WHERE service_id = ? AND status IN ('online', 'slow') AND checked_at > datetime('now', '-1 day') ORDER BY response_ms"
    ).all(s.id).map(r => r.response_ms);

    const avg = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null;
    const p95 = responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.95)] : null;

    // Consecutive uptime (how long since last offline)
    const lastOffline = db.prepare(
      "SELECT checked_at FROM service_checks WHERE service_id = ? AND status = 'offline' ORDER BY checked_at DESC LIMIT 1"
    ).get(s.id);
    const consecutiveUpSince = lastOffline?.checked_at || s.created_at;

    return { ...s, checks: checks.reverse(), uptime, avg_ms: avg, p95_ms: p95, up_since: consecutiveUpSince };
  });

  res.json(servicesWithHistory);
});

module.exports = router;
