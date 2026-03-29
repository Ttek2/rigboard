import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getServiceStatus } from '../../api';

const STATUS_COLORS = {
  online: '#22c55e',
  offline: '#ef4444',
  slow: '#f59e0b',
  unknown: '#6b7280',
};

function Sparkline({ checks }) {
  if (!checks || checks.length < 2) return null;
  const width = 60;
  const height = 16;
  const max = Math.max(...checks.map(c => c.response_ms || 0), 1);
  const points = checks.map((c, i) => {
    const x = (i / (checks.length - 1)) * width;
    const y = height - ((c.response_ms || 0) / max) * height;
    return `${x},${y}`;
  }).join(' ');

  // Color the line based on latest status
  const latest = checks[checks.length - 1];
  const color = STATUS_COLORS[latest?.status] || STATUS_COLORS.unknown;

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ServiceHealth({ config, onRemove, onConfigure }) {
  const [services, setServices] = useState([]);

  useEffect(() => {
    getServiceStatus().then(setServices).catch(console.error);
    const interval = setInterval(() => {
      getServiceStatus().then(setServices).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <WidgetWrapper title="Services" icon={Activity} onRemove={onRemove} onConfigure={onConfigure}>
      {services.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No services monitored. Add some in Settings.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {services.map(s => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
              className="block px-3 py-2 rounded-lg border hover:border-cyan-500/50 transition-colors"
              style={{ borderColor: 'var(--border)', textDecoration: 'none' }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s.status] || STATUS_COLORS.unknown }} />
                <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                  {s.icon ? `${s.icon} ` : ''}{s.name}
                </span>
                <Sparkline checks={s.checks} />
                {s.uptime !== null && (
                  <span className="text-xs font-mono" style={{ color: s.uptime >= 99 ? '#22c55e' : s.uptime >= 95 ? '#f59e0b' : '#ef4444' }}>
                    {s.uptime}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 ml-4.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {s.last_response_ms != null && s.status !== 'offline' && (
                  <span>{s.last_response_ms}ms</span>
                )}
                {s.avg_ms != null && <span>avg {s.avg_ms}ms</span>}
                {s.p95_ms != null && <span>p95 {s.p95_ms}ms</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
