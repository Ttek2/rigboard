const express = require('express');
const fs = require('fs');
const router = express.Router();

// GET /api/v1/security/status
router.get('/status', (req, res) => {
  const db = req.app.locals.db;
  const warnings = [];

  // Check auth_enabled setting
  const authRow = db.prepare("SELECT value FROM settings WHERE key = 'auth_enabled'").get();
  const auth_enabled = authRow?.value === 'true';

  // Check totp_enabled setting
  const totpRow = db.prepare("SELECT value FROM settings WHERE key = 'totp_enabled'").get();
  const totp_enabled = totpRow?.value === 'true';

  // Check if Docker socket is mounted
  const docker_socket = fs.existsSync('/var/run/docker.sock');

  // Check if HOST_PROC is set and path exists
  const hostProcEnv = process.env.HOST_PROC;
  const host_proc = !!(hostProcEnv && fs.existsSync(hostProcEnv));

  // Check if running in host PID namespace
  let pid_host = false;
  try {
    fs.readFileSync('/proc/1/cmdline');
    pid_host = true;
  } catch {
    pid_host = false;
  }

  // Build warnings
  if (!auth_enabled) {
    warnings.push('Authentication is disabled — anyone with network access can view and modify your dashboard');
  }

  if (auth_enabled && !totp_enabled) {
    warnings.push('Two-factor authentication (TOTP) is not enabled — consider enabling it for stronger security');
  }

  if (docker_socket) {
    warnings.push('Docker socket is mounted — container has access to the Docker daemon which grants effective root on the host');
  }

  if (host_proc) {
    warnings.push('Host /proc is mounted — container can read host process information');
  }

  if (pid_host) {
    warnings.push('Running in host PID namespace — container can see all host processes');
  }

  res.json({
    auth_enabled,
    totp_enabled,
    docker_socket,
    host_proc,
    pid_host,
    warnings
  });
});

module.exports = router;
