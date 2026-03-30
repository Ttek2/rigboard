const express = require('express');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const dns = require('dns');
const router = express.Router();

const HOST_PROC = process.env.HOST_PROC || '/proc';

function getHostNetworkInterfaces() {
  const localIps = [];

  // Method 1: Read PID 1's fib_trie (pid:host gives access to host's network namespace via /proc/1/net)
  try {
    const fibTrie = fs.readFileSync('/proc/1/net/fib_trie', 'utf8');
    const ips = new Set();
    // Parse fib_trie: IP line followed by "/32 host LOCAL" = assigned host IP
    const lines = fibTrie.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('/32 host LOCAL')) {
        // The IP is on the previous line, may have |-- prefix or just whitespace
        const ipMatch = lines[i - 1]?.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch && ipMatch[1] !== '127.0.0.1') {
          ips.add(ipMatch[1]);
        }
      }
    }
    // Get real host interface names from /proc/1/net/dev
    const hostIfaces = [];
    try {
      const dev = fs.readFileSync('/proc/1/net/dev', 'utf8');
      for (const line of dev.split('\n').slice(2)) {
        const iface = line.trim().split(':')[0];
        if (iface && !['lo', 'docker0'].includes(iface) && !iface.startsWith('veth') && !iface.startsWith('br-')) {
          hostIfaces.push(iface);
        }
      }
    } catch {}

    // Map IPs to interfaces via nsenter if available
    let ifaceMap = {};
    try {
      const output = execSync("nsenter -t 1 -n -- ip -4 addr show 2>/dev/null", { encoding: 'utf8', timeout: 3000 });
      let lastIface = '';
      for (const line of output.split('\n')) {
        const ifMatch = line.match(/^\d+:\s+(\S+?)[@:]/);
        if (ifMatch) lastIface = ifMatch[1];
        const ipMatch = line.match(/inet\s+([\d.]+)/);
        if (ipMatch && lastIface) ifaceMap[ipMatch[1]] = lastIface;
      }
    } catch {}

    let ifaceIdx = 0;
    for (const ip of ips) {
      if (ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.')) continue;
      const name = ifaceMap[ip] || hostIfaces[ifaceIdx] || 'eth0';
      if (!ifaceMap[ip]) ifaceIdx++;
      localIps.push({ interface: name, ip });
    }
    if (localIps.length > 0) return localIps;
  } catch {}

  // Method 2: nsenter into host network namespace
  try {
    const output = execSync("nsenter -t 1 -n -- ip -4 addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | grep -v 'docker' | grep -v 'br-' | grep -v 'veth'", { encoding: 'utf8', timeout: 3000 });
    for (const line of output.trim().split('\n').filter(Boolean)) {
      const match = line.match(/inet\s+([\d.]+)\/\d+.*\s(\w+)$/);
      if (match) localIps.push({ interface: match[2], ip: match[1] });
    }
    if (localIps.length > 0) return localIps;
  } catch {}

  // Method 3: ip addr from container (with pid:host, may still show container IPs)
  try {
    const output = execSync("ip -4 addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | grep -v 'docker' | grep -v 'br-' | grep -v 'veth'", { encoding: 'utf8', timeout: 3000 });
    for (const line of output.trim().split('\n').filter(Boolean)) {
      const match = line.match(/inet\s+([\d.]+)\/\d+.*\s(\w+)$/);
      if (match) localIps.push({ interface: match[2], ip: match[1] });
    }
    if (localIps.length > 0) return localIps;
  } catch {}

  // Method 4: Fallback os.networkInterfaces
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (!addr.internal && addr.family === 'IPv4') {
        localIps.push({ interface: name, ip: addr.address, mac: addr.mac });
      }
    }
  }
  return localIps;
}

function getHostGateway() {
  // Try PID 1's route table first (host network namespace)
  try {
    if (fs.existsSync('/proc/1/net/route')) {
      const routes = fs.readFileSync('/proc/1/net/route', 'utf8');
      for (const line of routes.split('\n').slice(1)) {
        const parts = line.split('\t');
        if (parts[1] === '00000000' && parts[7] === '00000000') {
          const hex = parts[2];
          return [parseInt(hex.slice(6,8),16),parseInt(hex.slice(4,6),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(0,2),16)].join('.');
        }
      }
    }
  } catch {}
  try {
    // Fallback to HOST_PROC route table
    if (fs.existsSync(`${HOST_PROC}/net/route`)) {
      const routes = fs.readFileSync(`${HOST_PROC}/net/route`, 'utf8');
      for (const line of routes.split('\n').slice(1)) {
        const parts = line.split('\t');
        if (parts[1] === '00000000' && parts[7] === '00000000') {
          // Default route - gateway is in hex
          const hex = parts[2];
          const ip = [
            parseInt(hex.slice(6, 8), 16),
            parseInt(hex.slice(4, 6), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(0, 2), 16),
          ].join('.');
          return ip;
        }
      }
    }
  } catch {}

  try {
    return execSync("ip route | grep default | awk '{print $3}'", { encoding: 'utf8', timeout: 2000 }).trim();
  } catch { return ''; }
}

function getHostDns() {
  // Try host's resolv.conf via PID 1's root
  try {
    const hostResolv = fs.readFileSync('/proc/1/root/etc/resolv.conf', 'utf8');
    const servers = [];
    for (const line of hostResolv.split('\n')) {
      const match = line.match(/^nameserver\s+([\d.]+)/);
      if (match) servers.push(match[1]);
    }
    if (servers.length > 0 && !servers.every(s => s === '127.0.0.11')) return servers;
  } catch {}
  // Fallback to container's resolv.conf
  try {
    const resolvConf = fs.readFileSync('/etc/resolv.conf', 'utf8');
    const servers = [];
    for (const line of resolvConf.split('\n')) {
      const match = line.match(/^nameserver\s+([\d.]+)/);
      if (match) servers.push(match[1]);
    }
    if (servers.length > 0 && !servers.every(s => s === '127.0.0.11')) return servers;
  } catch {}

  return dns.getServers();
}

function getHostHostname() {
  // Try reading host's hostname via PID 1's root filesystem
  try {
    const h = fs.readFileSync('/proc/1/root/etc/hostname', 'utf8').trim();
    if (h) return h;
  } catch {}
  try {
    if (fs.existsSync(`${HOST_PROC}/sys/kernel/hostname`)) {
      return fs.readFileSync(`${HOST_PROC}/sys/kernel/hostname`, 'utf8').trim();
    }
  } catch {}
  return os.hostname();
}

// GET /api/v1/integrations/network/info
router.get('/info', async (req, res) => {
  const localIps = getHostNetworkInterfaces();
  const gateway = getHostGateway();
  const hostname = getHostHostname();

  // WAN IP
  let wanIp = '';
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    wanIp = (await r.json()).ip;
  } catch {}

  const dnsServers = getHostDns();

  // Ping latency
  const pings = {};
  for (const host of ['1.1.1.1', '8.8.8.8']) {
    try {
      const output = execSync(`ping -c 1 -W 2 ${host}`, { encoding: 'utf8', timeout: 3000 });
      const match = output.match(/time=([\d.]+)/);
      if (match) pings[host] = parseFloat(match[1]);
    } catch { pings[host] = null; }
  }

  res.json({
    local: localIps,
    wan: wanIp,
    gateway,
    dns: dnsServers,
    latency: pings,
    hostname
  });
});

module.exports = router;
