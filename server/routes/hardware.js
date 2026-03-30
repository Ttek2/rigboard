const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(req.app.locals.DATA_DIR, 'uploads', 'rigs');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `rig-${Date.now()}${ext}`);
  }
});
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, ALLOWED_IMAGE_EXTS.includes(ext));
};
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFileFilter });

// GET /api/v1/rigs
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const rigs = db.prepare('SELECT * FROM rigs ORDER BY sort_order, created_at DESC').all();

  // Attach component counts and next maintenance
  const rigData = rigs.map(rig => {
    const componentCount = db.prepare('SELECT COUNT(*) as count FROM components WHERE rig_id = ?').get(rig.id).count;
    const nextMaintenance = db.prepare(`
      SELECT ms.*, c.name as component_name
      FROM maintenance_schedules ms
      JOIN components c ON ms.component_id = c.id
      WHERE c.rig_id = ? AND ms.next_due IS NOT NULL
      ORDER BY ms.next_due ASC LIMIT 1
    `).get(rig.id);
    const overdueCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM maintenance_schedules ms
      JOIN components c ON ms.component_id = c.id
      WHERE c.rig_id = ? AND ms.next_due < datetime('now')
    `).get(rig.id).count;

    // Key components for summary display
    const gpu = db.prepare("SELECT name, model FROM components WHERE rig_id = ? AND category = 'GPU' LIMIT 1").get(rig.id);
    const cpu = db.prepare("SELECT name, model FROM components WHERE rig_id = ? AND category = 'CPU' LIMIT 1").get(rig.id);
    const ram = db.prepare("SELECT name, model FROM components WHERE rig_id = ? AND category = 'RAM' LIMIT 1").get(rig.id);
    const totalCost = db.prepare('SELECT SUM(purchase_price) as total FROM components WHERE rig_id = ?').get(rig.id).total || 0;
    const currency = db.prepare('SELECT currency FROM components WHERE rig_id = ? AND purchase_price IS NOT NULL LIMIT 1').get(rig.id)?.currency || 'EUR';

    // Warranty alerts
    const expiringWarranties = db.prepare(`
      SELECT COUNT(*) as count FROM components WHERE rig_id = ?
      AND warranty_expires IS NOT NULL AND warranty_expires > date('now') AND warranty_expires <= date('now', '+30 days')
    `).get(rig.id).count;

    return {
      ...rig,
      component_count: componentCount,
      next_maintenance: nextMaintenance,
      overdue_count: overdueCount,
      gpu: gpu ? (gpu.model ? `${gpu.name} ${gpu.model}` : gpu.name) : null,
      cpu: cpu ? (cpu.model ? `${cpu.name} ${cpu.model}` : cpu.name) : null,
      ram: ram ? (ram.model ? `${ram.name} ${ram.model}` : ram.name) : null,
      total_cost: totalCost,
      currency,
      expiring_warranties: expiringWarranties,
    };
  });

  res.json(rigData);
});

// POST /api/v1/rigs
router.post('/', upload.single('image'), (req, res) => {
  const db = req.app.locals.db;
  const { name, description, sort_order } = req.body;
  const image_path = req.file ? `/uploads/rigs/${req.file.filename}` : null;
  const result = db.prepare(
    'INSERT INTO rigs (name, description, image_path, sort_order) VALUES (?, ?, ?, ?)'
  ).run(name, description || null, image_path, sort_order || 0);
  const rig = db.prepare('SELECT * FROM rigs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(rig);
});

// GET /api/v1/rigs/:id
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const rig = db.prepare('SELECT * FROM rigs WHERE id = ?').get(req.params.id);
  if (!rig) return res.status(404).json({ error: 'Rig not found' });

  const components = db.prepare(
    'SELECT * FROM components WHERE rig_id = ? ORDER BY sort_order, created_at'
  ).all(rig.id);

  // Attach maintenance info to each component
  const componentsWithMaintenance = components.map(c => {
    const schedules = db.prepare('SELECT * FROM maintenance_schedules WHERE component_id = ?').all(c.id);
    const logs = db.prepare('SELECT * FROM maintenance_logs WHERE component_id = ? ORDER BY performed_at DESC LIMIT 5').all(c.id);
    return { ...c, schedules, recent_logs: logs };
  });

  const totalCost = db.prepare('SELECT SUM(purchase_price) as total FROM components WHERE rig_id = ?').get(rig.id).total || 0;

  res.json({ ...rig, components: componentsWithMaintenance, total_cost: totalCost });
});

// PUT /api/v1/rigs/:id
router.put('/:id', upload.single('image'), (req, res) => {
  const db = req.app.locals.db;
  const { name, description, sort_order } = req.body;
  const existing = db.prepare('SELECT * FROM rigs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Rig not found' });

  const image_path = req.file ? `/uploads/rigs/${req.file.filename}` : existing.image_path;
  db.prepare(
    'UPDATE rigs SET name = ?, description = ?, image_path = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name || existing.name, description !== undefined ? description : existing.description, image_path, sort_order || existing.sort_order, req.params.id);

  const rig = db.prepare('SELECT * FROM rigs WHERE id = ?').get(req.params.id);
  res.json(rig);
});

// DELETE /api/v1/rigs/:id
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM rigs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/v1/rigs/:id/components
router.get('/:id/components', (req, res) => {
  const db = req.app.locals.db;
  const components = db.prepare(
    'SELECT * FROM components WHERE rig_id = ? ORDER BY sort_order, created_at'
  ).all(req.params.id);
  res.json(components);
});

// POST /api/v1/rigs/:id/components
router.post('/:id/components', (req, res) => {
  const db = req.app.locals.db;
  const { parent_component_id, category, name, model, serial_number, purchase_date, purchase_price, currency, warranty_expires, notes, sort_order } = req.body;
  const result = db.prepare(
    'INSERT INTO components (rig_id, parent_component_id, category, name, model, serial_number, purchase_date, purchase_price, currency, warranty_expires, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, parent_component_id || null, category, name, model || null, serial_number || null, purchase_date || null, purchase_price || null, currency || 'EUR', warranty_expires || null, notes || null, sort_order || 0);
  const component = db.prepare('SELECT * FROM components WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(component);
});

// POST /api/v1/rigs/:id/import — bulk import components from JSON/CSV
router.post('/:id/import', (req, res) => {
  const db = req.app.locals.db;
  const { components } = req.body;
  if (!Array.isArray(components)) return res.status(400).json({ error: 'Expected { components: [...] }' });

  const insert = db.prepare(
    'INSERT INTO components (rig_id, parent_component_id, category, name, model, serial_number, purchase_date, purchase_price, currency, warranty_expires, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const imported = db.transaction(() => {
    let count = 0;
    for (const c of components) {
      if (!c.category || !c.name) continue;
      insert.run(
        req.params.id, c.parent_component_id || null, c.category, c.name,
        c.model || null, c.serial_number || null, c.purchase_date || null,
        c.purchase_price || null, c.currency || 'EUR', c.warranty_expires || null,
        c.notes || null, c.sort_order || 0
      );
      count++;
    }
    return count;
  })();

  res.json({ success: true, imported });
});

module.exports = router;
