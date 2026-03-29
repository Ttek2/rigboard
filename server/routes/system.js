const express = require('express');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const router = express.Router();

// Track previous CPU snapshot for delta calculation
let prevCpuTimes = null;

function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  const perCore = [];

  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i];
    let idle = cpu.times.idle;
    let total = 0;
    for (const type in cpu.times) total += cpu.times[type];

    if (prevCpuTimes && prevCpuTimes[i]) {
      const idleDelta = idle - prevCpuTimes[i].idle;
      const totalDelta = total - prevCpuTimes[i].total;
      const usage = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
      perCore.push({ core: i, usage });
      totalIdle += idleDelta;
      totalTick += totalDelta;
    } else {
      totalIdle += idle;
      totalTick += total;
      perCore.push({ core: i, usage: 0 });
    }

    if (!prevCpuTimes) prevCpuTimes = [];
    prevCpuTimes[i] = { idle, total };
  }

  const overall = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;
  return { overall, perCore };
}

function getDiskUsage() {
  try {
    // Read from /host/proc/mounts to find real root filesystem, then check its stats
    const HOST_PROC = process.env.HOST_PROC || '/proc';
    let rootDevice = null;

    try {
      const mounts = fs.readFileSync(`${HOST_PROC}/mounts`, 'utf8');
      const rootLine = mounts.split('\n').find(l => l.includes(' / ') && !l.includes('overlay') && !l.includes('tmpfs'));
      if (rootLine) rootDevice = rootLine.split(' ')[0];
    } catch {}

    // Try df on the host's root device, or common paths
    let output;
    if (rootDevice) {
      try { output = execSync(`df -B1 ${rootDevice} 2>/dev/null | tail -1`, { encoding: 'utf8', timeout: 3000 }); } catch {}
    }
    if (!output) {
      // Try /host/sys as a proxy to the host filesystem
      try { output = execSync("df -B1 /host/sys 2>/dev/null | tail -1", { encoding: 'utf8', timeout: 3000 }); } catch {}
    }
    if (!output) {
      // Fallback: read from /host/proc/diskstats or just use df /
      output = execSync("df -B1 / | tail -1", { encoding: 'utf8', timeout: 3000 });
    }

    const parts = output.trim().split(/\s+/);
    const total = parseInt(parts[1]) || 0;
    const used = parseInt(parts[2]) || 0;
    return { total, used, percent: total > 0 ? Math.round((used / total) * 100) : 0 };
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

const HOST_PROC = process.env.HOST_PROC || '/proc';

function getSwap() {
  try {
    // Try reading from host /proc if mounted
    const meminfo = fs.readFileSync(`${HOST_PROC}/meminfo`, 'utf8');
    const swapTotal = parseInt(meminfo.match(/SwapTotal:\s+(\d+)/)?.[1] || '0') * 1024;
    const swapFree = parseInt(meminfo.match(/SwapFree:\s+(\d+)/)?.[1] || '0') * 1024;
    return { total: swapTotal, used: swapTotal - swapFree };
  } catch {
    try {
      const output = execSync("free -b | grep Swap", { encoding: 'utf8', timeout: 2000 });
      const parts = output.trim().split(/\s+/);
      return { total: parseInt(parts[1]) || 0, used: parseInt(parts[2]) || 0 };
    } catch { return { total: 0, used: 0 }; }
  }
}

function getTopProcesses() {
  try {
    // Use top in batch mode for real-time CPU (not cumulative like ps)
    let output;
    try {
      output = execSync("top -b -n 1 -o %CPU 2>/dev/null | head -17 | tail -10", { encoding: 'utf8', timeout: 5000 });
    } catch {
      // Fallback: ps (shows cumulative, but better than nothing)
      try {
        output = execSync("ps aux --sort=-%cpu 2>/dev/null | head -12 | tail -11", { encoding: 'utf8', timeout: 3000 });
      } catch {
        return [];
      }
    }

    const noise = ['top ', 'ps ', 'head ', 'tail ', '/bin/sh -c', 'sh -c'];
    const results = output.trim().split('\n')
      .filter(Boolean)
      .filter(line => !line.trim().startsWith('PID') && !line.trim().startsWith('USER') && !line.includes('%CPU') && !line.includes('COMMAND') && line.trim().length > 10)
      .map(line => {
        const parts = line.trim().split(/\s+/);
        // top format: PID USER PR NI VIRT RES SHR S %CPU %MEM TIME+ COMMAND
        if (parts.length >= 12) {
          return { user: parts[1], cpu: parts[8], mem: parts[9], command: parts.slice(11).join(' ').slice(0, 50) };
        }
        // ps format: USER PID %CPU %MEM ... COMMAND
        if (parts.length >= 11) {
          return { user: parts[0], cpu: parts[2], mem: parts[3], command: parts.slice(10).join(' ').slice(0, 50) };
        }
        return null;
      })
      .filter(p => p && !noise.some(n => p.command.startsWith(n)))
      .slice(0, 5);

    if (results.length === 0) {
      results.push({ user: '-', cpu: '-', mem: '-', command: 'Add pid:host to compose for host processes' });
    }
    return results;
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
  const cpuUsage = getCpuUsage();

  res.json({
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      usage: cpuUsage.overall,
      per_core: cpuUsage.perCore,
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
