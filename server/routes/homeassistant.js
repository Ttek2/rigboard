const express = require('express');
const router = express.Router();

// GET /api/v1/homeassistant/entities — proxy to HA API
router.get('/entities', async (req, res) => {
  const db = req.app.locals.db;
  const haUrl = db.prepare("SELECT value FROM settings WHERE key = 'ha_url'").get()?.value;
  const haToken = db.prepare("SELECT value FROM settings WHERE key = 'ha_token'").get()?.value;

  if (!haUrl || !haToken) {
    return res.json({ error: 'Home Assistant not configured. Set ha_url and ha_token in settings.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${haUrl}/api/states`, {
      headers: { Authorization: `Bearer ${haToken}` },
      signal: controller.signal
    });
    clearTimeout(timeout);
    const states = await response.json();

    // Return a simplified list
    const entities = states.map(s => ({
      entity_id: s.entity_id,
      state: s.state,
      name: s.attributes?.friendly_name || s.entity_id,
      unit: s.attributes?.unit_of_measurement || '',
      icon: s.attributes?.icon || '',
      last_changed: s.last_changed
    }));

    res.json(entities);
  } catch (err) {
    res.status(502).json({ error: `Cannot reach Home Assistant: ${err.message}` });
  }
});

// GET /api/v1/homeassistant/entity/:id
router.get('/entity/:id', async (req, res) => {
  const db = req.app.locals.db;
  const haUrl = db.prepare("SELECT value FROM settings WHERE key = 'ha_url'").get()?.value;
  const haToken = db.prepare("SELECT value FROM settings WHERE key = 'ha_token'").get()?.value;

  if (!haUrl || !haToken) return res.json({ error: 'Not configured' });

  try {
    const response = await fetch(`${haUrl}/api/states/${req.params.id}`, {
      headers: { Authorization: `Bearer ${haToken}` },
      signal: AbortSignal.timeout(5000)
    });
    const state = await response.json();
    res.json({
      entity_id: state.entity_id,
      state: state.state,
      name: state.attributes?.friendly_name || state.entity_id,
      unit: state.attributes?.unit_of_measurement || '',
      attributes: state.attributes,
      last_changed: state.last_changed
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
