import { useState, useEffect } from 'react';
import { Download, ArrowDown, ArrowUp } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getQbitTorrents, getTransmissionTorrents } from '../../api';

function formatSpeed(bytes) {
  if (!bytes || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function DownloadsWidget({ config, onRemove, onConfigure }) {
  const [torrents, setTorrents] = useState([]);
  const [error, setError] = useState(null);
  const client = config?.client || 'qbittorrent';

  useEffect(() => {
    const getTorrents = client === 'transmission' ? getTransmissionTorrents : getQbitTorrents;
    getTorrents().then(d => { if (d.error) setError(d.error); else setTorrents(d); }).catch(e => setError(e.message));
    const i = setInterval(() => {
      getTorrents().then(d => { if (!d.error) setTorrents(d); }).catch(() => {});
    }, 10000);
    return () => clearInterval(i);
  }, [client]);

  return (
    <WidgetWrapper title={client === 'transmission' ? 'Transmission' : 'qBittorrent'} icon={Download} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p> :
      torrents.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active downloads</p> : (
        <div className="space-y-2">
          {torrents.slice(0, 8).map((t, i) => (
            <div key={i}>
              <div className="flex items-center justify-between">
                <span className="text-sm truncate flex-1" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>{t.progress}%</span>
              </div>
              <div className="h-1 w-full rounded-full mt-0.5" style={{ backgroundColor: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: `${t.progress}%`, backgroundColor: t.progress === 100 ? '#22c55e' : 'var(--accent)' }} />
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-0.5"><ArrowDown size={10} /> {formatSpeed(t.dlspeed)}</span>
                <span className="flex items-center gap-0.5"><ArrowUp size={10} /> {formatSpeed(t.upspeed)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
