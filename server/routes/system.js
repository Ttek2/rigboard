const express = require('express');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const router = express.Router();

const HOST_PROC = process.env.HOST_PROC || '/proc';

// ── CPU ──────────────────────────────────────────────────────────────
// Read from HOST_PROC/stat for accurate host CPU, no pid:host needed
let prevCpuTimes = null;

function getCpuUsage() {
  try {
    const stat = fs.readFileSync(`${HOST_PROC}/stat`, 'utf8');
    const lines = stat.split('\n');
    const perCore = [];
    let totalIdle = 0, totalTick = 0;
    let coreIndex = 0;

    for (const line of lines) {
      if (!line.startsWith('cpu')) continue;
      const parts = line.trim().split(/\s+/);
      const name = parts[0];
      // cpu = aggregate, cpu0/cpu1/... = per-core
      const values = parts.slice(1).map(Number);
      // user, nice, system, idle, iowait, irq, softirq, steal
      const idle = (values[3] || 0) + (values[4] || 0);
      const total = values.reduce((a, b) => a + b, 0);

      if (name === 'cpu') {
        // aggregate
        if (prevCpuTimes?.aggregate) {
          const idleDelta = idle - prevCpuTimes.aggregate.idle;
          const totalDelta = total - prevCpuTimes.aggregate.total;
          totalIdle = idleDelta;
          totalTick = totalDelta;
        }
        if (!prevCpuTimes) prevCpuTimes = {};
        prevCpuTimes.aggregate = { idle, total };
      } else {
        // per-core
        const ci = coreIndex++;
        let usage = 0;
        if (prevCpuTimes?.cores?.[ci]) {
          const idleDelta = idle - prevCpuTimes.cores[ci].idle;
          const totalDelta = total - prevCpuTimes.cores[ci].total;
          usage = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
        }
        perCore.push({ core: ci, usage });
        if (!prevCpuTimes) prevCpuTimes = {};
        if (!prevCpuTimes.cores) prevCpuTimes.cores = [];
        prevCpuTimes.cores[ci] = { idle, total };
      }
    }

    const overall = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;
    return { overall, perCore };
  } catch {
    // Fallback to os.cpus()
    const cpus = os.cpus();
    return { overall: 0, perCore: cpus.map((_, i) => ({ core: i, usage: 0 })) };
  }
}

function getCpuInfo() {
  try {
    const cpuinfo = fs.readFileSync(`${HOST_PROC}/cpuinfo`, 'utf8');
    const modelMatch = cpuinfo.match(/model name\s*:\s*(.+)/);
    const model = modelMatch ? modelMatch[1].trim() : 'Unknown';
    const cores = (cpuinfo.match(/^processor\s/gm) || []).length;
    return { model, cores: cores || os.cpus().length };
  } catch {
    const cpus = os.cpus();
    return { model: cpus[0]?.model || 'Unknown', cores: cpus.length };
  }
}

// ── Memory ───────────────────────────────────────────────────────────
// Read from HOST_PROC/meminfo for host memory, not container cgroup limit
function getMemory() {
  try {
    const meminfo = fs.readFileSync(`${HOST_PROC}/meminfo`, 'utf8');
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] || '0') * 1024;
    const free = parseInt(meminfo.match(/MemFree:\s+(\d+)/)?.[1] || '0') * 1024;
    const buffers = parseInt(meminfo.match(/Buffers:\s+(\d+)/)?.[1] || '0') * 1024;
    const cached = parseInt(meminfo.match(/Cached:\s+(\d+)/)?.[1] || '0') * 1024;
    const used = total - free - buffers - cached;
    return { total, used: Math.max(used, 0), percent: total > 0 ? Math.round((Math.max(used, 0) / total) * 100) : 0 };
  } catch {
    const total = os.totalmem();
    const used = total - os.freemem();
    return { total, used, percent: Math.round((used / total) * 100) };
  }
}

function getSwap() {
  try {
    const meminfo = fs.readFileSync(`${HOST_PROC}/meminfo`, 'utf8');
    const swapTotal = parseInt(meminfo.match(/SwapTotal:\s+(\d+)/)?.[1] || '0') * 1024;
    const swapFree = parseInt(meminfo.match(/SwapFree:\s+(\d+)/)?.[1] || '0') * 1024;
    return { total: swapTotal, used: swapTotal - swapFree };
  } catch {
    return { total: 0, used: 0 };
  }
}

// ── Load + Uptime ────────────────────────────────────────────────────
function getLoadAvg() {
  try {
    const loadavg = fs.readFileSync(`${HOST_PROC}/loadavg`, 'utf8').trim().split(/\s+/);
    return { '1m': parseFloat(loadavg[0]).toFixed(2), '5m': parseFloat(loadavg[1]).toFixed(2), '15m': parseFloat(loadavg[2]).toFixed(2) };
  } catch {
    const loads = os.loadavg();
    return { '1m': loads[0]?.toFixed(2), '5m': loads[1]?.toFixed(2), '15m': loads[2]?.toFixed(2) };
  }
}

function getUptime() {
  try {
    const uptime = fs.readFileSync(`${HOST_PROC}/uptime`, 'utf8').trim().split(/\s+/);
    return parseFloat(uptime[0]);
  } catch {
    return os.uptime();
  }
}

// ── Hostname ─────────────────────────────────────────────────────────
function getHostname() {
  try {
    return fs.readFileSync(`${HOST_PROC}/sys/kernel/hostname`, 'utf8').trim();
  } catch {
    return os.hostname();
  }
}

// ── Disk ─────────────────────────────────────────────────────────────
function getDiskUsage() {
  const disks = [];
  const realFsTypes = ['ext4', 'ext3', 'ext2', 'xfs', 'btrfs', 'zfs', 'ntfs', 'vfat', 'f2fs', 'reiserfs'];

  // Method 1: nsenter (needs SYS_ADMIN + apparmor:unconfined)
  try {
    const output = execSync("nsenter -t 1 -m -u -n -- df -B1 -x tmpfs -x devtmpfs -x efivarfs -x squashfs 2>/dev/null", { encoding: 'utf8', timeout: 5000 });
    for (const line of output.trim().split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6 && parts[0].startsWith('/dev/')) {
        const total = parseInt(parts[1]) || 0;
        const used = parseInt(parts[2]) || 0;
        if (total > 500 * 1024 * 1024) {
          disks.push({ device: parts[0].split('/').pop(), total, used, mountpoint: parts[5], percent: total > 0 ? Math.round((used / total) * 100) : 0 });
        }
      }
    }
    if (disks.length > 0) {
      const root = disks.find(d => d.mountpoint === '/') || disks[0];
      return { total: root.total, used: root.used, percent: root.percent, disks };
    }
  } catch {}

  // Method 2: statfs via /proc/1/root (needs pid:host + SYS_PTRACE)
  try {
    let mounts;
    try { mounts = fs.readFileSync('/proc/1/mounts', 'utf8'); } catch {}
    if (!mounts) try { mounts = fs.readFileSync(`${HOST_PROC}/1/mounts`, 'utf8'); } catch {}
    if (mounts) {
      for (const line of mounts.split('\n')) {
        const parts = line.split(' ');
        if (parts.length < 3 || !parts[0].startsWith('/dev/') || !realFsTypes.includes(parts[2])) continue;
        const device = parts[0];
        const mountpoint = parts[1];
        if (mountpoint.includes('/docker/') || mountpoint.includes('/overlay2/') || mountpoint.includes('/containers/')) continue;
        let stat;
        try { stat = fs.statfsSync(`/proc/1/root${mountpoint}`); } catch {}
        if (!stat) try { stat = fs.statfsSync(`${HOST_PROC}/1/root${mountpoint}`); } catch {}
        if (stat) {
          const bsize = Number(stat.bsize);
          const total = Number(stat.blocks) * bsize;
          const used = (Number(stat.blocks) - Number(stat.bfree)) * bsize;
          if (total > 500 * 1024 * 1024) {
            disks.push({ device: device.split('/').pop(), total, used, mountpoint, percent: total > 0 ? Math.round((used / total) * 100) : 0 });
          }
        }
      }
      if (disks.length > 0) {
        const root = disks.find(d => d.mountpoint === '/') || disks[0];
        return { total: root.total, used: root.used, percent: root.percent, disks };
      }
    }
  } catch {}

  // Method 3: container df fallback
  try {
    const output = execSync("df -B1 / 2>/dev/null | tail -1", { encoding: 'utf8', timeout: 2000 });
    const parts = output.trim().split(/\s+/);
    const total = parseInt(parts[1]) || 0;
    const used = parseInt(parts[2]) || 0;
    disks.push({ device: 'root', total, used, mountpoint: '/', percent: total > 0 ? Math.round((used / total) * 100) : 0 });
  } catch {}

  const root = disks.find(d => d.mountpoint === '/') || disks[0] || { total: 0, used: 0, percent: 0 };
  return { total: root.total || 0, used: root.used || 0, percent: root.percent || 0, disks };
}

// ── Processes ────────────────────────────────────────────────────────
// Only works with pid:host — degrades gracefully without it
function getTopProcesses() {
  try {
    let output;
    try {
      output = execSync("top -b -n 1 -w 200 -o %CPU 2>/dev/null | head -20 | tail -13", { encoding: 'utf8', timeout: 5000 });
    } catch {
      try {
        output = execSync("ps aux --sort=-%cpu ww 2>/dev/null | head -15 | tail -14", { encoding: 'utf8', timeout: 3000 });
      } catch {
        return [];
      }
    }

    const results = output.trim().split('\n')
      .filter(line => line && !line.trim().startsWith('PID') && !line.trim().startsWith('USER') && line.trim().length > 5)
      .map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 12) {
          return { user: parts[1], cpu: parts[8], mem: parts[9], command: parts.slice(11).join(' ') };
        }
        if (parts.length >= 11) {
          return { user: parts[0], cpu: parts[2], mem: parts[3], command: parts.slice(10).join(' ') };
        }
        return null;
      })
      .filter(p => {
        if (!p) return false;
        const cmd = p.command.toLowerCase();
        if (cmd === 'top' || cmd.startsWith('top ') || cmd.startsWith('ps ') || cmd.startsWith('head ') || cmd.startsWith('tail ')) return false;
        if (cmd.startsWith('/bin/sh -c') || cmd.startsWith('sh -c')) return false;
        return true;
      })
      .map(p => ({ ...p, command: p.command.slice(0, 60) }))
      .slice(0, 5);

    if (results.length === 0) {
      results.push({ user: '-', cpu: '-', mem: '-', command: 'Add pid:host to compose for host processes' });
    }
    return results;
  } catch { return []; }
}

// ── Platform ─────────────────────────────────────────────────────────
function getPlatform() {
  try {
    const version = fs.readFileSync(`${HOST_PROC}/version`, 'utf8').trim();
    const match = version.match(/Linux version ([\S]+)/);
    return `Linux ${match ? match[1] : ''}`;
  } catch {
    return `${os.type()} ${os.release()}`;
  }
}

// GET /api/v1/system/stats
router.get('/stats', (req, res) => {
  try {
    const cpuInfo = getCpuInfo();
    const cpuUsage = getCpuUsage();
    const memory = getMemory();
    const swap = getSwap();
    const disk = getDiskUsage();
    const uptime = getUptime();

    res.json({
      cpu: {
        model: cpuInfo.model,
        cores: cpuInfo.cores,
        usage: cpuUsage.overall,
        per_core: cpuUsage.perCore,
      },
      load: getLoadAvg(),
      memory,
      swap: {
        total: swap.total,
        used: swap.used,
        percent: swap.total > 0 ? Math.round((swap.used / swap.total) * 100) : 0
      },
      disk,
      uptime,
      hostname: getHostname(),
      platform: getPlatform(),
      arch: os.arch(),
      processes: getTopProcesses(),
      network: [] // Network info moved to dedicated /integrations/network/info endpoint
    });
  } catch (err) {
    console.error('System stats error:', err.message);
    res.json({
      cpu: { model: 'Unknown', cores: 0, usage: 0, per_core: [] },
      load: { '1m': '0', '5m': '0', '15m': '0' },
      memory: { total: 0, used: 0, percent: 0 },
      swap: { total: 0, used: 0, percent: 0 },
      disk: { total: 0, used: 0, percent: 0, disks: [] },
      uptime: 0, hostname: 'unknown', platform: 'unknown', arch: os.arch(),
      processes: [], network: []
    });
  }
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
