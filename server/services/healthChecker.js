const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

async function checkService(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    const status = response.ok ? (responseTime > 2000 ? 'slow' : 'online') : 'offline';
    return { status, responseTime };
  } catch (err) {
    const responseTime = Date.now() - start;
    const status = err.name === 'AbortError' ? 'unknown' : 'offline';
    return { status, responseTime };
  }
}

async function fireWebhook(url, payload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });
  } catch (err) {
    console.error(`Webhook failed for ${url}: ${err.message}`);
  }
}

function addNotification(db, type, title, message, link) {
  // Avoid duplicate notifications within the last hour
  const recent = db.prepare(
    "SELECT id FROM notifications WHERE type = ? AND title = ? AND created_at > datetime('now', '-1 hour')"
  ).get(type, title);
  if (!recent) {
    db.prepare('INSERT INTO notifications (type, title, message, link) VALUES (?, ?, ?, ?)').run(type, title, message, link);
  }
}

function checkMaintenanceWebhooks(db) {
  const overdue = db.prepare(`
    SELECT ms.*, c.name as component_name, c.category, r.name as rig_name, r.id as rig_id
    FROM maintenance_schedules ms
    JOIN components c ON ms.component_id = c.id
    JOIN rigs r ON c.rig_id = r.id
    WHERE ms.next_due IS NOT NULL AND ms.next_due < datetime('now')
  `).all();

  for (const item of overdue) {
    // Generate notification
    addNotification(db, 'maintenance',
      `Maintenance overdue: ${item.task_name}`,
      `${item.component_name} (${item.category}) in ${item.rig_name}`,
      '/hardware'
    );
    // Fire webhook if configured
    if (item.webhook_url) {
      fireWebhook(item.webhook_url, {
        event: 'maintenance_overdue',
        task: item.task_name,
        component: item.component_name,
        category: item.category,
        rig: item.rig_name,
        due: item.next_due,
        interval_days: item.interval_days
      });
    }
    // Push to Telegram
    try {
      const { sendTelegramMessage } = require('./telegramBot');
      sendTelegramMessage(db, `🔧 *Maintenance Overdue:* ${item.task_name}\n${item.component_name} (${item.category}) in ${item.rig_name}`);
    } catch {}
  }

  // Check warranty expirations (within 30 days)
  const expiringWarranties = db.prepare(`
    SELECT c.name, c.category, c.warranty_expires, r.name as rig_name
    FROM components c JOIN rigs r ON c.rig_id = r.id
    WHERE c.warranty_expires IS NOT NULL
      AND c.warranty_expires > date('now')
      AND c.warranty_expires <= date('now', '+30 days')
  `).all();

  for (const item of expiringWarranties) {
    addNotification(db, 'warranty',
      `Warranty expiring: ${item.name}`,
      `${item.category} in ${item.rig_name} expires ${item.warranty_expires}`,
      '/hardware'
    );
  }
}

function startHealthChecker(db, broadcast = () => {}) {
  // Check services every minute
  cron.schedule('* * * * *', async () => {
    const services = db.prepare('SELECT * FROM services WHERE is_enabled = 1').all();

    for (const service of services) {
      const prevStatus = service.status;
      const { status, responseTime } = await checkService(service.url);
      db.prepare(
        'UPDATE services SET status = ?, last_response_ms = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(status, responseTime, service.id);

      db.prepare(
        'INSERT INTO service_checks (service_id, status, response_ms) VALUES (?, ?, ?)'
      ).run(service.id, status, responseTime);

      // Broadcast status update via SSE
      if (status !== prevStatus) {
        broadcast('service_status', { id: service.id, name: service.name, status, responseTime });
      }

      // Notify on status change to offline
      if (status === 'offline' && prevStatus !== 'offline') {
        addNotification(db, 'service',
          `Service down: ${service.name}`,
          `${service.url} is not responding`,
          '/settings'
        );
        broadcast('notification', { type: 'service', title: `Service down: ${service.name}` });
        // Push to Telegram if configured
        try {
          const { sendTelegramMessage } = require('./telegramBot');
          sendTelegramMessage(db, `🔴 *Service Down:* ${service.name}\n${service.url} is not responding`);
        } catch {}
      }
      // Notify on recovery
      if (status === 'online' && prevStatus === 'offline') {
        try {
          const { sendTelegramMessage } = require('./telegramBot');
          sendTelegramMessage(db, `🟢 *Service Recovered:* ${service.name}\nResponse: ${responseTime}ms`);
        } catch {}
      }
    }

    // Prune old checks (keep 30 days for uptime history)
    db.prepare("DELETE FROM service_checks WHERE checked_at < datetime('now', '-30 days')").run();
    // Prune old read notifications (keep 30 days)
    db.prepare("DELETE FROM notifications WHERE is_read = 1 AND created_at < datetime('now', '-30 days')").run();
  });

  // Check maintenance + warranties every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    checkMaintenanceWebhooks(db);
  });

  // AI Heartbeat (configurable interval, default 60 min)
  cron.schedule('*/15 * * * *', async () => {
    try {
      const heartbeatEnabled = db.prepare("SELECT value FROM settings WHERE key = 'ai_heartbeat'").get()?.value;
      if (heartbeatEnabled !== 'true') return;

      const interval = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'ai_heartbeat_interval'").get()?.value || '60');
      const lastRun = db.prepare("SELECT value FROM settings WHERE key = 'ai_heartbeat_last_run'").get()?.value;
      const now = Date.now();
      if (lastRun && now - parseInt(lastRun) < interval * 60 * 1000) return;

      const { runHeartbeat } = require('../routes/ai');
      await runHeartbeat(db);

      db.prepare("INSERT INTO settings (key, value) VALUES ('ai_heartbeat_last_run', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(String(now));
    } catch (err) {
      console.error('AI heartbeat cron error:', err.message);
    }
  });

  // Auto-backup daily at 2am
  cron.schedule('0 2 * * *', () => {
    const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().slice(0, 10);
    const backupPath = path.join(backupDir, `rigboard-${timestamp}.db`);

    try {
      const dbPath = path.join(DATA_DIR, 'rigboard.db');
      db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(dbPath, backupPath);
      console.log(`Auto-backup created: ${backupPath}`);
      // Keep only last 7 backups
      const files = fs.readdirSync(backupDir).filter(f => f.startsWith('rigboard-')).sort().reverse();
      for (const f of files.slice(7)) {
        fs.unlinkSync(path.join(backupDir, f));
      }
    } catch (err) {
      console.error(`Auto-backup failed: ${err.message}`);
    }
  });

  // Run an initial service check on startup
  setTimeout(async () => {
    const services = db.prepare('SELECT * FROM services WHERE is_enabled = 1').all();
    for (const service of services) {
      const { status, responseTime } = await checkService(service.url);
      db.prepare(
        'UPDATE services SET status = ?, last_response_ms = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(status, responseTime, service.id);
      db.prepare(
        'INSERT INTO service_checks (service_id, status, response_ms) VALUES (?, ?, ?)'
      ).run(service.id, status, responseTime);
    }
  }, 5000);

  console.log('Health checker started');
}

module.exports = { checkService, startHealthChecker };
