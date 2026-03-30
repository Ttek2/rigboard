const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine sysfs base path: Docker mounts /sys at /host/sys
function getSysBasePath() {
  if (fs.existsSync('/host/sys/class/drm')) return '/host/sys';
  if (fs.existsSync('/sys/class/drm')) return '/sys';
  return null;
}

function readSysfsFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// NVIDIA detection via nvidia-smi
// ---------------------------------------------------------------------------
function detectNvidia() {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,fan.speed,power.draw --format=csv,noheader,nounits',
      { timeout: 5000, encoding: 'utf8' }
    );

    const gpus = output
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          name: parts[0] || 'NVIDIA GPU',
          temp_c: parts[1] ? parseFloat(parts[1]) : null,
          usage_percent: parts[2] ? parseFloat(parts[2]) : null,
          vram_used_mb: parts[3] ? parseFloat(parts[3]) : null,
          vram_total_mb: parts[4] ? parseFloat(parts[4]) : null,
          fan_speed_percent: parts[5] && parts[5] !== '[Not Supported]' ? parseFloat(parts[5]) : null,
          power_watts: parts[6] && parts[6] !== '[Not Supported]' ? parseFloat(parts[6]) : null,
        };
      });

    if (gpus.length > 0) {
      return { detected: true, vendor: 'nvidia', gpus };
    }
  } catch {
    // nvidia-smi not available or failed
  }
  return null;
}

// ---------------------------------------------------------------------------
// AMD detection via sysfs
// ---------------------------------------------------------------------------
function detectAmd(sysBase) {
  const gpus = [];

  try {
    const drmPath = path.join(sysBase, 'class', 'drm');
    const cards = fs.readdirSync(drmPath).filter(d => /^card\d+$/.test(d));

    for (const card of cards) {
      const devicePath = path.join(drmPath, card, 'device');
      const vendor = readSysfsFile(path.join(devicePath, 'vendor'));
      if (vendor !== '0x1002') continue;

      const gpu = {
        name: null,
        temp_c: null,
        usage_percent: null,
        vram_used_mb: null,
        vram_total_mb: null,
        fan_speed_percent: null,
        power_watts: null,
      };

      // Device name — try product_name first, then hwmon name
      const productName = readSysfsFile(path.join(devicePath, 'product_name'));
      if (productName) {
        gpu.name = productName;
      } else {
        // Try hwmon name
        const hwmonName = findHwmonFile(devicePath, 'name');
        if (hwmonName) gpu.name = hwmonName;
        else gpu.name = 'AMD GPU';
      }

      // Temperature: hwmon/hwmon*/temp1_input (millidegrees)
      const temp = findHwmonFile(devicePath, 'temp1_input');
      if (temp) gpu.temp_c = parseFloat(temp) / 1000;

      // GPU usage
      const usage = readSysfsFile(path.join(devicePath, 'gpu_busy_percent'));
      if (usage !== null) gpu.usage_percent = parseFloat(usage);

      // VRAM (bytes -> MB)
      const vramUsed = readSysfsFile(path.join(devicePath, 'mem_info_vram_used'));
      if (vramUsed !== null) gpu.vram_used_mb = parseFloat(vramUsed) / (1024 * 1024);

      const vramTotal = readSysfsFile(path.join(devicePath, 'mem_info_vram_total'));
      if (vramTotal !== null) gpu.vram_total_mb = parseFloat(vramTotal) / (1024 * 1024);

      // Fan speed: hwmon/hwmon*/pwm1 (0-255 -> 0-100%)
      const pwm = findHwmonFile(devicePath, 'pwm1');
      if (pwm) gpu.fan_speed_percent = Math.round((parseFloat(pwm) / 255) * 100);

      // Power: hwmon/hwmon*/power1_average (microwatts -> watts)
      const power = findHwmonFile(devicePath, 'power1_average');
      if (power) gpu.power_watts = parseFloat(power) / 1000000;

      gpus.push(gpu);
    }
  } catch {
    // sysfs read failure
  }

  if (gpus.length > 0) {
    return { detected: true, vendor: 'amd', gpus };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Intel detection via sysfs
// ---------------------------------------------------------------------------
function detectIntel(sysBase) {
  const gpus = [];

  try {
    const drmPath = path.join(sysBase, 'class', 'drm');
    const cards = fs.readdirSync(drmPath).filter(d => /^card\d+$/.test(d));

    for (const card of cards) {
      const devicePath = path.join(drmPath, card, 'device');
      const vendor = readSysfsFile(path.join(devicePath, 'vendor'));
      if (vendor !== '0x8086') continue;

      // Verify i915 or xe driver
      let driverName = null;
      try {
        const driverLink = fs.readlinkSync(path.join(devicePath, 'driver'));
        driverName = path.basename(driverLink);
      } catch {
        // no driver symlink
      }
      if (driverName && driverName !== 'i915' && driverName !== 'xe') continue;

      const gpu = {
        name: null,
        temp_c: null,
        usage_percent: null,
        vram_used_mb: null,
        vram_total_mb: null,
        fan_speed_percent: null,
        power_watts: null,
      };

      // Device name
      const hwmonName = findHwmonFile(devicePath, 'name');
      const productName = readSysfsFile(path.join(devicePath, 'product_name'));
      gpu.name = productName || hwmonName || 'Intel GPU';

      // Temperature from hwmon
      const temp = findHwmonFile(devicePath, 'temp1_input');
      if (temp) gpu.temp_c = parseFloat(temp) / 1000;

      // For Arc GPUs, check gt frequency info
      const gtPath = path.join(sysBase, 'class', 'drm', card, 'gt', 'gt0');
      try {
        if (fs.existsSync(gtPath)) {
          // Frequency info available — could derive rough usage from cur vs max freq
          const curFreq = readSysfsFile(path.join(gtPath, 'freq0', 'cur_freq'));
          const maxFreq = readSysfsFile(path.join(gtPath, 'freq0', 'max_freq'));
          if (curFreq && maxFreq && parseFloat(maxFreq) > 0) {
            gpu.usage_percent = Math.round((parseFloat(curFreq) / parseFloat(maxFreq)) * 100);
          }
        }
      } catch {
        // gt path not available
      }

      // Fallback: try intel_gpu_top for usage
      if (gpu.usage_percent === null) {
        try {
          const igOutput = execSync('intel_gpu_top -J -s 500 -l 1', {
            timeout: 3000,
            encoding: 'utf8',
          });
          const igData = JSON.parse(igOutput);
          // intel_gpu_top JSON has engines.render.busy percentage
          if (igData.engines && igData.engines['Render/3D']) {
            gpu.usage_percent = igData.engines['Render/3D'].busy || null;
          } else if (igData.engines && igData.engines.render) {
            gpu.usage_percent = igData.engines.render.busy || null;
          }
        } catch {
          // intel_gpu_top not available
        }
      }

      // VRAM for discrete Intel GPUs
      const vramTotal = readSysfsFile(path.join(devicePath, 'mem_info_vram_total'));
      if (vramTotal !== null) gpu.vram_total_mb = parseFloat(vramTotal) / (1024 * 1024);

      const vramUsed = readSysfsFile(path.join(devicePath, 'mem_info_vram_used'));
      if (vramUsed !== null) gpu.vram_used_mb = parseFloat(vramUsed) / (1024 * 1024);

      // Power from hwmon
      const power = findHwmonFile(devicePath, 'power1_average');
      if (power) gpu.power_watts = parseFloat(power) / 1000000;

      gpus.push(gpu);
    }
  } catch {
    // sysfs read failure
  }

  if (gpus.length > 0) {
    return { detected: true, vendor: 'intel', gpus };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: find a file inside the hwmon subdirectory of a device path
// ---------------------------------------------------------------------------
function findHwmonFile(devicePath, filename) {
  try {
    const hwmonDir = path.join(devicePath, 'hwmon');
    if (!fs.existsSync(hwmonDir)) return null;
    const hwmons = fs.readdirSync(hwmonDir).filter(d => d.startsWith('hwmon'));
    for (const h of hwmons) {
      const filePath = path.join(hwmonDir, h, filename);
      const value = readSysfsFile(filePath);
      if (value !== null) return value;
    }
  } catch {
    // hwmon not available
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/v1/gpu/stats
// ---------------------------------------------------------------------------
router.get('/stats', (req, res) => {
  try {
    // 1. Try NVIDIA first (nvidia-smi is definitive)
    const nvidia = detectNvidia();
    if (nvidia) return res.json(nvidia);

    // 2. Try sysfs-based detection (AMD then Intel)
    const sysBase = getSysBasePath();
    if (sysBase) {
      const amd = detectAmd(sysBase);
      if (amd) return res.json(amd);

      const intel = detectIntel(sysBase);
      if (intel) return res.json(intel);
    }

    // 3. Nothing found
    return res.json({ detected: false, vendor: null, gpus: [] });
  } catch (err) {
    // GPU detection should NEVER crash the endpoint
    return res.json({ detected: false, vendor: null, gpus: [], error: err.message });
  }
});

module.exports = router;
