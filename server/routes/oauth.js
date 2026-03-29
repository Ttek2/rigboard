const express = require('express');
const crypto = require('crypto');
const router = express.Router();

function generateId(prefix, len = 16) {
  return `${prefix}_${crypto.randomBytes(len).toString('hex')}`;
}

// Build rig summary from dashboard components
function getRigSummary(db) {
  const rigs = db.prepare('SELECT id, name FROM rigs LIMIT 1').all();
  if (rigs.length === 0) return { summary: '', badge: '' };
  const components = db.prepare(`
    SELECT name, category FROM components WHERE rig_id = ? ORDER BY
    CASE category WHEN 'GPU' THEN 1 WHEN 'CPU' THEN 2 WHEN 'RAM' THEN 3 ELSE 10 END
  `).all(rigs[0].id);
  const gpu = components.find(c => c.category === 'GPU');
  const cpu = components.find(c => c.category === 'CPU');
  const ram = components.find(c => c.category === 'RAM');
  const summary = [gpu?.name, cpu?.name, ram?.name].filter(Boolean).join(' / ');
  const badge = gpu?.name?.match(/(RTX\s*\d+|RX\s*\d+|Arc\s*\w+)/i)?.[1] || '';
  return { summary, badge };
}

// === SITE KEY REGISTRATION (admin) ===

router.post('/sites', (req, res) => {
  const db = req.app.locals.db;

  const { name, url, webhook_url } = req.body;
  if (!name || !url) return res.status(422).json({ ok: false, error: 'name and url required', code: 'VALIDATION_ERROR' });

  const siteKey = `sk_${name.toLowerCase().replace(/\W/g, '')}_${crypto.randomBytes(8).toString('hex')}`;
  const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

  // Store in settings
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`site_${siteKey}_name`, name);
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`site_${siteKey}_url`, url);
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`site_${siteKey}_webhook_url`, webhook_url || '');
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`site_${siteKey}_webhook_secret`, webhookSecret);
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run('community_site_key', siteKey);
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run('community_webhook_url', webhook_url || '');
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run('community_webhook_secret', webhookSecret);

  res.status(201).json({ ok: true, site_key: siteKey, webhook_secret: webhookSecret });
});

// === COMMUNITY TOKEN (user opt-in) ===

router.get('/token', (req, res) => {
  const db = req.app.locals.db;
  const { site_key } = req.query;

  // Verify site key exists
  const siteName = db.prepare("SELECT value FROM settings WHERE key = ?").get(`site_${site_key}_name`);
  if (!siteName) return res.json({ ok: false, error: 'Invalid site key' });

  // Check user has opted in for this site
  const optedIn = db.prepare("SELECT value FROM settings WHERE key = 'community_opted_in'").get();
  if (!optedIn || optedIn.value !== 'true') {
    return res.json({ ok: false, error: 'Community not enabled for this site' });
  }

  // Generate or retrieve token
  let token = db.prepare("SELECT value FROM settings WHERE key = 'community_token'").get()?.value;
  if (!token) {
    token = `rb_community_${crypto.randomBytes(32).toString('hex')}`;
    db.prepare("INSERT INTO settings (key, value) VALUES ('community_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(token);
  }

  const rig = getRigSummary(db);
  const displayName = db.prepare("SELECT value FROM settings WHERE key = 'community_display_name'").get()?.value || 'RigBoard User';
  const avatarColor = db.prepare("SELECT value FROM settings WHERE key = 'community_avatar_color'").get()?.value || '#3b82f6';

  res.json({
    ok: true,
    token,
    user: {
      id: 'user_' + crypto.createHash('md5').update(token).digest('hex').slice(0, 16),
      display_name: displayName,
      avatar_url: null,
      avatar_color: avatarColor,
      rig_summary: rig.summary,
      rig_badge: rig.badge
    }
  });
});

// === TOGGLE OPT-IN ===

router.post('/toggle', (req, res) => {
  const db = req.app.locals.db;

  const { enabled, display_name } = req.body;
  db.prepare("INSERT INTO settings (key, value) VALUES ('community_opted_in', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(enabled ? 'true' : 'false');

  if (display_name) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('community_display_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(display_name);
  }

  if (!enabled) {
    // Revoke token on disconnect
    db.prepare("DELETE FROM settings WHERE key = 'community_token'").run();
  }

  res.json({ ok: true, enabled: !!enabled });
});

// === RESOLVE COMMUNITY TOKEN (for community.js) ===

function resolveToken(db, authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // Check community token
  const storedToken = db.prepare("SELECT value FROM settings WHERE key = 'community_token'").get();
  if (!storedToken || storedToken.value !== token) return null;

  const displayName = db.prepare("SELECT value FROM settings WHERE key = 'community_display_name'").get()?.value || 'RigBoard User';
  const avatarColor = db.prepare("SELECT value FROM settings WHERE key = 'community_avatar_color'").get()?.value || '#3b82f6';
  const rig = getRigSummary(db);

  return {
    id: 'user_' + crypto.createHash('md5').update(token).digest('hex').slice(0, 16),
    display_name: displayName,
    avatar_url: null,
    avatar_color: avatarColor,
    rig_summary: rig.summary,
    rig_badge: rig.badge,
    karma: 0,
    is_admin: false,
    created_at: new Date().toISOString()
  };
}

router.resolveToken = resolveToken;
router.getRigSummary = getRigSummary;

module.exports = router;
