const express = require('express');
const router = express.Router();

// Simple download speed test — download a known file and measure throughput
async function measureDownload() {
  const testUrls = [
    'https://speed.cloudflare.com/__down?bytes=10000000', // 10MB from Cloudflare
    'https://proof.ovh.net/files/1Mb.dat', // 1MB fallback
  ];

  for (const url of testUrls) {
    try {
      const start = Date.now();
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const buffer = await res.arrayBuffer();
      const elapsed = (Date.now() - start) / 1000;
      const bytes = buffer.byteLength;
      const mbps = ((bytes * 8) / elapsed / 1000000).toFixed(2);
      return { mbps: parseFloat(mbps), bytes, elapsed: elapsed.toFixed(2), server: new URL(url).hostname };
    } catch { continue; }
  }
  return null;
}

// Simple latency test
async function measureLatency() {
  const targets = ['1.1.1.1', '8.8.8.8'];
  const results = {};
  for (const host of targets) {
    try {
      const { execSync } = require('child_process');
      const output = execSync(`ping -c 3 -W 2 ${host}`, { encoding: 'utf8', timeout: 10000 });
      const match = output.match(/avg.*?=.*?\/([\d.]+)\//);
      if (match) results[host] = parseFloat(match[1]);
    } catch {}
  }
  return results;
}

// POST /api/v1/speedtest/run — run a speed test
router.post('/run', async (req, res) => {
  const db = req.app.locals.db;

  try {
    const download = await measureDownload();
    const latency = await measureLatency();

    const result = {
      download_mbps: download?.mbps || 0,
      server: download?.server || 'unknown',
      latency_ms: latency['1.1.1.1'] || latency['8.8.8.8'] || 0,
      tested_at: new Date().toISOString(),
    };

    // Store result
    try {
      db.prepare('INSERT INTO speedtest_results (download_mbps, latency_ms, server) VALUES (?, ?, ?)').run(result.download_mbps, result.latency_ms, result.server);
    } catch {
      // Table might not exist yet — create it
      db.exec(`CREATE TABLE IF NOT EXISTS speedtest_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        download_mbps REAL,
        upload_mbps REAL,
        latency_ms REAL,
        server TEXT,
        tested_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      db.prepare('INSERT INTO speedtest_results (download_mbps, latency_ms, server) VALUES (?, ?, ?)').run(result.download_mbps, result.latency_ms, result.server);
    }

    // Prune old results (keep last 100)
    db.prepare('DELETE FROM speedtest_results WHERE id NOT IN (SELECT id FROM speedtest_results ORDER BY tested_at DESC LIMIT 100)').run();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/speedtest/history — last N results
router.get('/history', (req, res) => {
  const db = req.app.locals.db;
  try {
    const results = db.prepare('SELECT * FROM speedtest_results ORDER BY tested_at DESC LIMIT 30').all();
    res.json(results);
  } catch {
    res.json([]);
  }
});

module.exports = router;
