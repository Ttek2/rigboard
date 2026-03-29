const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { resolveToken, getRigSummary } = require('./oauth');

function genId(prefix) { return `${prefix}_${crypto.randomBytes(12).toString('hex')}`; }

function formatUser(user, db) {
  const rig = getRigSummary(db, user.id);
  return {
    id: user.id,
    display_name: user.display_name,
    avatar_url: user.avatar_url || null,
    avatar_color: user.avatar_color || '#3b82f6',
    rig_summary: rig.summary,
    rig_badge: rig.badge,
    comment_count: db.prepare('SELECT COUNT(*) as c FROM community_comments WHERE user_id = ?').get(user.id).c,
    karma: user.karma,
    member_since: user.created_at?.split('T')[0] || user.created_at?.split(' ')[0]
  };
}

function requireAuth(req, res, next) {
  const user = resolveToken(req.app.locals.db, req.headers.authorization);
  if (!user) return res.status(401).json({ ok: false, error: 'Authentication required', code: 'UNAUTHORIZED' });
  req.communityUser = user;
  req.siteKey = req.headers['x-site-key'] || 'default';
  next();
}

function getSiteKey(req) {
  return req.headers['x-site-key'] || req.query.site_key || 'default';
}

// === HARDWARE BADGE MATCHING ===

const CATEGORY_MAP = { gpu: 'GPU', cpu: 'CPU', ram: 'RAM', storage: 'Storage', motherboard: 'Motherboard', psu: 'PSU', case: 'Case', cooler: 'Cooling' };

function matchComponents(db, userId, topicContext) {
  if (!topicContext || topicContext.length === 0) return null;

  const components = db.prepare(`
    SELECT c.name, c.model, c.category FROM components c
    JOIN rigs r ON c.rig_id = r.id LIMIT 50
  `).all();
  if (components.length === 0) return null;

  const matches = [];
  const seen = new Set();

  for (const topic of topicContext) {
    const t = topic.toLowerCase();
    for (const comp of components) {
      const key = `${comp.category}:${comp.name}`;
      if (seen.has(key)) continue;
      const nameLower = (comp.name || '').toLowerCase();
      const modelLower = (comp.model || '').toLowerCase();
      const catLower = (comp.category || '').toLowerCase();

      const matched =
        nameLower.includes(t) || modelLower.includes(t) || t.includes(catLower) ||
        // Brand matching
        (t === 'nvidia' && (nameLower.includes('nvidia') || nameLower.includes('rtx') || nameLower.includes('gtx') || nameLower.includes('geforce'))) ||
        (t === 'amd' && (nameLower.includes('amd') || nameLower.includes('ryzen') || nameLower.includes('radeon') || nameLower.includes('rx '))) ||
        (t === 'intel' && (nameLower.includes('intel') || nameLower.includes('core') || nameLower.includes('arc '))) ||
        // Specific model matching (e.g., rtx-5090 → RTX 5090)
        nameLower.includes(t.replace(/-/g, ' ')) || modelLower.includes(t.replace(/-/g, ' '));

      if (matched) {
        seen.add(key);
        // Extract short name (e.g., "RTX 4090" from "NVIDIA GeForce RTX 4090 Founders Edition")
        const shortMatch = (comp.name + ' ' + (comp.model || '')).match(/(RTX\s*\d+\w*|RX\s*\d+\w*|Ryzen\s*\d+\s*\w*|Core\s*i\d+\s*\w*|Arc\s*\w+|DDR\d+\s*\d+GB)/i);
        matches.push({
          short_name: shortMatch?.[1] || comp.name,
          full_name: comp.model ? `${comp.name} ${comp.model}` : comp.name,
          type: CATEGORY_MAP[catLower] ? catLower : comp.category.toLowerCase(),
          verified: true
        });
      }
    }
  }

  return matches.length > 0 ? matches : null;
}

// === OUTBOUND WEBHOOKS ===

async function fireWebhook(db, siteId, event, data) {
  const webhookUrl = db.prepare("SELECT value FROM settings WHERE key = 'community_webhook_url'").get()?.value;
  const webhookSecret = db.prepare("SELECT value FROM settings WHERE key = 'community_webhook_secret'").get()?.value;
  if (!webhookUrl) return;

  const payload = JSON.stringify({ event, timestamp: new Date().toISOString(), data: { site_id: siteId, ...data } });
  const signature = webhookSecret ? crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex') : '';

  const delays = [0, 1000, 10000, 60000]; // initial + 3 retries
  for (const delay of delays) {
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RigBoard-Signature': signature,
          'X-RigBoard-Event': event,
        },
        body: payload,
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return;
    } catch {}
  }
  console.error(`Webhook delivery failed after retries: ${event} to ${webhookUrl}`);
}

// === REPLY NOTIFICATIONS ===

function notifyReply(db, comment, parentComment, replierName) {
  if (!parentComment || parentComment.user_id === comment.user_id) return; // don't notify self
  const parentUser = db.prepare('SELECT * FROM community_users WHERE id = ?').get(parentComment.user_id);
  if (!parentUser) return;

  // Create in-app notification
  db.prepare('INSERT INTO notifications (type, title, message, link) VALUES (?, ?, ?, ?)').run(
    'reply',
    `${replierName} replied to your comment`,
    comment.content.slice(0, 100),
    `${comment.slug}#${parentComment.id}`
  );
}

// === FORMAT COMMENT ===

function formatComment(comment, db, topicContext) {
  const user = db.prepare('SELECT * FROM community_users WHERE id = ?').get(comment.user_id);
  const replies = db.prepare(
    "SELECT * FROM community_comments WHERE parent_id = ? AND status != 'spam' ORDER BY vote_count DESC, created_at ASC"
  ).all(comment.id);

  const formatted = {
    id: comment.id,
    content: comment.content,
    user: user ? formatUser(user, db) : null,
    vote_count: comment.vote_count,
    created_at: comment.created_at,
    replies: replies.map(r => formatComment(r, db, topicContext))
  };

  // Add hardware badges if topic context is available
  if (topicContext && user) {
    const tc = comment.topic_context ? JSON.parse(comment.topic_context) : topicContext;
    const relevantComponents = matchComponents(db, comment.user_id, tc);
    if (relevantComponents) formatted.relevant_components = relevantComponents;
  }

  return formatted;
}

// === GET /me ===
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, data: formatUser(req.communityUser, req.app.locals.db) });
});

// === PUBLIC PROFILE ===
router.get('/profiles/:user_id', (req, res) => {
  const db = req.app.locals.db;
  const user = db.prepare('SELECT * FROM community_users WHERE id = ?').get(req.params.user_id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found', code: 'NOT_FOUND' });
  res.json({ ok: true, data: formatUser(user, db) });
});

// === COMMENTS ===

router.get('/comments', (req, res) => {
  const db = req.app.locals.db;
  const { page_type, slug, page = 1, per_page = 25, sort = 'newest', topic_context } = req.query;
  const limit = Math.min(parseInt(per_page) || 25, 100);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
  const tc = topic_context ? topic_context.split(',').map(s => s.trim()) : null;

  let orderBy = 'created_at DESC';
  if (sort === 'oldest') orderBy = 'created_at ASC';
  if (sort === 'top') orderBy = 'vote_count DESC, created_at DESC';

  const siteId = getSiteKey(req);
  const total = db.prepare(
    "SELECT COUNT(*) as c FROM community_comments WHERE page_type = ? AND slug = ? AND site_id = ? AND parent_id IS NULL AND status != 'spam'"
  ).get(page_type, slug, siteId).c;

  const comments = db.prepare(
    `SELECT * FROM community_comments WHERE page_type = ? AND slug = ? AND site_id = ? AND parent_id IS NULL AND status != 'spam' ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).all(page_type, slug, siteId, limit, offset);

  res.json({
    ok: true,
    data: {
      comments: comments.map(c => formatComment(c, db, tc)),
      total,
      page: parseInt(page) || 1,
      per_page: limit,
      has_more: offset + limit < total
    }
  });
});

router.post('/comments', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  const { page_type, slug, site_id, content, parent_id, topic_context } = req.body;

  if (!content || content.length < 1 || content.length > 2000) {
    return res.status(422).json({ ok: false, error: 'Content must be 1-2000 characters', code: 'VALIDATION_ERROR' });
  }

  const recentCount = db.prepare(
    "SELECT COUNT(*) as c FROM community_comments WHERE user_id = ? AND site_id = ? AND created_at > datetime('now', '-1 hour')"
  ).get(req.communityUser.id, req.siteKey || site_id || 'default').c;
  if (recentCount >= 5) {
    return res.status(429).json({ ok: false, error: 'Rate limited: max 5 comments per hour', code: 'RATE_LIMITED' });
  }

  let depth = 0;
  let parentComment = null;
  if (parent_id) {
    parentComment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(parent_id);
    if (!parentComment) return res.status(404).json({ ok: false, error: 'Parent comment not found', code: 'NOT_FOUND' });
    if (parentComment.depth >= 1) return res.status(422).json({ ok: false, error: 'Max reply depth is 1', code: 'VALIDATION_ERROR' });
    depth = parentComment.depth + 1;
  }

  const id = genId('cmt');
  const cleanContent = content.replace(/<[^>]*>/g, '').trim();
  const tcJson = topic_context ? JSON.stringify(topic_context) : null;

  db.prepare(
    'INSERT INTO community_comments (id, user_id, site_id, page_type, slug, parent_id, content, depth, topic_context) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.communityUser.id, req.siteKey || site_id || 'default', page_type || 'article', slug, parent_id || null, cleanContent, depth, tcJson);

  const comment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(id);
  const tc = topic_context || (tcJson ? JSON.parse(tcJson) : null);

  // Reply notification
  if (parentComment) {
    notifyReply(db, comment, parentComment, req.communityUser.display_name);
  }

  // Outbound webhook
  const parentUser = parentComment ? db.prepare('SELECT display_name FROM community_users WHERE id = ?').get(parentComment.user_id) : null;
  fireWebhook(db, req.siteKey || site_id || 'default', parent_id ? 'comment.replied' : 'comment.created', {
    comment_id: id,
    page_type: page_type || 'article',
    slug,
    user: { id: req.communityUser.id, display_name: req.communityUser.display_name },
    content_preview: cleanContent.slice(0, 100),
    parent_id: parent_id || null,
    parent_author: parentUser ? { id: parentComment.user_id, display_name: parentUser.display_name } : null,
  });

  res.status(201).json({ ok: true, data: formatComment(comment, db, tc) });
});

// === VOTING ===

router.post('/comments/:id/vote', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { direction } = req.body;
  const commentId = req.params.id;
  const userId = req.communityUser.id;

  const existing = db.prepare('SELECT * FROM community_votes WHERE comment_id = ? AND user_id = ?').get(commentId, userId);

  if (existing) {
    db.prepare('DELETE FROM community_votes WHERE comment_id = ? AND user_id = ?').run(commentId, userId);
    db.prepare('UPDATE community_comments SET vote_count = vote_count - 1 WHERE id = ?').run(commentId);
    if (existing.direction !== direction) {
      db.prepare('INSERT INTO community_votes (comment_id, user_id, direction) VALUES (?, ?, ?)').run(commentId, userId, direction || 'up');
      db.prepare('UPDATE community_comments SET vote_count = vote_count + 1 WHERE id = ?').run(commentId);
    }
  } else {
    db.prepare('INSERT INTO community_votes (comment_id, user_id, direction) VALUES (?, ?, ?)').run(commentId, userId, direction || 'up');
    db.prepare('UPDATE community_comments SET vote_count = vote_count + 1 WHERE id = ?').run(commentId);
  }

  const comment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(commentId);
  if (comment) {
    const totalKarma = db.prepare('SELECT SUM(vote_count) as k FROM community_comments WHERE user_id = ?').get(comment.user_id).k || 0;
    db.prepare('UPDATE community_users SET karma = ? WHERE id = ?').run(totalKarma, comment.user_id);
  }

  res.json({ ok: true, data: { vote_count: comment?.vote_count || 0 } });
});

// === REPORTING ===

router.post('/comments/:id/report', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const { reason } = req.body;
  const validReasons = ['spam', 'harassment', 'misinformation', 'off_topic', 'other'];
  if (!validReasons.includes(reason)) {
    return res.status(422).json({ ok: false, error: `Reason must be one of: ${validReasons.join(', ')}`, code: 'VALIDATION_ERROR' });
  }

  try {
    db.prepare('INSERT INTO community_reports (comment_id, user_id, reason) VALUES (?, ?, ?)')
      .run(req.params.id, req.communityUser.id, reason);
    db.prepare('UPDATE community_comments SET report_count = report_count + 1 WHERE id = ?').run(req.params.id);
    db.prepare("UPDATE community_comments SET status = 'flagged' WHERE id = ? AND report_count >= 3").run(req.params.id);

    // Webhook
    const comment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(req.params.id);
    if (comment) {
      fireWebhook(db, comment.site_id, 'comment.reported', {
        comment_id: req.params.id, report_count: comment.report_count + 1, reason
      });
    }
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.json({ ok: true, message: 'Already reported' });
    throw e;
  }
  res.json({ ok: true, message: 'Report submitted' });
});

// === DISCUSSIONS ===

router.get('/discussions', (req, res) => {
  const db = req.app.locals.db;
  const { slug, page = 1, per_page = 25, sort = 'hot', topic_context } = req.query;
  const limit = Math.min(parseInt(per_page) || 25, 100);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
  const tc = topic_context ? topic_context.split(',').map(s => s.trim()) : (slug ? [slug] : null);

  let orderBy = 'vote_count DESC, created_at DESC';
  if (sort === 'newest') orderBy = 'created_at DESC';
  if (sort === 'top') orderBy = 'vote_count DESC';

  const siteId = getSiteKey(req);
  const total = db.prepare(
    "SELECT COUNT(*) as c FROM community_comments WHERE page_type = 'trending' AND slug = ? AND site_id = ? AND parent_id IS NULL AND status != 'spam'"
  ).get(slug, siteId).c;

  const comments = db.prepare(
    `SELECT * FROM community_comments WHERE page_type = 'trending' AND slug = ? AND site_id = ? AND parent_id IS NULL AND status != 'spam' ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).all(slug, siteId, limit, offset);

  res.json({
    ok: true,
    data: {
      comments: comments.map(c => formatComment(c, db, tc)),
      total, page: parseInt(page) || 1, per_page: limit, has_more: offset + limit < total
    }
  });
});

router.post('/discussions', requireAuth, async (req, res) => {
  req.body.page_type = 'trending';
  // Reuse comments POST handler logic
  const db = req.app.locals.db;
  const { slug, site_id, content, parent_id, topic_context } = req.body;

  if (!content || content.length < 1 || content.length > 2000) {
    return res.status(422).json({ ok: false, error: 'Content must be 1-2000 characters', code: 'VALIDATION_ERROR' });
  }

  const recentCount = db.prepare(
    "SELECT COUNT(*) as c FROM community_comments WHERE user_id = ? AND site_id = ? AND created_at > datetime('now', '-1 hour')"
  ).get(req.communityUser.id, req.siteKey || site_id || 'default').c;
  if (recentCount >= 5) return res.status(429).json({ ok: false, error: 'Rate limited', code: 'RATE_LIMITED' });

  let depth = 0, parentComment = null;
  if (parent_id) {
    parentComment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(parent_id);
    if (!parentComment) return res.status(404).json({ ok: false, error: 'Parent not found', code: 'NOT_FOUND' });
    if (parentComment.depth >= 1) return res.status(422).json({ ok: false, error: 'Max depth 1', code: 'VALIDATION_ERROR' });
    depth = parentComment.depth + 1;
  }

  const id = genId('cmt');
  const tc = topic_context || (slug ? [slug] : null);
  db.prepare(
    'INSERT INTO community_comments (id, user_id, site_id, page_type, slug, parent_id, content, depth, topic_context) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.communityUser.id, req.siteKey || site_id || 'default', 'trending', slug, parent_id || null, content.replace(/<[^>]*>/g, '').trim(), depth, tc ? JSON.stringify(tc) : null);

  const comment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(id);

  if (parentComment) notifyReply(db, comment, parentComment, req.communityUser.display_name);
  const parentUser = parentComment ? db.prepare('SELECT display_name FROM community_users WHERE id = ?').get(parentComment.user_id) : null;
  fireWebhook(db, req.siteKey || site_id || 'default', parent_id ? 'comment.replied' : 'comment.created', {
    comment_id: id, page_type: 'trending', slug,
    user: { id: req.communityUser.id, display_name: req.communityUser.display_name },
    content_preview: content.slice(0, 100),
    parent_id: parent_id || null,
    parent_author: parentUser ? { id: parentComment.user_id, display_name: parentUser.display_name } : null,
  });

  res.status(201).json({ ok: true, data: formatComment(comment, db, tc) });
});

// === MODERATION ===

router.get('/moderate/comments', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  if (!req.communityUser.is_admin) return res.status(403).json({ ok: false, error: 'Admin required', code: 'FORBIDDEN' });
  const { site_id, status = 'flagged', page = 1, per_page = 25 } = req.query;
  const limit = Math.min(parseInt(per_page) || 25, 100);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

  let query = 'SELECT * FROM community_comments WHERE status = ?';
  const params = [status];
  if (site_id) { query += ' AND site_id = ?'; params.push(site_id); }
  query += ' ORDER BY report_count DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const comments = db.prepare(query).all(...params);
  res.json({ ok: true, data: { comments: comments.map(c => {
    const user = db.prepare('SELECT * FROM community_users WHERE id = ?').get(c.user_id);
    return { ...c, user: user ? formatUser(user, db) : null };
  }), total: comments.length, page: parseInt(page) || 1 }});
});

router.post('/moderate/comments/:id', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  if (!req.communityUser.is_admin) return res.status(403).json({ ok: false, error: 'Admin required', code: 'FORBIDDEN' });

  const { action } = req.body;
  const comment = db.prepare('SELECT * FROM community_comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ ok: false, error: 'Comment not found', code: 'NOT_FOUND' });

  if (action === 'approve') db.prepare("UPDATE community_comments SET status = 'approved' WHERE id = ?").run(req.params.id);
  else if (action === 'remove') {
    db.prepare("UPDATE community_comments SET status = 'removed' WHERE id = ?").run(req.params.id);
    fireWebhook(db, comment.site_id, 'comment.removed', { comment_id: req.params.id, removed_by: req.communityUser.display_name });
  }
  else if (action === 'spam') db.prepare("UPDATE community_comments SET status = 'spam' WHERE id = ?").run(req.params.id);
  else if (action === 'ban_user') {
    db.prepare("UPDATE community_comments SET status = 'removed' WHERE user_id = ? AND site_id = ?").run(comment.user_id, comment.site_id);
    fireWebhook(db, comment.site_id, 'user.banned', { user: { id: comment.user_id }, ban_reason: 'Moderation action' });
  }
  else return res.status(422).json({ ok: false, error: 'Invalid action', code: 'VALIDATION_ERROR' });

  res.json({ ok: true, message: `Action '${action}' applied` });
});

module.exports = router;
