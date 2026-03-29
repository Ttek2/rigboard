import { useState, useEffect } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getPiholeStats, togglePihole } from '../../api';

export default function PiholeWidget({ config, onRemove, onConfigure }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const load = () => getPiholeStats().then(d => { if (d.error) setError(d.error); else setStats(d); }).catch(e => setError(e.message));
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);

  const handleToggle = async () => {
    const enable = stats?.status === 'disabled';
    await togglePihole(enable);
    load();
  };

  return (
    <WidgetWrapper title="Pi-hole" icon={Shield} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p> :
      !stats ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p> : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase" style={{ color: 'var(--text-secondary)' }}>Status</span>
            <button onClick={handleToggle}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: stats.status === 'enabled' ? '#22c55e22' : '#ef444422',
                color: stats.status === 'enabled' ? '#22c55e' : '#ef4444'
              }}>
              {stats.status === 'enabled' ? <Shield size={10} /> : <ShieldOff size={10} />}
              {stats.status}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Queries" value={Number(stats.queries_today).toLocaleString()} />
            <Stat label="Blocked" value={Number(stats.blocked_today).toLocaleString()} />
            <Stat label="% Blocked" value={`${parseFloat(stats.percent_blocked).toFixed(1)}%`} />
            <Stat label="Blocklist" value={Number(stats.domains_blocked).toLocaleString()} />
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-sm font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
