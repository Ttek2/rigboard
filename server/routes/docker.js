const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');

// GET /api/v1/docker/containers
router.get('/containers', (req, res) => {
  try {
    const output = execSync(
      'docker ps -a --format \'{"name":"{{.Names}}","status":"{{.Status}}","state":"{{.State}}","image":"{{.Image}}","ports":"{{.Ports}}"}\'',
      { timeout: 5000, encoding: 'utf8' }
    );
    const containers = output.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    res.json(containers);
  } catch (err) {
    res.json([]);
  }
});

// POST /api/v1/docker/containers/:name/:action (start, stop, restart)
router.post('/containers/:name/:action', (req, res) => {
  const { name, action } = req.params;
  if (!['start', 'stop', 'restart'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Use start, stop, or restart.' });
  }
  try {
    execSync(`docker ${action} ${name}`, { timeout: 30000, encoding: 'utf8' });
    res.json({ success: true, container: name, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/docker/stats — per-container resource usage
router.get('/stats', (req, res) => {
  try {
    const output = execSync(
      'docker stats --no-stream --format \'{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","mem_pct":"{{.MemPerc}}","net":"{{.NetIO}}","block":"{{.BlockIO}}"}\'',
      { timeout: 10000, encoding: 'utf8' }
    );
    const stats = output.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    res.json(stats);
  } catch (err) {
    res.json([]);
  }
});

module.exports = router;
