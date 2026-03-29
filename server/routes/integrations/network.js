const express = require('express');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const dns = require('dns');
const router = express.Router();

const HOST_PROC = process.env.HOST_PROC || '/proc';

function getHostNetworkInterfaces() {
  const localIps = [];

  // Try reading from host's /proc/net/fib_trie or ip command with host network
  try {
    // If we have host PID namespace, ip addr shows host interfaces
    const output = execSync("ip -4 addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | grep -v 'docker' | grep -v 'br-' | grep -v 'veth'", { encoding: 'utf8', timeout: 3000 });
    for (const line of output.trim().split('\n').filter(Boolean)) {
      const match = line.match(/inet\s+([\d.]+)\/\d+.*\s(\w+)$/);
      if (match) {
        localIps.push({ interface: match[2], ip: match[1] });
      }
    }
  } catch {}

  // If we got real host IPs, return those
  if (localIps.length > 0) return localIps;

  // Fallback: os.networkInterfaces (shows container IPs in Docker)
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
  try {
    // Try reading from host's route table
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
  // Try host's resolv.conf
  try {
    if (fs.existsSync(`${HOST_PROC}/1/net/..`)) {
      // With pid:host, /etc/resolv.conf might be the host's
    }
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
  // Try reading host's hostname
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
