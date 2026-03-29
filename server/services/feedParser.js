const RssParser = require('rss-parser');
const cron = require('node-cron');

const parser = new RssParser();

async function fetchFeed(url) {
  // Use fetch + parseString to avoid rss-parser's HTTP client being blocked (e.g. Reddit)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RigBoard/1.0; +https://github.com/Ttek2/rigboard)' },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return await parser.parseString(xml);
}

function startFeedScheduler(db) {
  // Check every 5 minutes which feeds need refreshing based on their individual intervals
  cron.schedule('*/5 * * * *', async () => {
    const feeds = db.prepare(`
      SELECT * FROM feeds
      WHERE is_enabled = 1
        AND (last_fetched IS NULL OR datetime(last_fetched, '+' || refresh_interval_minutes || ' minutes') <= datetime('now'))
    `).all();

    for (const feed of feeds) {
      try {
        const feedData = await fetchFeed(feed.url);
        const insertItem = db.prepare(
          'INSERT OR IGNORE INTO feed_items (feed_id, guid, title, link, summary, author, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );

        for (const item of feedData.items || []) {
          insertItem.run(
            feed.id,
            item.guid || item.link || item.title,
            item.title,
            item.link,
            item.contentSnippet || item.summary || null,
            item.creator || item.author || null,
            item.isoDate || item.pubDate || null
          );
        }

        db.prepare('UPDATE feeds SET last_fetched = CURRENT_TIMESTAMP WHERE id = ?').run(feed.id);
      } catch (err) {
        console.error(`Failed to fetch feed ${feed.url}: ${err.message}`);
      }
    }
  });

  // Clean old feed items daily (keep last 500 per feed)
  cron.schedule('0 3 * * *', () => {
    const feeds = db.prepare('SELECT id FROM feeds').all();
    for (const feed of feeds) {
      db.prepare(`
        DELETE FROM feed_items WHERE feed_id = ? AND id NOT IN (
          SELECT id FROM feed_items WHERE feed_id = ? ORDER BY published_at DESC LIMIT 500
        )
      `).run(feed.id, feed.id);
    }
  });

  console.log('Feed scheduler started');
}

module.exports = { fetchFeed, startFeedScheduler };
