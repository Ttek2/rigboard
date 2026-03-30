import { useState, useEffect } from 'react';
import { Activity, ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getServiceStatus, getServiceHistory } from '../api';

function UptimeBar({ percent }) {
  const color = percent >= 99.5 ? '#22c55e' : percent >= 95 ? '#f59e0b' : '#ef4444';
  return (
    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { online: '#22c55e', slow: '#f59e0b', offline: '#ef4444', unknown: '#6b7280' };
  return <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[status] || colors.unknown }} />;
}

function ResponseChart({ dataPoints, maxMs }) {
  if (!dataPoints.length) return null;
  const max = maxMs || Math.max(...dataPoints.map(d => d.avg_ms || 0), 1);
  const w = 100 / dataPoints.length;

  return (
    <svg viewBox={`0 0 ${dataPoints.length * 4} 40`} className="w-full" style={{ height: 60 }} preserveAspectRatio="none">
      {/* Uptime background bars */}
      {dataPoints.map((d, i) => (
        <rect key={`bg-${i}`} x={i * 4} y={0} width={3.5} height={40} rx={0.5}
          fill={d.uptime_percent >= 99.5 ? '#22c55e22' : d.uptime_percent >= 95 ? '#f59e0b22' : d.offline > 0 ? '#ef444422' : '#22c55e22'} />
      ))}
      {/* Response time line */}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"
        points={dataPoints.map((d, i) => `${i * 4 + 1.75},${40 - (d.avg_ms / max) * 36}`).join(' ')} />
    </svg>
  );
}

export default function UptimePage() {
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServiceStatus().then(s => { setServices(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) { setHistory(null); return; }
    setHistory(null);
    getServiceHistory(selected, period).then(setHistory).catch(() => {});
  }, [selected, period]);

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Uptime History</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {services.length} monitored service{services.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No services configured. Add services in Settings &gt; Services.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Service list */}
          <div className="w-80 flex-shrink-0 space-y-1.5">
            {services.map(s => (
              <button key={s.id} onClick={() => setSelected(s.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                style={{
                  backgroundColor: selected === s.id ? 'var(--accent)11' : 'transparent',
                  borderColor: selected === s.id ? 'var(--accent)' : 'var(--border)',
                }}>
                <StatusDot status={s.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span>{s.uptime ? `${s.uptime}%` : '--'}</span>
                    <span>{s.avg_ms ? `${s.avg_ms}ms` : ''}</span>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-secondary)', opacity: selected === s.id ? 1 : 0.3 }} />
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="flex-1">
            {!selected ? (
              <div className="text-center py-20 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                <Activity size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Select a service to view uptime history</p>
              </div>
            ) : !history ? (
              <div className="text-center py-20" style={{ color: 'var(--text-secondary)' }}>Loading history...</div>
            ) : (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}>
                {/* Header */}
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{history.service.name}</h2>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{history.service.url}</p>
                    </div>
                    <div className="flex gap-1">
                      {['7d', '30d'].map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                          className="px-3 py-1 rounded text-xs font-medium"
                          style={{
                            color: period === p ? 'var(--accent)' : 'var(--text-secondary)',
                            backgroundColor: period === p ? 'var(--accent)11' : 'transparent',
                          }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-4 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <p className="text-[10px] uppercase font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Uptime</p>
                    <p className="text-xl font-bold" style={{ color: history.uptime_percent >= 99.5 ? '#22c55e' : history.uptime_percent >= 95 ? '#f59e0b' : '#ef4444' }}>
                      {history.uptime_percent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Avg Response</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{history.avg_ms}<span className="text-xs font-normal">ms</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Checks</p>
                    <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{history.total_checks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Incidents</p>
                    <p className="text-xl font-bold" style={{ color: history.incidents > 0 ? '#ef4444' : '#22c55e' }}>{history.incidents}</p>
                  </div>
                </div>

                {/* Uptime bar */}
                <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <UptimeBar percent={history.uptime_percent} />
                </div>

                {/* Response time chart */}
                {history.data_points.length > 0 && (
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-[10px] uppercase font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Response Time ({period === '7d' ? 'hourly' : 'daily'})
                    </p>
                    <ResponseChart dataPoints={history.data_points} />
                    <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                      <span>{history.data_points[0]?.timestamp}</span>
                      <span>{history.data_points[history.data_points.length - 1]?.timestamp}</span>
                    </div>
                  </div>
                )}

                {/* Uptime heatmap */}
                {history.data_points.length > 0 && (
                  <div className="px-5 py-4">
                    <p className="text-[10px] uppercase font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Uptime ({period === '7d' ? 'hourly' : 'daily'})
                    </p>
                    <div className="flex gap-px flex-wrap">
                      {history.data_points.map((d, i) => (
                        <div key={i} className="rounded-sm" title={`${d.timestamp}: ${d.uptime_percent}% (${d.total} checks)`}
                          style={{
                            width: period === '7d' ? 4 : 8,
                            height: period === '7d' ? 16 : 16,
                            backgroundColor: d.offline > 0 ? '#ef4444' : d.uptime_percent >= 99.5 ? '#22c55e' : d.uptime_percent >= 95 ? '#f59e0b' : '#22c55e',
                            opacity: d.total > 0 ? 0.4 + (d.uptime_percent / 100) * 0.6 : 0.1,
                          }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
