const express = require('express');
const os = require('os');
const { execSync } = require('child_process');
const dns = require('dns');
const router = express.Router();

// GET /api/v1/integrations/network/info
router.get('/info', async (req, res) => {
  const interfaces = os.networkInterfaces();
  const localIps = [];
  let gateway = '';

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (!addr.internal && addr.family === 'IPv4') {
        localIps.push({ interface: name, ip: addr.address, mac: addr.mac });
      }
    }
  }

  try { gateway = execSync("ip route | grep default | awk '{print $3}'", { encoding: 'utf8', timeout: 2000 }).trim(); } catch {}

  // WAN IP
  let wanIp = '';
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    wanIp = (await r.json()).ip;
  } catch {}

  // DNS servers
  const dnsServers = dns.getServers();

  // Ping latency to common endpoints
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
    hostname: os.hostname()
  });
});

module.exports = router;
