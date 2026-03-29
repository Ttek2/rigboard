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
  const HOST_PROC = process.env.HOST_PROC || '/proc';
  const disks = [];
  const realFsTypes = ['ext4', 'ext3', 'ext2', 'xfs', 'btrfs', 'zfs', 'ntfs', 'vfat', 'f2fs', 'reiserfs'];

  // Method 1: nsenter into host mount namespace (needs SYS_ADMIN + apparmor:unconfined)
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

  // Method 2: Parse host /proc/1/mounts + statfs via /proc/1/root (needs pid:host + SYS_PTRACE)
  try {
    // Try both native /proc (pid:host) and bind-mounted HOST_PROC
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
        // Try statfs via /proc/1/root (requires pid:host + SYS_PTRACE + apparmor:unconfined)
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

  // Method 3: Fallback - container df (only sees container's own root)
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
    // Use top with wide output for full command names
    let output;
    try {
      output = execSync("top -b -n 1 -w 200 -o %CPU 2>/dev/null | head -20 | tail -13", { encoding: 'utf8', timeout: 5000 });
    } catch {
      try {
        // Fallback: ps with wide output
        output = execSync("ps aux --sort=-%cpu ww 2>/dev/null | head -15 | tail -14", { encoding: 'utf8', timeout: 3000 });
      } catch {
        return [];
      }
    }

    const results = output.trim().split('\n')
      .filter(line => line && !line.trim().startsWith('PID') && !line.trim().startsWith('USER') && line.trim().length > 5)
      .map(line => {
        const parts = line.trim().split(/\s+/);
        // top format: PID USER PR NI VIRT RES SHR S %CPU %MEM TIME+ COMMAND...
        if (parts.length >= 12) {
          return { user: parts[1], cpu: parts[8], mem: parts[9], command: parts.slice(11).join(' ') };
        }
        // ps format: USER PID %CPU %MEM ... COMMAND...
        if (parts.length >= 11) {
          return { user: parts[0], cpu: parts[2], mem: parts[3], command: parts.slice(10).join(' ') };
        }
        return null;
      })
      .filter(p => {
        if (!p) return false;
        const cmd = p.command.toLowerCase();
        // Filter only our own monitoring commands
        if (cmd === 'top' || cmd.startsWith('top ') || cmd.startsWith('ps ') || cmd.startsWith('head ') || cmd.startsWith('tail ')) return false;
        if (cmd.startsWith('/bin/sh -c') || cmd.startsWith('sh -c')) return false;
        return true;
      })
      .map(p => ({ ...p, command: p.command.slice(0, 60) })) // truncate for display
      .slice(0, 5);

    if (results.length === 0) {
      results.push({ user: '-', cpu: '-', mem: '-', command: 'Add pid:host to compose for host processes' });
    }
    return results;
  } catch { return []; }
}

// GET /api/v1/system/stats
router.get('/stats', (req, res) => {
  try {
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
  } catch (err) {
    console.error('System stats error:', err.message);
    res.json({
      cpu: { model: 'Unknown', cores: os.cpus().length, usage: 0, per_core: [] },
      load: getLoadAvg(),
      memory: { total: os.totalmem(), used: os.totalmem() - os.freemem(), percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100) },
      swap: { total: 0, used: 0, percent: 0 },
      disk: { total: 0, used: 0, percent: 0, disks: [] },
      uptime: os.uptime(),
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      processes: [],
      network: []
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
