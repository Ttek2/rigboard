import { useState, useEffect } from 'react';
import { Rss, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getLatestFeedItems } from '../../api';

export default function FeedWidget({ config, onRemove, onConfigure }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getLatestFeedItems(20, config?.group).then(setItems).catch(console.error);
    const interval = setInterval(() => {
      getLatestFeedItems(20, config?.group).then(setItems).catch(console.error);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [config?.group]);

  return (
    <WidgetWrapper title={config?.title || 'News Feed'} icon={Rss} onRemove={onRemove} onConfigure={onConfigure}>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No articles yet. Add feeds in the Feeds page.</p>
      ) : (
        <div className="space-y-1">
          {items.map(item => (
            <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
              style={{ textDecoration: 'none' }}>
              {item.favicon_url && (
                <img src={item.favicon_url} alt="" className="w-4 h-4 mt-0.5 rounded-sm flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug truncate group-hover:text-cyan-400 transition-colors"
                  style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {item.feed_title}
                  {item.published_at && ` · ${formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}`}
                </p>
              </div>
              <ExternalLink size={12} className="mt-1 flex-shrink-0 opacity-0 group-hover:opacity-50" style={{ color: 'var(--text-secondary)' }} />
            </a>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
