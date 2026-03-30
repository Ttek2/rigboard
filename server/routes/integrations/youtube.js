const express = require('express');
const router = express.Router();
const RssParser = require('rss-parser');

const parser = new RssParser({
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['yt:videoId', 'videoId'],
      ['yt:channelId', 'channelId'],
    ]
  }
});

// Resolve a YouTube channel URL or handle to a channel ID
async function resolveChannelId(input) {
  input = input.trim();

  // Already a channel ID (UC...)
  if (/^UC[\w-]{22}$/.test(input)) return input;

  // Full channel URL: youtube.com/channel/UC...
  const channelMatch = input.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (channelMatch) return channelMatch[1];

  // Handle URL or @handle: youtube.com/@handle or just @handle
  const handleMatch = input.match(/(?:youtube\.com\/)?@([\w.-]+)/);
  if (handleMatch) {
    // Fetch the channel page to extract the channel ID
    try {
      const res = await fetch(`https://www.youtube.com/@${handleMatch[1]}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RigBoard/1.0)' },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      const html = await res.text();
      const idMatch = html.match(/"channelId":"(UC[\w-]{22})"/);
      if (idMatch) return idMatch[1];
    } catch {}
  }

  // Full video or playlist URL — extract channel from it
  // Just return as-is and let the caller handle failure
  return input;
}

// GET /api/v1/integrations/youtube/feed?channels=UC...,UC...
router.get('/feed', async (req, res) => {
  const { channels } = req.query;
  if (!channels) return res.json([]);

  const channelInputs = channels.split(',').map(c => c.trim()).filter(Boolean);
  const videos = [];

  for (const input of channelInputs.slice(0, 20)) {
    try {
      const channelId = await resolveChannelId(input);
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

      const feedRes = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RigBoard/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!feedRes.ok) continue;
      const xml = await feedRes.text();
      const feed = await parser.parseString(xml);

      const channelName = feed.title?.replace(' - YouTube', '').replace('YouTube', '').trim() || 'Unknown';

      for (const item of (feed.items || []).slice(0, 5)) {
        const videoId = item.videoId || item.id?.split(':').pop() || '';
        videos.push({
          title: item.title,
          channel: channelName,
          channelId: item.channelId || channelId,
          videoId,
          url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null,
          published: item.isoDate || item.pubDate || null,
        });
      }
    } catch (err) {
      console.error(`YouTube feed error for ${input}: ${err.message}`);
    }
  }

  // Sort by published date, newest first
  videos.sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));
  res.json(videos.slice(0, 50));
});

module.exports = router;
