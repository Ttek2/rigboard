const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const http = require('http');

// Docker socket API — more reliable than CLI from inside containers
function dockerSocketGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: '/var/run/docker.sock', path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function dockerSocketPost(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: '/var/run/docker.sock', path, method: 'POST' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// GET /api/v1/docker/containers
router.get('/containers', async (req, res) => {
  // Try Docker socket API first (works inside container without docker-cli)
  try {
    const containers = await dockerSocketGet('/containers/json?all=true');
    if (Array.isArray(containers)) {
      return res.json(containers.map(c => ({
        name: (c.Names?.[0] || '').replace(/^\//, ''),
        status: c.Status,
        state: c.State,
        image: c.Image,
        ports: (c.Ports || []).map(p => p.PublicPort ? `${p.PublicPort}->${p.PrivatePort}/${p.Type}` : `${p.PrivatePort}/${p.Type}`).join(', '),
        health: c.Status?.includes('healthy') ? 'healthy' : c.Status?.includes('unhealthy') ? 'unhealthy' : null,
      })));
    }
  } catch {}

  // Fallback to CLI
  try {
    const output = execSync(
      'docker ps -a --format \'{"name":"{{.Names}}","status":"{{.Status}}","state":"{{.State}}","image":"{{.Image}}","ports":"{{.Ports}}"}\'',
      { timeout: 5000, encoding: 'utf8' }
    );
    const containers = output.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    res.json(containers);
  } catch {
    res.json([]);
  }
});

// POST /api/v1/docker/containers/:name/:action
router.post('/containers/:name/:action', async (req, res) => {
  const { name, action } = req.params;
  if (!['start', 'stop', 'restart'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // Try socket API first
  try {
    const status = await dockerSocketPost(`/containers/${name}/${action}`);
    if (status === 204 || status === 304) return res.json({ success: true, container: name, action });
  } catch {}

  // Fallback to CLI
  try {
    execSync(`docker ${action} ${name}`, { timeout: 30000, encoding: 'utf8' });
    res.json({ success: true, container: name, action });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/docker/stats
router.get('/stats', async (req, res) => {
  // Try socket API
  try {
    const containers = await dockerSocketGet('/containers/json');
    if (Array.isArray(containers)) {
      const stats = [];
      for (const c of containers.slice(0, 15)) {
        try {
          const s = await dockerSocketGet(`/containers/${c.Id}/stats?stream=false`);
          if (s) {
            const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage || 0) - (s.precpu_stats?.cpu_usage?.total_usage || 0);
            const sysDelta = (s.cpu_stats?.system_cpu_usage || 0) - (s.precpu_stats?.system_cpu_usage || 0);
            const cpuPct = sysDelta > 0 ? ((cpuDelta / sysDelta) * (s.cpu_stats?.online_cpus || 1) * 100).toFixed(1) + '%' : '0%';
            const memUsage = s.memory_stats?.usage || 0;
            const memLimit = s.memory_stats?.limit || 1;
            const memPct = ((memUsage / memLimit) * 100).toFixed(1) + '%';
            stats.push({
              name: (c.Names?.[0] || '').replace(/^\//, ''),
              cpu: cpuPct,
              mem: `${(memUsage / 1024 / 1024).toFixed(0)}MiB`,
              mem_pct: memPct,
            });
          }
        } catch {}
      }
      return res.json(stats);
    }
  } catch {}

  // Fallback to CLI
  try {
    const output = execSync(
      "docker stats --no-stream --format '{\"name\":\"{{.Name}}\",\"cpu\":\"{{.CPUPerc}}\",\"mem\":\"{{.MemUsage}}\",\"mem_pct\":\"{{.MemPerc}}\"}'",
      { timeout: 10000, encoding: 'utf8' }
    );
    res.json(output.trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean));
  } catch {
    res.json([]);
  }
});

module.exports = router;
