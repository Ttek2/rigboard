const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Configure multer for component image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(req.app.locals.DATA_DIR, 'uploads', 'components');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `comp-${req.params.id}-${Date.now()}${ext}`);
  }
});
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ALLOWED_IMAGE_EXTS.includes(ext));
};
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFileFilter });

// PUT /api/v1/components/:id
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT * FROM components WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Component not found' });

  const fields = ['parent_component_id', 'category', 'name', 'model', 'serial_number', 'purchase_date', 'purchase_price', 'currency', 'warranty_expires', 'notes', 'sort_order'];
  const updates = {};
  for (const field of fields) {
    updates[field] = req.body[field] !== undefined ? req.body[field] : existing[field];
  }

  db.prepare(`
    UPDATE components SET parent_component_id = ?, category = ?, name = ?, model = ?, serial_number = ?,
    purchase_date = ?, purchase_price = ?, currency = ?, warranty_expires = ?, notes = ?, sort_order = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(
    updates.parent_component_id, updates.category, updates.name, updates.model, updates.serial_number,
    updates.purchase_date, updates.purchase_price, updates.currency, updates.warranty_expires,
    updates.notes, updates.sort_order, req.params.id
  );

  const component = db.prepare('SELECT * FROM components WHERE id = ?').get(req.params.id);
  res.json(component);
});

// DELETE /api/v1/components/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM components WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/v1/components/:id/maintenance
router.post('/:id/maintenance', (req, res) => {
  const db = req.app.locals.db;
  const { action, notes, performed_at } = req.body;
  const result = db.prepare(
    'INSERT INTO maintenance_logs (component_id, action, notes, performed_at) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, action, notes || null, performed_at || new Date().toISOString());

  const schedules = db.prepare('SELECT * FROM maintenance_schedules WHERE component_id = ?').all(req.params.id);
  for (const schedule of schedules) {
    if (action.toLowerCase().includes(schedule.task_name.toLowerCase())) {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + schedule.interval_days);
      db.prepare('UPDATE maintenance_schedules SET last_performed = CURRENT_TIMESTAMP, next_due = ? WHERE id = ?')
        .run(nextDue.toISOString(), schedule.id);
    }
  }

  const log = db.prepare('SELECT * FROM maintenance_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(log);
});

// GET /api/v1/components/:id/maintenance
router.get('/:id/maintenance', (req, res) => {
  const db = req.app.locals.db;
  const logs = db.prepare(
    'SELECT * FROM maintenance_logs WHERE component_id = ? ORDER BY performed_at DESC'
  ).all(req.params.id);
  res.json(logs);
});

// POST /api/v1/components/:id/schedule
router.post('/:id/schedule', (req, res) => {
  const db = req.app.locals.db;
  const { task_name, interval_days, webhook_url } = req.body;
  const next_due = new Date();
  next_due.setDate(next_due.getDate() + interval_days);

  const result = db.prepare(
    'INSERT INTO maintenance_schedules (component_id, task_name, interval_days, next_due, webhook_url) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, task_name, interval_days, next_due.toISOString(), webhook_url || null);

  const schedule = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(schedule);
});

// POST /api/v1/components/:id/images — upload component image
router.post('/:id/images', upload.single('image'), (req, res) => {
  const db = req.app.locals.db;
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  const imagePath = `/uploads/components/${req.file.filename}`;
  const result = db.prepare(
    'INSERT INTO component_images (component_id, image_path, caption) VALUES (?, ?, ?)'
  ).run(req.params.id, imagePath, req.body.caption || null);
  const image = db.prepare('SELECT * FROM component_images WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(image);
});

// GET /api/v1/components/:id/images — list component images
router.get('/:id/images', (req, res) => {
  const db = req.app.locals.db;
  const images = db.prepare('SELECT * FROM component_images WHERE component_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(images);
});

// DELETE /api/v1/components/images/:imageId
router.delete('/images/:imageId', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM component_images WHERE id = ?').run(req.params.imageId);
  res.json({ success: true });
});

module.exports = router;
