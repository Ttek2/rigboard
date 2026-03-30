const express = require('express');
const router = express.Router();

// Risk levels: low = auto in semi mode, high = always confirm in semi mode
const ACTIONS = {
  add_bookmark: {
    label: 'Add Bookmark',
    risk: 'low',
    params: ['name', 'url'],
    execute: (db, params) => {
      db.prepare('INSERT INTO bookmarks (name, url) VALUES (?, ?)').run(params.name, params.url.startsWith('http') ? params.url : `https://${params.url}`);
      return { success: true, message: `Bookmark "${params.name}" added.` };
    }
  },
  create_note: {
    label: 'Create Note',
    params: ['title', 'content'],
    execute: (db, params) => {
      db.prepare('INSERT INTO notes (title, content) VALUES (?, ?)').run(params.title, params.content || '');
      return { success: true, message: `Note "${params.title}" created.` };
    }
  },
  add_maintenance: {
    label: 'Schedule Maintenance',
    params: ['component_id', 'task_name', 'interval_days'],
    execute: (db, params) => {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + parseInt(params.interval_days));
      db.prepare('INSERT INTO maintenance_schedules (component_id, task_name, interval_days, next_due) VALUES (?, ?, ?, ?)')
        .run(params.component_id, params.task_name, params.interval_days, nextDue.toISOString());
      return { success: true, message: `Maintenance "${params.task_name}" scheduled every ${params.interval_days} days.` };
    }
  },
  log_maintenance: {
    label: 'Log Maintenance',
    params: ['component_id', 'action'],
    execute: (db, params) => {
      db.prepare('INSERT INTO maintenance_logs (component_id, action) VALUES (?, ?)').run(params.component_id, params.action);
      return { success: true, message: `Logged: "${params.action}"` };
    }
  },
  add_service: {
    label: 'Add Monitored Service',
    risk: 'medium',
    params: ['name', 'url'],
    execute: (db, params) => {
      db.prepare('INSERT INTO services (name, url) VALUES (?, ?)').run(params.name, params.url);
      return { success: true, message: `Service "${params.name}" added for monitoring.` };
    }
  },
  add_feed: {
    label: 'Subscribe to Feed',
    risk: 'low',
    params: ['url', 'group_name'],
    execute: (db, params) => {
      db.prepare('INSERT OR IGNORE INTO feeds (url, title, group_name) VALUES (?, ?, ?)').run(params.url, params.url, params.group_name || 'Uncategorized');
      return { success: true, message: `Feed subscribed: ${params.url}` };
    }
  },
  docker_action: {
    label: 'Docker Container Action',
    risk: 'high',
    params: ['container', 'action'],
    execute: (db, params) => {
      if (!['start', 'stop', 'restart'].includes(params.action)) return { success: false, message: 'Invalid action.' };
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,127}$/.test(params.container)) return { success: false, message: 'Invalid container name.' };
      try {
        const { execFileSync } = require('child_process');
        execFileSync('docker', [params.action, params.container], { timeout: 30000 });
        return { success: true, message: `Container "${params.container}" ${params.action}ed.` };
      } catch (e) { return { success: false, message: `Docker error: ${e.message}` }; }
    }
  },
  toggle_pihole: {
    label: 'Toggle Pi-hole',
    params: ['enable'],
    execute: async (db, params) => {
      const url = db.prepare("SELECT value FROM settings WHERE key = 'pihole_url'").get()?.value;
      const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'pihole_api_key'").get()?.value;
      if (!url || !apiKey) return { success: false, message: 'Pi-hole not configured.' };
      const action = params.enable === 'true' || params.enable === true ? 'enable' : 'disable';
      try {
        await fetch(`${url}/admin/api.php?${action}&auth=${apiKey}`, { signal: AbortSignal.timeout(5000) });
        return { success: true, message: `Pi-hole ${action}d.` };
      } catch (e) { return { success: false, message: e.message }; }
    }
  },
  update_setting: {
    label: 'Update Setting',
    params: ['key', 'value'],
    execute: (db, params) => {
      const safe = ['dashboard_title', 'theme', 'visual_styles', 'weather_city', 'accent_color'];
      if (!safe.includes(params.key)) return { success: false, message: `Cannot modify "${params.key}" via AI.` };
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(params.key, params.value);
      return { success: true, message: `Setting "${params.key}" updated to "${params.value}".` };
    }
  },
  save_memory: {
    label: 'Save to Memory',
    params: ['key', 'value'],
    execute: (db, params) => {
      db.prepare('INSERT INTO ai_memory (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
        .run(params.key, params.value);
      return { success: true, message: `Remembered: ${params.key} = ${params.value}` };
    }
  },
  create_backup: {
    label: 'Create Backup',
    params: [],
    execute: (db, params) => {
      const path = require('path');
      const fs = require('fs');
      const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
      const backupDir = path.join(DATA_DIR, 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `rigboard-${timestamp}.db`);
      db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(path.join(DATA_DIR, 'rigboard.db'), backupPath);
      return { success: true, message: `Backup created: ${backupPath}` };
    }
  },
  web_search: {
    label: 'Web Search',
    risk: 'low',
    params: ['query'],
    execute: async (db, params) => {
      const searchProvider = db.prepare("SELECT value FROM settings WHERE key = 'search_provider'").get()?.value || 'duckduckgo';

      let results;
      if (searchProvider === 'brave') {
        const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'brave_search_api_key'").get()?.value;
        if (!apiKey) return { success: false, message: 'Brave API key not configured' };
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(params.query)}&count=5`, {
          headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        results = (data.web?.results || []).map(r => `${r.title}: ${r.description} (${r.url})`).join('\n');
      } else if (searchProvider === 'searxng') {
        const url = db.prepare("SELECT value FROM settings WHERE key = 'searxng_url'").get()?.value;
        if (!url) return { success: false, message: 'SearXNG URL not configured' };
        const res = await fetch(`${url.replace(/\/$/, '')}/search?q=${encodeURIComponent(params.query)}&format=json&categories=general`, {
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        results = (data.results || []).slice(0, 5).map(r => `${r.title}: ${r.content} (${r.url})`).join('\n');
      } else {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1`, {
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        const items = [];
        if (data.AbstractText) items.push(`${data.Heading}: ${data.AbstractText} (${data.AbstractURL})`);
        for (const r of (data.RelatedTopics || []).slice(0, 4)) {
          if (r.Text) items.push(`${r.Text} (${r.FirstURL})`);
        }
        results = items.join('\n') || 'No results found.';
      }

      return { success: true, message: `Search results for "${params.query}":\n${results}` };
    }
  },
};

// POST /api/v1/ai/actions/execute — execute a confirmed action
router.post('/execute', async (req, res) => {
  const db = req.app.locals.db;
  const { action, params } = req.body;

  const actionDef = ACTIONS[action];
  if (!actionDef) return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });

  try {
    const result = await actionDef.execute(db, params || {});
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/v1/ai/actions/autonomy — get current mode + check per-action
router.get('/autonomy', (req, res) => {
  const db = req.app.locals.db;
  const mode = db.prepare("SELECT value FROM settings WHERE key = 'ai_autonomy'").get()?.value || 'confirm';
  const actionRisks = {};
  for (const [id, a] of Object.entries(ACTIONS)) {
    const auto = mode === 'full' || (mode === 'semi' && (a.risk || 'low') === 'low');
    actionRisks[id] = { risk: a.risk || 'low', auto_execute: auto };
  }
  res.json({ mode, actions: actionRisks });
});

// GET /api/v1/ai/actions — list available actions for AI system prompt
router.get('/', (req, res) => {
  const list = Object.entries(ACTIONS).map(([id, a]) => ({
    id, label: a.label, risk: a.risk || 'low', params: a.params
  }));
  res.json(list);
});

// Export action list for AI system prompt
function getActionPrompt(db) {
  const mode = db?.prepare?.("SELECT value FROM settings WHERE key = 'ai_autonomy'")?.get()?.value || 'confirm';

  const modeDesc = {
    confirm: 'CONFIRM ALL mode: The user must click Confirm on every action. Always explain what you are about to do.',
    semi: 'SEMI-AUTONOMOUS mode: Low-risk actions (bookmarks, notes, memory, feeds, backups) execute immediately. Medium/high-risk actions (Docker, Pi-hole, services, settings) still need confirmation. Be proactive — if the user clearly wants something low-risk done, just do it.',
    full: 'FULL AUTONOMOUS mode: All actions execute immediately. Be proactive and efficient. Still explain what you did after each action.'
  }[mode] || '';

  const lines = ['You can take actions on the dashboard. Format:',
    '[ACTION:action_name|param1=value1|param2=value2]',
    '',
    `Current autonomy: ${mode.toUpperCase()}. ${modeDesc}`,
    '',
    'Available actions:'];
  for (const [id, a] of Object.entries(ACTIONS)) {
    lines.push(`  ${id}(${a.params.join(', ')}) — ${a.label} [${a.risk || 'low'} risk]`);
  }
  lines.push('', 'Examples:');
  lines.push('[ACTION:add_bookmark|name=GitHub|url=https://github.com]');
  lines.push('[ACTION:docker_action|container=jellyfin|action=restart]');
  lines.push('[ACTION:create_note|title=Shopping List|content=GPU, thermal paste]');
  return lines.join('\n');
}

// Check if action auto-executes based on mode
function shouldAutoExecute(db, actionId) {
  const mode = db.prepare("SELECT value FROM settings WHERE key = 'ai_autonomy'").get()?.value || 'confirm';
  if (mode === 'full') return true;
  if (mode === 'semi') {
    const action = ACTIONS[actionId];
    return action?.risk === 'low';
  }
  return false; // confirm mode
}

router.getActionPrompt = getActionPrompt;
router.shouldAutoExecute = shouldAutoExecute;
router.ACTIONS = ACTIONS;

module.exports = router;
