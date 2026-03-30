// Shared AI context builder — used by both the AI widget route and Telegram bot

function buildContext(db) {
  const parts = [];

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

  const services = db.prepare('SELECT name, url, status, last_response_ms FROM services WHERE is_enabled = 1').all();
  parts.push(`Monitored services (${services.length}):`);
  for (const s of services) parts.push(`  ${s.name} (${s.url}): ${s.status}${s.last_response_ms ? ` ${s.last_response_ms}ms` : ''}`);
  if (services.length === 0) parts.push('  No services configured.');

  const maintenance = db.prepare(`SELECT ms.task_name, ms.next_due, c.name as component, r.name as rig FROM maintenance_schedules ms JOIN components c ON ms.component_id = c.id JOIN rigs r ON c.rig_id = r.id WHERE ms.next_due IS NOT NULL ORDER BY ms.next_due ASC LIMIT 5`).all();
  const overdueCount = db.prepare(`SELECT COUNT(*) as c FROM maintenance_schedules WHERE next_due < datetime('now')`).get().c;
  parts.push(`Maintenance (${maintenance.length} upcoming, ${overdueCount} overdue):`);
  for (const m of maintenance) {
    const isOverdue = new Date(m.next_due) < new Date();
    parts.push(`  ${isOverdue ? '[OVERDUE] ' : ''}${m.task_name} on ${m.component} (${m.rig}) — due ${m.next_due}`);
  }
  if (maintenance.length === 0) parts.push('  No scheduled maintenance.');

  const bookmarks = db.prepare('SELECT name, url FROM bookmarks ORDER BY sort_order LIMIT 10').all();
  parts.push(`Bookmarks (${bookmarks.length}):`);
  for (const b of bookmarks) parts.push(`  ${b.name}: ${b.url}`);

  const notes = db.prepare('SELECT title, content FROM notes ORDER BY updated_at DESC LIMIT 5').all();
  parts.push(`Notes (${notes.length}):`);
  for (const n of notes) {
    const preview = (n.content || '').slice(0, 80).replace(/\n/g, ' ');
    parts.push(`  ${n.title}${preview ? ': ' + preview : ''}`);
  }

  const notifications = db.prepare('SELECT title, message FROM notifications WHERE is_read = 0 ORDER BY created_at DESC LIMIT 5').all();
  const totalUnread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').get().c;
  parts.push(`Notifications (${totalUnread} unread):`);
  for (const n of notifications) parts.push(`  ${n.title}${n.message ? ': ' + n.message : ''}`);

  const feedCount = db.prepare('SELECT COUNT(*) as c FROM feeds WHERE is_enabled = 1').get().c;
  const recentHeadlines = db.prepare('SELECT title FROM feed_items ORDER BY published_at DESC LIMIT 5').all();
  parts.push(`RSS feeds (${feedCount} subscribed):`);
  for (const h of recentHeadlines) parts.push(`  ${h.title}`);

  try {
    const { execSync } = require('child_process');
    const output = execSync("docker ps --format '{{.Names}}\t{{.State}}' 2>/dev/null", { encoding: 'utf8', timeout: 3000 }).trim();
    if (output) {
      const containers = output.split('\n').map(l => { const [n, s] = l.split('\t'); return `${n}: ${s}`; });
      parts.push(`Docker containers (${containers.length}):`);
      for (const c of containers) parts.push(`  ${c}`);
    }
  } catch {}

  try {
    const os = require('os');
    const memPct = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
    const load = os.loadavg();
    parts.push(`System: ${os.hostname()}, ${os.cpus().length} cores, RAM ${memPct}%, load ${load[0].toFixed(1)}/${load[1].toFixed(1)}/${load[2].toFixed(1)}, up ${Math.floor(os.uptime() / 3600)}h`);
  } catch {}

  const integrations = [];
  for (const [key, label] of [['jellyseerr_url','Jellyseerr'],['sonarr_url','Sonarr'],['radarr_url','Radarr'],['plex_url','Plex'],['jellyfin_url','Jellyfin'],['pihole_url','Pi-hole'],['ha_url','Home Assistant']]) {
    if (db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value) integrations.push(label);
  }
  if (integrations.length) parts.push(`Connected integrations: ${integrations.join(', ')}`);

  const authOn = db.prepare("SELECT value FROM settings WHERE key = 'auth_enabled'").get()?.value === 'true';
  parts.push(`Security: password ${authOn ? 'on' : 'off'}`);

  return parts.join('\n');
}

function buildMemoryContext(db) {
  const memories = db.prepare('SELECT key, value FROM ai_memory ORDER BY updated_at DESC LIMIT 20').all();
  if (memories.length === 0) return 'AI Memory: empty.';
  return 'AI Memory:\n' + memories.map(m => `  ${m.key}: ${m.value}`).join('\n');
}

module.exports = { buildContext, buildMemoryContext };
