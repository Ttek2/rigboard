import { useState, useEffect } from 'react';
import { Shield, ShieldOff, Globe, Ban, Database, List } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getPiholeStats, getPiholeTop, togglePihole } from '../../api';
import { on } from '../../events';

// Donut chart SVG
function DonutChart({ percent, size = 80, strokeWidth = 8, color = '#22c55e' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold font-mono" style={{ color }}>{percent.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// Mini bar chart
function MiniBar({ label, value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-20 truncate" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono w-10 text-right" style={{ color: 'var(--text-primary)' }}>{value.toLocaleString()}</span>
    </div>
  );
}

export default function PiholeWidget({ config, onRemove, onConfigure }) {
  const [stats, setStats] = useState(null);
  const [top, setTop] = useState(null);
  const [error, setError] = useState(null);
  const [showTop, setShowTop] = useState(false);

  const load = () => {
    getPiholeStats().then(d => { if (d.error) setError(d.error); else { setStats(d); setError(null); } }).catch(e => setError(e.message));
  };
  const loadTop = () => {
    getPiholeTop().then(d => { if (!d.error) setTop(d); }).catch(() => {});
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, []);
  useEffect(() => { const off = on('refresh:pihole', load); const off2 = on('refresh:all', load); return () => { off(); off2(); }; }, []);

  const handleToggle = async () => {
    const enable = stats?.status === 'disabled';
    await togglePihole(enable);
    load();
  };

  const enabled = stats?.status === 'enabled';
  const blocked = parseFloat(stats?.percent_blocked) || 0;
  const queries = Number(stats?.queries_today) || 0;
  const blockedCount = Number(stats?.blocked_today) || 0;
  const domains = Number(stats?.domains_blocked) || 0;

  return (
    <WidgetWrapper title="Pi-hole" icon={Shield} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p> :
      !stats ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p> : (
        <div className="space-y-3">
          {/* Top row: donut + stats */}
          <div className="flex items-center gap-4">
            <DonutChart percent={blocked} color={enabled ? '#22c55e' : '#ef4444'} />
            <div className="flex-1 space-y-2">
              {/* Toggle */}
              <button onClick={handleToggle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium w-full justify-center transition-colors"
                style={{
                  backgroundColor: enabled ? '#22c55e18' : '#ef444418',
                  color: enabled ? '#22c55e' : '#ef4444',
                  border: `1px solid ${enabled ? '#22c55e33' : '#ef444433'}`,
                }}>
                {enabled ? <Shield size={12} /> : <ShieldOff size={12} />}
                {enabled ? 'Protected' : 'Disabled'}
              </button>

              {/* Key numbers */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="text-center p-1.5 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <Globe size={10} className="mx-auto mb-0.5" style={{ color: 'var(--accent)' }} />
                  <p className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{queries.toLocaleString()}</p>
                  <p className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>Queries</p>
                </div>
                <div className="text-center p-1.5 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <Ban size={10} className="mx-auto mb-0.5" style={{ color: '#ef4444' }} />
                  <p className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{blockedCount.toLocaleString()}</p>
                  <p className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>Blocked</p>
                </div>
              </div>
            </div>
          </div>

          {/* Blocklist size */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <Database size={11} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Blocklist</span>
            <span className="text-xs font-mono font-bold ml-auto" style={{ color: 'var(--text-primary)' }}>{domains.toLocaleString()}</span>
            <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>domains</span>
          </div>

          {/* Top blocked domains (expandable) */}
          <div>
            <button onClick={() => { setShowTop(!showTop); if (!top) loadTop(); }}
              className="flex items-center gap-1 text-[10px] font-medium"
              style={{ color: 'var(--accent)' }}>
              <List size={10} />
              {showTop ? 'Hide' : 'Show'} top domains
            </button>

            {showTop && top && (
              <div className="mt-2 space-y-1.5">
                {top.top_ads && Object.keys(top.top_ads).length > 0 && (
                  <>
                    <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-secondary)' }}>Top Blocked</p>
                    {Object.entries(top.top_ads).slice(0, 5).map(([domain, count]) => (
                      <MiniBar key={domain} label={domain} value={count}
                        max={Math.max(...Object.values(top.top_ads))} color="#ef4444" />
                    ))}
                  </>
                )}
                {top.top_queries && Object.keys(top.top_queries).length > 0 && (
                  <>
                    <p className="text-[9px] font-bold uppercase mt-2" style={{ color: 'var(--text-secondary)' }}>Top Queries</p>
                    {Object.entries(top.top_queries).slice(0, 5).map(([domain, count]) => (
                      <MiniBar key={domain} label={domain} value={count}
                        max={Math.max(...Object.values(top.top_queries))} color="var(--accent)" />
                    ))}
                  </>
                )}
                {top.top_clients && Object.keys(top.top_clients).length > 0 && (
                  <>
                    <p className="text-[9px] font-bold uppercase mt-2" style={{ color: 'var(--text-secondary)' }}>Top Clients</p>
                    {Object.entries(top.top_clients).slice(0, 5).map(([client, count]) => (
                      <MiniBar key={client} label={client} value={count}
                        max={Math.max(...Object.values(top.top_clients))} color="#f59e0b" />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
