import { useState, useEffect } from 'react';
import { MonitorPlay, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getYouTubeFeed } from '../../api';

export default function YouTubeWidget({ config, onRemove, onConfigure }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const channels = config?.channels || '';

  useEffect(() => {
    if (!channels) { setLoading(false); return; }
    const load = () => getYouTubeFeed(channels).then(v => { setVideos(v); setLoading(false); }).catch(() => setLoading(false));
    load();
    const i = setInterval(load, 10 * 60 * 1000); // refresh every 10 min
    return () => clearInterval(i);
  }, [channels]);

  return (
    <WidgetWrapper title="YouTube" icon={MonitorPlay} onRemove={onRemove} onConfigure={onConfigure}>
      {!channels ? (
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Configure channels in widget settings.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Paste channel URLs, @handles, or channel IDs (comma-separated).
          </p>
        </div>
      ) : loading ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : videos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No videos found.</p>
      ) : (
        <div className="space-y-2">
          {videos.map((v, i) => (
            <a key={v.videoId || i} href={v.url} target="_blank" rel="noopener noreferrer"
              className="flex gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group"
              style={{ textDecoration: 'none' }}>
              {v.thumbnail && (
                <img src={v.thumbnail} alt="" loading="lazy"
                  className="w-24 h-[54px] rounded object-cover flex-shrink-0"
                  style={{ backgroundColor: 'var(--bg-primary)' }} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {v.title}
                </p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--accent)' }}>
                  {v.channel}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  {v.published ? formatDistanceToNow(new Date(v.published), { addSuffix: true }) : ''}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
