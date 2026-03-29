import { useState, useEffect } from 'react';
import { Film, Check, X } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getJellyseerrRequests, approveJellyseerrRequest, declineJellyseerrRequest } from '../../api';

const STATUS = { 1: 'Pending', 2: 'Approved', 3: 'Declined' };
const STATUS_COLOR = { 1: '#f59e0b', 2: '#22c55e', 3: '#ef4444' };

export default function JellyseerrWidget({ config, onRemove, onConfigure }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);

  const load = () => getJellyseerrRequests().then(d => {
    if (d.error) { setError(d.error); return; }
    setRequests(d.results || []);
  }).catch(e => setError(e.message));

  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, []);

  return (
    <WidgetWrapper title="Jellyseerr" icon={Film} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p> :
      requests.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No requests</p> : (
        <div className="space-y-2">
          {requests.slice(0, 10).map(r => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {r.media?.title || r.media?.name || 'Unknown'}
                </p>
                <p className="text-xs" style={{ color: STATUS_COLOR[r.status] || 'var(--text-secondary)' }}>
                  {STATUS[r.status] || r.status} · {r.requestedBy?.displayName || 'User'}
                </p>
              </div>
              {r.status === 1 && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={async () => { await approveJellyseerrRequest(r.id); load(); }}
                    className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"><Check size={14} /></button>
                  <button onClick={async () => { await declineJellyseerrRequest(r.id); load(); }}
                    className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"><X size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
