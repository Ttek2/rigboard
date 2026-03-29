import { useState } from 'react';
import { Globe, Settings } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';

export default function EmbedWidget({ config, onRemove, onConfigure }) {
  const [editing, setEditing] = useState(!config?.url);
  const [url, setUrl] = useState(config?.url || '');

  return (
    <WidgetWrapper title={config?.title || 'Embed'} icon={Globe} onRemove={onRemove} onConfigure={onConfigure}>
      {editing || !config?.url ? (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Enter a URL to embed (Grafana panel, Pi-hole, etc.)</p>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
            className="w-full px-2 py-1 rounded border text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Note: URL must be saved via widget config. Edit the widget layout to set the URL.
          </p>
        </div>
      ) : (
        <iframe src={config.url} className="w-full h-full border-0 rounded" title={config.title || 'Embed'}
          sandbox="allow-scripts allow-same-origin" />
      )}
    </WidgetWrapper>
  );
}
