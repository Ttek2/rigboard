const express = require('express');
const router = express.Router();

// Build a comprehensive dashboard context summary
// Always includes section headers even when empty so AI knows what widgets exist
function buildContext(db) {
  const parts = [];

  // Rigs + components
  const rigs = db.prepare('SELECT id, name FROM rigs').all();
  parts.push(`Hardware rigs (${rigs.length}):`);
  if (rigs.length > 0) {
    for (const rig of rigs) {
      const comps = db.prepare('SELECT name, category, model, purchase_price, currency, warranty_expires FROM components WHERE rig_id = ?').all(rig.id);
      const compList = comps.map(c => {
        let s = `${c.category}: ${c.name}`;
        if (c.model) s += ` (${c.model})`;
        if (c.purchase_price) s += ` [${c.currency || 'EUR'} ${c.purchase_price}]`;
        if (c.warranty_expires) s += ` warranty:${c.warranty_expires}`;
        return s;
      }).join(', ');
      const totalCost = db.prepare('SELECT SUM(purchase_price) as t FROM components WHERE rig_id = ?').get(rig.id).t;
      parts.push(`  ${rig.name}: ${compList || 'no components'}${totalCost ? ` (total: ${comps[0]?.currency || 'EUR'} ${totalCost.toFixed(2)})` : ''}`);
    }
  } else {
    parts.push('  No rigs configured yet.');
  }

  // Service statuses
  const services = db.prepare('SELECT name, url, status, last_response_ms FROM services WHERE is_enabled = 1').all();
  parts.push(`Monitored services (${services.length}):`);
  if (services.length > 0) {
    for (const s of services) {
      parts.push(`  ${s.name} (${s.url}): ${s.status}${s.last_response_ms ? ` ${s.last_response_ms}ms` : ''}`);
    }
  } else {
    parts.push('  No services configured.');
  }

  // Upcoming maintenance
  const maintenance = db.prepare(`
    SELECT ms.task_name, ms.next_due, c.name as component, r.name as rig
    FROM maintenance_schedules ms
    JOIN components c ON ms.component_id = c.id
    JOIN rigs r ON c.rig_id = r.id
    WHERE ms.next_due IS NOT NULL
    ORDER BY ms.next_due ASC LIMIT 5
  `).all();
  const overdueCount = db.prepare(`
    SELECT COUNT(*) as c FROM maintenance_schedules WHERE next_due < datetime('now')
  `).get().c;
  parts.push(`Maintenance schedules (${maintenance.length} upcoming, ${overdueCount} overdue):`);
  if (maintenance.length > 0) {
    for (const m of maintenance) {
      const isOverdue = new Date(m.next_due) < new Date();
      parts.push(`  ${isOverdue ? '[OVERDUE] ' : ''}${m.task_name} on ${m.component} (${m.rig}) — due ${m.next_due}`);
    }
  } else {
    parts.push('  No scheduled maintenance.');
  }

  // Bookmarks
  const bookmarks = db.prepare('SELECT name, url FROM bookmarks ORDER BY sort_order LIMIT 10').all();
  parts.push(`Bookmarks (${bookmarks.length}):`);
  if (bookmarks.length > 0) {
    for (const b of bookmarks) { parts.push(`  ${b.name}: ${b.url}`); }
  } else {
    parts.push('  No bookmarks saved.');
  }

  // Notes
  const notes = db.prepare('SELECT title, content FROM notes ORDER BY updated_at DESC LIMIT 5').all();
  parts.push(`Notes (${notes.length}):`);
  if (notes.length > 0) {
    for (const n of notes) {
      const preview = (n.content || '').slice(0, 80).replace(/\n/g, ' ');
      parts.push(`  ${n.title}${preview ? ': ' + preview : ''}`);
    }
  } else {
    parts.push('  No notes.');
  }

  // Notifications
  const notifications = db.prepare('SELECT title, message FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT 5').all();
  const totalUnread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').get().c;
  parts.push(`Notifications (${totalUnread} unread):`);
  if (notifications.length > 0) {
    for (const n of notifications) {
      parts.push(`  ${n.title}${n.message ? ': ' + n.message : ''}`);
    }
  } else {
    parts.push('  No unread notifications.');
  }

  // Feeds
  const feedCount = db.prepare('SELECT COUNT(*) as c FROM feeds WHERE is_enabled = 1').get().c;
  const recentHeadlines = db.prepare('SELECT title FROM feed_items ORDER BY published_at DESC LIMIT 5').all();
  parts.push(`RSS feeds (${feedCount} subscribed):`);
  if (recentHeadlines.length > 0) {
    for (const h of recentHeadlines) { parts.push(`  ${h.title}`); }
  } else {
    parts.push('  No feed items yet.');
  }

  // Community
  const communityEnabled = db.prepare("SELECT value FROM settings WHERE key = 'community_opted_in'").get()?.value === 'true';
  const communityName = db.prepare("SELECT value FROM settings WHERE key = 'community_display_name'").get()?.value;
  const commentCount = (() => { try { return db.prepare('SELECT COUNT(*) as c FROM community_comments').get().c; } catch { return 0; } })();
  const recentComments = (() => { try { return db.prepare("SELECT content, slug, page_type, created_at FROM community_comments ORDER BY created_at DESC LIMIT 5").all(); } catch { return []; } })();

  parts.push(`Ttek2 Community (${communityEnabled ? 'connected' : 'not connected'}):`);
  if (communityEnabled) {
    parts.push(`  Display name: ${communityName || 'not set'}`);
    parts.push(`  Total comments: ${commentCount}`);
    if (recentComments.length > 0) {
      parts.push('  Recent community activity:');
      for (const c of recentComments) {
        parts.push(`    [${c.page_type}/${c.slug}] ${c.content.slice(0, 80)}`);
      }
    }
  } else {
    parts.push('  User has not connected to ttek2 community yet.');
  }

  // Docker containers
  try {
    const { execSync } = require('child_process');
    const output = execSync("docker ps --format '{{.Names}}\t{{.State}}' 2>/dev/null", { encoding: 'utf8', timeout: 3000 }).trim();
    if (output) {
      const containers = output.split('\n').map(l => { const [n, s] = l.split('\t'); return `${n}: ${s}`; });
      parts.push(`Docker containers (${containers.length}):`);
      for (const c of containers) parts.push(`  ${c}`);
    } else {
      parts.push('Docker: no containers running.');
    }
  } catch { parts.push('Docker: not accessible.'); }

  // System stats (lightweight)
  try {
    const os = require('os');
    const memPct = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
    const load = os.loadavg();
    parts.push(`System: ${os.hostname()}, ${os.cpus().length} cores, RAM ${memPct}%, load ${load[0].toFixed(1)}/${load[1].toFixed(1)}/${load[2].toFixed(1)}, up ${Math.floor(os.uptime() / 3600)}h`);
  } catch {}

  // Starred articles
  try {
    const starred = db.prepare('SELECT fi.title FROM starred_items si JOIN feed_items fi ON si.feed_item_id = fi.id ORDER BY si.created_at DESC LIMIT 5').all();
    if (starred.length > 0) {
      parts.push(`Starred articles (${starred.length}):`);
      for (const s of starred) parts.push(`  ${s.title}`);
    }
  } catch {}

  // Tracked GitHub repos
  const trackedRepos = db.prepare("SELECT value FROM settings WHERE key = 'tracked_repos'").get()?.value;
  if (trackedRepos) parts.push(`Tracked GitHub repos: ${trackedRepos}`);

  // Dashboard layout
  try {
    const tabs = db.prepare('SELECT name, cols FROM dashboard_tabs ORDER BY sort_order').all();
    const widgetCount = db.prepare('SELECT COUNT(*) as c FROM widget_layout').get().c;
    parts.push(`Dashboard: ${widgetCount} widgets across ${tabs.length} tab(s): ${tabs.map(t => `${t.name} (${t.cols}col)`).join(', ')}`);
  } catch {}

  // Theme + visual styles
  const currentTheme = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get()?.value;
  if (currentTheme) {
    let line = `Theme: ${currentTheme}`;
    try { const vs = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'visual_styles'").get()?.value || '[]'); if (vs.length) line += ` + ${vs.join(', ')}`; } catch {}
    parts.push(line);
  }

  // Connected integrations (just names, not credentials)
  const integrations = [];
  for (const [key, label] of [['jellyseerr_url','Jellyseerr'],['sonarr_url','Sonarr'],['radarr_url','Radarr'],['plex_url','Plex'],['jellyfin_url','Jellyfin'],['pihole_url','Pi-hole'],['qbittorrent_url','qBittorrent'],['transmission_url','Transmission'],['ha_url','Home Assistant']]) {
    if (db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value) integrations.push(label);
  }
  if (integrations.length) parts.push(`Connected integrations: ${integrations.join(', ')}`);

  // Security status
  const authOn = db.prepare("SELECT value FROM settings WHERE key = 'auth_enabled'").get()?.value === 'true';
  const totpOn = db.prepare("SELECT value FROM settings WHERE key = 'totp_enabled'").get()?.value === 'true';
  parts.push(`Security: password ${authOn ? 'on' : 'off'}, 2FA ${totpOn ? 'on' : 'off'}`);

  // Weather
  const city = db.prepare("SELECT value FROM settings WHERE key = 'weather_city'").get()?.value;
  if (city) parts.push(`Weather: ${city}`);

  return parts.join('\n');
}

function buildMemoryContext(db) {
  const memories = db.prepare('SELECT key, value FROM ai_memory ORDER BY updated_at DESC LIMIT 20').all();
  if (memories.length === 0) return '';
  return 'AI Memory (things you learned about this user):\n' +
    memories.map(m => `  ${m.key}: ${m.value}`).join('\n');
}

// Fetch pulse data for AI context (uses same cache as pulse route)
let pulseCache = { data: null, fetchedAt: 0 };
async function getPulseContext() {
  // Reuse cache if fresh (5 min)
  if (pulseCache.data && Date.now() - pulseCache.fetchedAt < 5 * 60 * 1000) {
    return pulseCache.data;
  }
  try {
    const res = await fetch('https://ttek2.com/api/trending/pulse', {
      headers: { 'User-Agent': 'RigBoard/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    if (data.ok) { pulseCache = { data: data.data, fetchedAt: Date.now() }; return data.data; }
  } catch {}
  return pulseCache.data || null;
}

function buildPulseContext(pulseData) {
  if (!pulseData) return '';
  const parts = [];

  const topics = pulseData.topics || [];
  if (topics.length > 0) {
    parts.push(`Community Pulse (${topics.length} trending topics across ${pulseData.sources_healthy || '?'} sources):`);
    for (const t of topics) {
      const sentiment = t.pulse?.sentiment || 'unknown';
      const score = t.pulse?.sentiment_score;
      const severity = t.pulse?.severity || 'info';
      const prices = (t.pulse?.price_mentions || []).map(p => `${p.product}: ${p.price}`).join(', ');
      parts.push(`  ${t.name} (score ${t.score.toFixed(1)}, ${sentiment}${score ? ` ${score}%` : ''}, ${severity}): ${t.pulse?.key_takeaway || t.pulse?.summary || 'no analysis'}`);
      if (prices) parts.push(`    Prices: ${prices}`);
    }
  }

  const deals = pulseData.deals || [];
  if (deals.length > 0) {
    parts.push(`Deals (${deals.length} active):`);
    for (const d of deals.slice(0, 5)) {
      parts.push(`  ${d.title} (${d.source})`);
    }
  }

  const velocity = pulseData.velocity || [];
  if (velocity.length > 0) {
    parts.push(`Emerging keywords: ${velocity.slice(0, 5).map(v => `${v.keyword} (${v.mention_count} mentions)`).join(', ')}`);
  }

  return parts.join('\n');
}

// POST /api/v1/ai/chat
router.post('/chat', async (req, res) => {
  const db = req.app.locals.db;
  const { messages, include_context } = req.body;

  // Get AI config from settings
  const aiUrl = db.prepare("SELECT value FROM settings WHERE key = 'ai_url'").get()?.value;
  const aiKey = db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get()?.value;
  const aiModel = db.prepare("SELECT value FROM settings WHERE key = 'ai_model'").get()?.value || 'gpt-4o-mini';
  const maxTokens = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'ai_max_tokens'").get()?.value || '1024');
  const timeoutMs = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'ai_timeout'").get()?.value || '600') * 1000; // default 10 min

  if (!aiUrl) {
    return res.status(400).json({ error: 'AI not configured. Set ai_url, ai_api_key, and ai_model in widget settings.' });
  }

  // Build messages with optional context
  const systemMessages = [];
  systemMessages.push({
    role: 'system',
    content: `You are RigBoard AI, a helpful assistant embedded in a personal dashboard for PC enthusiasts and homelabbers. Be concise and direct. You can reference the user's hardware, services, trending topics, and feeds when relevant.

You have persistent memory. To save something for future conversations, include a line in your response like:
[MEMORY:key=value]
For example: [MEMORY:preferred_gpu_brand=NVIDIA] or [MEMORY:budget=500 EUR] or [MEMORY:location=Ireland]
You can save multiple memories in one response. These persist across page refreshes and sessions.

${require('./ai-actions').getActionPrompt(db)}`
  });

  // Always include memory (it's the AI's own knowledge, not dashboard state)
  const memoryContext = buildMemoryContext(db);
  if (memoryContext) {
    systemMessages.push({ role: 'system', content: memoryContext });
  }

  if (include_context !== false) {
    const context = buildContext(db);
    if (context) {
      systemMessages.push({
        role: 'system',
        content: `Dashboard context (current state):\n${context}`
      });
    }

    // Add Community Pulse trending data
    try {
      const pulseData = await getPulseContext();
      const pulseContext = buildPulseContext(pulseData);
      if (pulseContext) {
        systemMessages.push({
          role: 'system',
          content: `Trending tech topics (live from 39 sources across Reddit, HN, Google Trends, RSS):\n${pulseContext}`
        });
      }
    } catch {}
  }

  const fullMessages = [...systemMessages, ...messages];

  try {
    // Build endpoint URL: if it already contains /chat/completions, use as-is
    // If it ends with /v1 or /api/v1, append /chat/completions
    // Otherwise append /v1/chat/completions
    let base = aiUrl.replace(/\/+$/, '');
    let endpoint;
    if (base.includes('/chat/completions')) {
      endpoint = base;
    } else if (/\/v\d+$/.test(base) || /\/api\/v\d+$/.test(base)) {
      endpoint = `${base}/chat/completions`;
    } else {
      endpoint = `${base}/v1/chat/completions`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(aiKey ? { 'Authorization': `Bearer ${aiKey}` } : {}),
      },
      body: JSON.stringify({
        model: aiModel,
        messages: fullMessages,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `AI API error: ${err.slice(0, 200)}` });
    }

    // Stream the response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: `Failed to reach AI at ${endpoint}: ${err.message}` });
    } else {
      res.end();
    }
  }
});

// GET /api/v1/ai/context — preview what context would be sent
router.get('/context', async (req, res) => {
  const db = req.app.locals.db;
  const dashboardContext = buildContext(db);

  let pulseContext = '';
  try {
    const pulseData = await getPulseContext();
    pulseContext = buildPulseContext(pulseData);
  } catch {}

  const fullContext = [dashboardContext, pulseContext].filter(Boolean).join('\n\n');
  const tokenEstimate = Math.ceil(fullContext.split(/\s+/).length * 1.3);
  res.json({ context: fullContext, token_estimate: tokenEstimate });
});

// === CHAT HISTORY ===

// GET /api/v1/ai/history — get persisted chat messages
router.get('/history', (req, res) => {
  const db = req.app.locals.db;
  const messages = db.prepare('SELECT role, content, created_at FROM ai_chat_messages ORDER BY id ASC').all();
  res.json(messages);
});

// POST /api/v1/ai/history — save a message
router.post('/history', (req, res) => {
  const db = req.app.locals.db;
  const { role, content } = req.body;
  db.prepare('INSERT INTO ai_chat_messages (role, content) VALUES (?, ?)').run(role, content);
  res.json({ success: true });
});

// DELETE /api/v1/ai/history — clear chat history
router.delete('/history', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM ai_chat_messages').run();
  res.json({ success: true });
});

// === MEMORY ===

// GET /api/v1/ai/memory
router.get('/memory', (req, res) => {
  const db = req.app.locals.db;
  const memories = db.prepare('SELECT * FROM ai_memory ORDER BY updated_at DESC').all();
  res.json(memories);
});

// POST /api/v1/ai/memory — save or update a memory
router.post('/memory', (req, res) => {
  const db = req.app.locals.db;
  const { key, value } = req.body;
  db.prepare('INSERT INTO ai_memory (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
    .run(key, value);
  res.json({ success: true });
});

// POST /api/v1/ai/memory/extract — extract [MEMORY:key=value] from AI response text
router.post('/memory/extract', (req, res) => {
  const db = req.app.locals.db;
  const { text } = req.body;
  const matches = text.matchAll(/\[MEMORY:([^=]+)=([^\]]+)\]/g);
  let saved = 0;
  for (const match of matches) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value) {
      db.prepare('INSERT INTO ai_memory (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP')
        .run(key, value);
      saved++;
    }
  }
  res.json({ saved });
});

// DELETE /api/v1/ai/memory/:key
router.delete('/memory/:key', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM ai_memory WHERE key = ?').run(req.params.key);
  res.json({ success: true });
});

// === AI HEARTBEAT ===
// Periodic AI check-in that scans dashboard state and creates proactive notifications

const HEARTBEAT_PROMPT = `You are RigBoard's proactive monitoring AI. Analyze the dashboard context and trending data below.
Generate 1-3 short, actionable notifications the user should see. Focus on:
- Hardware they own that's trending (price drops, security issues, new releases)
- Overdue or upcoming maintenance
- Services that are down or slow
- Notable deals on hardware they might want
- Any "alert" severity trending topics relevant to their setup

Respond ONLY with a JSON array of notification objects. Each object has:
- "title": short headline (max 60 chars)
- "message": one sentence detail (max 120 chars)
- "type": "ai_insight" | "ai_alert" | "ai_deal"

If nothing is noteworthy, return an empty array: []
Do NOT include any text outside the JSON array.`;

async function runHeartbeat(db) {
  const aiUrl = db.prepare("SELECT value FROM settings WHERE key = 'ai_url'").get()?.value;
  const aiKey = db.prepare("SELECT value FROM settings WHERE key = 'ai_api_key'").get()?.value;
  const aiModel = db.prepare("SELECT value FROM settings WHERE key = 'ai_model'").get()?.value || 'gpt-4o-mini';
  const heartbeatEnabled = db.prepare("SELECT value FROM settings WHERE key = 'ai_heartbeat'").get()?.value;

  if (!aiUrl || heartbeatEnabled !== 'true') return;

  try {
    const dashboardContext = buildContext(db);
    const pulseData = await getPulseContext();
    const pulseContext = buildPulseContext(pulseData);
    const fullContext = [dashboardContext, pulseContext].filter(Boolean).join('\n\n');

    let base = aiUrl.replace(/\/+$/, '');
    let endpoint;
    if (base.includes('/chat/completions')) endpoint = base;
    else if (/\/v\d+$/.test(base) || /\/api\/v\d+$/.test(base)) endpoint = `${base}/chat/completions`;
    else endpoint = `${base}/v1/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(aiKey ? { 'Authorization': `Bearer ${aiKey}` } : {}),
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: 'system', content: HEARTBEAT_PROMPT },
          { role: 'system', content: `Current dashboard state:\n${fullContext}` },
          { role: 'user', content: 'Analyze and generate notifications.' }
        ],
        max_tokens: 512,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) return;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const notifications = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(notifications)) return;

    // Insert notifications (dedup by title within last hour)
    for (const n of notifications.slice(0, 3)) {
      if (!n.title) continue;
      const recent = db.prepare(
        "SELECT id FROM notifications WHERE title = ? AND created_at > datetime('now', '-1 hour')"
      ).get(n.title);
      if (!recent) {
        db.prepare('INSERT INTO notifications (type, title, message) VALUES (?, ?, ?)')
          .run(n.type || 'ai_insight', n.title, n.message || '');
      }
    }

    console.log(`AI heartbeat: generated ${notifications.length} notifications`);
  } catch (err) {
    console.error(`AI heartbeat failed: ${err.message}`);
  }
}

// POST /api/v1/ai/heartbeat — manually trigger a heartbeat
router.post('/heartbeat', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await runHeartbeat(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/ai/heartbeat/status
router.get('/heartbeat/status', (req, res) => {
  const db = req.app.locals.db;
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'ai_heartbeat'").get()?.value === 'true';
  const interval = db.prepare("SELECT value FROM settings WHERE key = 'ai_heartbeat_interval'").get()?.value || '60';
  res.json({ enabled, interval_minutes: parseInt(interval) });
});

// Export for scheduler
router.runHeartbeat = runHeartbeat;

module.exports = router;
