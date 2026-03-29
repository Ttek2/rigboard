const express = require('express');
const router = express.Router();

// GET /api/v1/articles/:itemId — fetch article content for reader view
router.get('/:itemId', async (req, res) => {
  const db = req.app.locals.db;
  const item = db.prepare(`
    SELECT fi.*, f.title as feed_title, f.favicon_url
    FROM feed_items fi JOIN feeds f ON fi.feed_id = f.id
    WHERE fi.id = ?
  `).get(req.params.itemId);

  if (!item) return res.status(404).json({ error: 'Article not found' });

  // Try to fetch full article content
  let content = item.summary || '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(item.link, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RigBoard/1.0' }
    });
    clearTimeout(timeout);
    const html = await response.text();

    // Extract main content heuristically: look for <article>, <main>, or large content divs
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const bodyContent = articleMatch?.[1] || mainMatch?.[1];

    if (bodyContent) {
      // Strip scripts, styles, and most HTML tags but keep paragraphs and basic formatting
      content = bodyContent
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '')
        .replace(/<img[^>]*>/gi, '')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2')
        .replace(/<\/?(?:div|span|section|figure|figcaption)[^>]*>/gi, '')
        .replace(/<(\/?)(?:h[1-6])/gi, '<$1h3')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    }
  } catch (e) {
    // Fall back to summary
  }

  // Mark as read
  db.prepare('UPDATE feed_items SET is_read = 1 WHERE id = ?').run(item.id);

  res.json({
    ...item,
    content,
    feed_title: item.feed_title,
    favicon_url: item.favicon_url
  });
});

module.exports = router;
