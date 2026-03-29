const express = require('express');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const router = express.Router();

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  return Math.round((1 - totalIdle / totalTick) * 100);
}

function getDiskUsage() {
  try {
    const output = execSync("df -B1 / | tail -1", { encoding: 'utf8', timeout: 3000 });
    const parts = output.trim().split(/\s+/);
    const total = parseInt(parts[1]);
    const used = parseInt(parts[2]);
    return { total, used, percent: Math.round((used / total) * 100) };
  } catch {
    return { total: 0, used: 0, percent: 0 };
  }
}

function getNetworkStats() {
  try {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (!addr.internal && addr.family === 'IPv4') {
          ips.push({ interface: name, address: addr.address });
        }
      }
    }
    return ips;
  } catch {
    return [];
  }
}

function getLoadAvg() {
  const loads = os.loadavg();
  return { '1m': loads[0]?.toFixed(2), '5m': loads[1]?.toFixed(2), '15m': loads[2]?.toFixed(2) };
}

function getSwap() {
  try {
    const output = execSync("free -b | grep Swap", { encoding: 'utf8', timeout: 2000 });
    const parts = output.trim().split(/\s+/);
    return { total: parseInt(parts[1]) || 0, used: parseInt(parts[2]) || 0 };
  } catch { return { total: 0, used: 0 }; }
}

function getTopProcesses() {
  try {
    let output;
    try {
      output = execSync("ps aux --sort=-%cpu 2>/dev/null | head -8 | tail -7", { encoding: 'utf8', timeout: 2000 });
    } catch {
      try {
        output = execSync("ps -eo user,%cpu,%mem,comm --sort=-%cpu 2>/dev/null | head -8 | tail -7", { encoding: 'utf8', timeout: 2000 });
      } catch {
        return [];
      }
    }
    // Filter out ps/head/tail/sh commands and low-value noise
    const noise = ['ps ', 'head ', 'tail ', '/bin/sh -c ps', 'sh -c'];
    return output.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        return { user: parts[0], cpu: parts[2], mem: parts[3], command: parts.slice(10).join(' ').slice(0, 50) };
      }
      return { user: parts[0], cpu: parts[1], mem: parts[2], command: parts.slice(3).join(' ').slice(0, 50) };
    }).filter(p => !noise.some(n => p.command.startsWith(n))).slice(0, 5);
  } catch { return []; }
}

// GET /api/v1/system/stats
router.get('/stats', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const disk = getDiskUsage();
  const uptime = os.uptime();
  const swap = getSwap();
  const cpus = os.cpus();

  res.json({
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      usage: getCpuUsage(),
      per_core: cpus.map((c, i) => {
        const total = Object.values(c.times).reduce((a, b) => a + b, 0);
        return { core: i, usage: Math.round((1 - c.times.idle / total) * 100) };
      })
    },
    load: getLoadAvg(),
    memory: {
      total: totalMem,
      used: usedMem,
      percent: Math.round((usedMem / totalMem) * 100)
    },
    swap: {
      total: swap.total,
      used: swap.used,
      percent: swap.total > 0 ? Math.round((swap.used / swap.total) * 100) : 0
    },
    disk,
    uptime,
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    processes: getTopProcesses(),
    network: getNetworkStats()
  });
});

// POST /api/v1/system/backup
router.post('/backup', async (req, res) => {
  const db = req.app.locals.db;
  const DATA_DIR = req.app.locals.DATA_DIR;
  const backupDir = `${DATA_DIR}/backups`;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${backupDir}/rigboard-${timestamp}.db`;

  try {
    // Use backup API if available, otherwise copy file
    if (typeof db.backup === 'function') {
      await db.backup(backupPath);
    } else {
      const dbPath = `${DATA_DIR}/rigboard.db`;
      db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(dbPath, backupPath);
    }
    res.json({ success: true, path: backupPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
