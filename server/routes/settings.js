const express = require('express');
const router = express.Router();

// GET /api/v1/settings
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

// PUT /api/v1/settings
router.put('/', (req, res) => {
  const db = req.app.locals.db;
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const transaction = db.transaction((settings) => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value));
    }
  });
  transaction(req.body);
  res.json({ success: true });
});

// POST /api/v1/settings/export
router.post('/export', (req, res) => {
  const db = req.app.locals.db;
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const bookmarks = db.prepare('SELECT * FROM bookmarks').all();
  const feeds = db.prepare('SELECT * FROM feeds').all();
  const widgets = db.prepare('SELECT * FROM widget_layout').all();
  const services = db.prepare('SELECT * FROM services').all();
  const rigs = db.prepare('SELECT * FROM rigs').all();
  res.json({ settings, bookmarks, feeds, widgets, services, rigs });
});

// POST /api/v1/settings/import
router.post('/import', (req, res) => {
  const db = req.app.locals.db;
  const { settings, bookmarks, feeds, widgets } = req.body;

  const transaction = db.transaction(() => {
    if (settings) {
      const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      for (const s of settings) {
        upsert.run(s.key, s.value);
      }
    }
    if (bookmarks) {
      db.prepare('DELETE FROM bookmarks').run();
      const insert = db.prepare('INSERT INTO bookmarks (name, url, icon, group_name, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (const b of bookmarks) {
        insert.run(b.name, b.url, b.icon, b.group_name, b.sort_order);
      }
    }
    if (feeds) {
      db.prepare('DELETE FROM feed_items').run();
      db.prepare('DELETE FROM feeds').run();
      const insert = db.prepare('INSERT INTO feeds (url, title, site_url, favicon_url, group_name, refresh_interval_minutes, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const f of feeds) {
        insert.run(f.url, f.title, f.site_url, f.favicon_url, f.group_name, f.refresh_interval_minutes, f.is_enabled);
      }
    }
    if (widgets) {
      db.prepare('DELETE FROM widget_layout').run();
      const insert = db.prepare('INSERT INTO widget_layout (widget_type, widget_config, grid_x, grid_y, grid_w, grid_h, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const w of widgets) {
        insert.run(w.widget_type, w.widget_config, w.grid_x, w.grid_y, w.grid_w, w.grid_h, w.is_visible);
      }
    }
  });

  transaction();
  res.json({ success: true });
});

// POST /api/v1/settings/wallpaper — upload wallpaper file
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const wallpaperStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(req.app.locals.DATA_DIR, 'uploads', 'wallpapers');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `wallpaper-${Date.now()}${ext}`);
  }
});
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.heic', '.heif', '.tiff', '.tif'];
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ALLOWED_IMAGE_EXTS.includes(ext));
};
const wallpaperUpload = multer({ storage: wallpaperStorage, limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: imageFileFilter });

router.post('/wallpaper', wallpaperUpload.single('wallpaper'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/wallpapers/${req.file.filename}`;
  const db = req.app.locals.db;
  db.prepare("INSERT INTO settings (key, value) VALUES ('wallpaper_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(url);
  res.json({ ok: true, url });
});

module.exports = router;
