const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const dbPath = path.join(DATA_DIR, 'rigboard.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema);

// Migrations
try { db.exec('ALTER TABLE widget_layout ADD COLUMN tab_id INTEGER REFERENCES dashboard_tabs(id) ON DELETE CASCADE'); } catch (e) {}
try { db.exec('ALTER TABLE community_comments ADD COLUMN topic_context TEXT'); } catch (e) {}

// Insert default settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get();
if (settingsCount.count === 0) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const defaults = {
    theme: 'dark',
    dashboard_title: 'RigBoard',
    accent_color: '#06b6d4',
    setup_complete: 'false',
    auth_enabled: 'false'
  };
  for (const [key, value] of Object.entries(defaults)) {
    insertSetting.run(key, value);
  }
}

// Make db available to routes
app.locals.db = db;
app.locals.DATA_DIR = DATA_DIR;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: '5mb' }));

// Session for auth (SQLite-backed, no memory leak)
const SqliteStore = require('better-sqlite3-session-store')(session);
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 900000 } }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// Auth middleware — protects all /api/v1 routes except auth endpoints
function authMiddleware(req, res, next) {
  const authEnabled = db.prepare("SELECT value FROM settings WHERE key = 'auth_enabled'").get();
  if (!authEnabled || authEnabled.value !== 'true') return next();

  // Allow auth routes, health check, shared rigs, webhook receiver, and prometheus metrics
  const publicPaths = ['/api/v1/auth', '/api/health', '/api/v1/share/', '/api/v1/webhooks/incoming', '/metrics', '/api/v1/oauth', '/api/v1/community', '/api/v1/me'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  if (req.session?.authenticated) return next();
  res.status(401).json({ error: 'Authentication required' });
}

// Auth routes (before middleware)
const { TOTP, Secret } = require('otpauth');
const QRCode = require('qrcode');

app.post('/api/v1/auth/login', (req, res) => {
  const { password, totp_code } = req.body;
  const stored = db.prepare("SELECT value FROM settings WHERE key = 'auth_password'").get();
  if (!stored) return res.status(400).json({ error: 'No password set' });

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  if (hash !== stored.value) return res.status(401).json({ error: 'Invalid password' });

  // Check TOTP if enabled
  const totpEnabled = db.prepare("SELECT value FROM settings WHERE key = 'totp_enabled'").get()?.value === 'true';
  if (totpEnabled) {
    if (!totp_code) return res.json({ success: false, totp_required: true });
    const secret = db.prepare("SELECT value FROM settings WHERE key = 'totp_secret'").get()?.value;
    if (secret) {
      const totp = new TOTP({ secret: Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 });
      const valid = totp.validate({ token: totp_code, window: 1 }) !== null;
      if (!valid) return res.status(401).json({ error: 'Invalid 2FA code' });
    }
  }

  req.session.authenticated = true;
  res.json({ success: true });
});

app.post('/api/v1/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/v1/auth/status', (req, res) => {
  const authEnabled = db.prepare("SELECT value FROM settings WHERE key = 'auth_enabled'").get();
  const totpEnabled = db.prepare("SELECT value FROM settings WHERE key = 'totp_enabled'").get();
  const enabled = authEnabled?.value === 'true';
  res.json({
    auth_enabled: enabled,
    totp_enabled: totpEnabled?.value === 'true',
    authenticated: !enabled || !!req.session?.authenticated
  });
});

app.post('/api/v1/auth/setup', (req, res) => {
  const { password, enable } = req.body;
  if (password) {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    db.prepare("INSERT INTO settings (key, value) VALUES ('auth_password', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(hash);
  }
  db.prepare("INSERT INTO settings (key, value) VALUES ('auth_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(enable ? 'true' : 'false');
  if (enable) req.session.authenticated = true;
  res.json({ success: true });
});

// TOTP setup — generate secret and QR code
app.post('/api/v1/auth/totp/setup', async (req, res) => {
  const secret = new Secret();
  const totp = new TOTP({
    issuer: 'RigBoard',
    label: db.prepare("SELECT value FROM settings WHERE key = 'dashboard_title'").get()?.value || 'RigBoard',
    algorithm: 'SHA1', digits: 6, period: 30, secret
  });
  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri);

  // Store secret temporarily (not enabled yet until verified)
  db.prepare("INSERT INTO settings (key, value) VALUES ('totp_secret_pending', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(secret.base32);

  res.json({ secret: secret.base32, qr: qrDataUrl, uri });
});

// TOTP verify — confirm the code works, then enable
app.post('/api/v1/auth/totp/verify', (req, res) => {
  const { code } = req.body;
  const pendingSecret = db.prepare("SELECT value FROM settings WHERE key = 'totp_secret_pending'").get()?.value;
  if (!pendingSecret) return res.status(400).json({ error: 'No pending TOTP setup' });

  const totp = new TOTP({ secret: Secret.fromBase32(pendingSecret), algorithm: 'SHA1', digits: 6, period: 30 });
  const valid = totp.validate({ token: code, window: 1 }) !== null;

  if (!valid) return res.status(400).json({ error: 'Invalid code. Try again.' });

  // Code verified — enable TOTP
  db.prepare("INSERT INTO settings (key, value) VALUES ('totp_secret', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(pendingSecret);
  db.prepare("INSERT INTO settings (key, value) VALUES ('totp_enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
  db.prepare("DELETE FROM settings WHERE key = 'totp_secret_pending'").run();

  res.json({ success: true });
});

// TOTP disable
app.post('/api/v1/auth/totp/disable', (req, res) => {
  db.prepare("INSERT INTO settings (key, value) VALUES ('totp_enabled', 'false') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
  db.prepare("DELETE FROM settings WHERE key = 'totp_secret'").run();
  db.prepare("DELETE FROM settings WHERE key = 'totp_secret_pending'").run();
  res.json({ success: true });
});

// Apply auth middleware
app.use('/api/v1', authMiddleware);

// Prometheus metrics
const promClient = require('prom-client');
promClient.collectDefaultMetrics();
const httpRequests = new promClient.Counter({ name: 'rigboard_http_requests_total', help: 'Total HTTP requests', labelNames: ['method', 'path', 'status'] });
app.use((req, res, next) => {
  res.on('finish', () => { httpRequests.inc({ method: req.method, path: req.route?.path || req.path, status: res.statusCode }); });
  next();
});
app.get('/metrics', async (req, res) => {
  // Add custom metrics
  const feedCount = db.prepare('SELECT COUNT(*) as c FROM feeds').get().c;
  const rigCount = db.prepare('SELECT COUNT(*) as c FROM rigs').get().c;
  const serviceCount = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
  const customMetrics = `
# HELP rigboard_feeds_total Number of configured feeds
# TYPE rigboard_feeds_total gauge
rigboard_feeds_total ${feedCount}
# HELP rigboard_rigs_total Number of rigs
# TYPE rigboard_rigs_total gauge
rigboard_rigs_total ${rigCount}
# HELP rigboard_services_total Number of monitored services
# TYPE rigboard_services_total gauge
rigboard_services_total ${serviceCount}
`;
  res.setHeader('Content-Type', promClient.register.contentType);
  const defaultMetrics = await promClient.register.metrics();
  res.send(defaultMetrics + customMetrics);
});

// API routes
app.use('/api/v1/settings', require('./routes/settings'));
app.use('/api/v1/widgets', require('./routes/widgets'));
app.use('/api/v1/bookmarks', require('./routes/bookmarks'));
app.use('/api/v1/notes', require('./routes/notes'));
app.use('/api/v1/feeds', require('./routes/feeds'));
app.use('/api/v1/rigs', require('./routes/hardware'));
app.use('/api/v1/components', require('./routes/components'));
app.use('/api/v1/maintenance', require('./routes/maintenance'));
app.use('/api/v1/services', require('./routes/services'));
app.use('/api/v1/search', require('./routes/search'));
app.use('/api/v1/rigs', require('./routes/timeline'));
app.use('/api/v1/docker', require('./routes/docker'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/system', require('./routes/system'));
app.use('/api/v1/tabs', require('./routes/tabs'));
app.use('/api/v1/webhooks', require('./routes/webhooks'));
app.use('/api/v1/share', require('./routes/share'));
app.use('/api/v1/articles', require('./routes/articles'));
app.use('/api/v1/prices', require('./routes/prices'));
app.use('/api/v1/homeassistant', require('./routes/homeassistant'));

// Integration routes
app.use('/api/v1/integrations/jellyseerr', require('./routes/integrations/jellyseerr'));
app.use('/api/v1/integrations', require('./routes/integrations/starr'));
app.use('/api/v1/integrations', require('./routes/integrations/media'));
app.use('/api/v1/integrations/pihole', require('./routes/integrations/pihole'));
app.use('/api/v1/integrations', require('./routes/integrations/downloads'));
app.use('/api/v1/integrations/network', require('./routes/integrations/network'));
app.use('/api/v1/integrations/releases', require('./routes/integrations/releases'));
app.use('/api/v1/integrations/pulse', require('./routes/integrations/pulse'));
app.use('/api/v1/ai', require('./routes/ai'));
app.use('/api/v1/ai/actions', require('./routes/ai-actions'));
app.use('/api/v1/websearch', require('./routes/websearch'));

// Community (site key model, no OAuth)
app.use('/api/v1/community', require('./routes/oauth')); // token, toggle, sites
app.use('/api/v1/community', require('./routes/community')); // comments, discussions, profiles, moderation
const communityRouter = require('./routes/community');
app.get('/api/v1/me', (req, res, next) => { req.url = '/me'; communityRouter(req, res, next); });

// Server-Sent Events
const sseRouter = require('./routes/sse');
app.use('/api/v1/events', sseRouter);
app.locals.broadcast = sseRouter.broadcast;

// Swagger API docs
const swaggerDoc = require('./swagger.json');
const swaggerUi = require('swagger-ui-express');
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, { customCss: '.swagger-ui .topbar { display: none }' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React app in production
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^\/(?!api|metrics).*/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Start services
const { startFeedScheduler } = require('./services/feedParser');
const { startHealthChecker } = require('./services/healthChecker');

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`RigBoard server running on http://${HOST}:${PORT}`);
  console.log(`API docs at http://localhost:${PORT}/api/docs`);
  console.log(`Prometheus metrics at http://localhost:${PORT}/metrics`);
  startFeedScheduler(db);
  startHealthChecker(db, sseRouter.broadcast);
});

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
