import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getSystemStats } from '../../api';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Bar({ percent, color }) {
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color || 'var(--accent)' }} />
    </div>
  );
}

export default function SystemWidget({ config, onRemove, onConfigure }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => getSystemStats().then(d => setStats({ ...d, _ts: Date.now() })).catch(console.error);
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <WidgetWrapper title="System" icon={Cpu} onRemove={onRemove} onConfigure={onConfigure}>
      {!stats ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>CPU</span>
              <span style={{ color: 'var(--text-primary)' }}>{stats.cpu.usage}%</span>
            </div>
            <Bar percent={stats.cpu.usage} color={stats.cpu.usage > 80 ? '#ef4444' : stats.cpu.usage > 60 ? '#f59e0b' : '#22c55e'} />
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{stats.cpu.cores} cores · {stats.cpu.model.split(' ').slice(0, 4).join(' ')}</p>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-secondary)' }}>RAM</span>
              <span style={{ color: 'var(--text-primary)' }}>{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}</span>
            </div>
            <Bar percent={stats.memory.percent} color={stats.memory.percent > 85 ? '#ef4444' : stats.memory.percent > 70 ? '#f59e0b' : '#22c55e'} />
          </div>
          {/* Disks */}
          {stats.disk?.disks?.length > 0 ? stats.disk.disks.map((d, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>{d.mountpoint === '/' ? 'Disk (root)' : d.mountpoint}</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatBytes(d.used)} / {formatBytes(d.total)}</span>
              </div>
              <Bar percent={d.percent} color={d.percent > 90 ? '#ef4444' : d.percent > 75 ? '#f59e0b' : '#22c55e'} />
            </div>
          )) : (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>Disk</span>
                <span style={{ color: 'var(--text-primary)' }}>{stats.disk.percent}%</span>
              </div>
              <Bar percent={stats.disk.percent} color={stats.disk.percent > 90 ? '#ef4444' : stats.disk.percent > 75 ? '#f59e0b' : '#22c55e'} />
            </div>
          )}
          {/* Swap */}
          {stats.swap?.total > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--text-secondary)' }}>Swap</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatBytes(stats.swap.used)} / {formatBytes(stats.swap.total)}</span>
              </div>
              <Bar percent={stats.swap.percent} color={stats.swap.percent > 50 ? '#f59e0b' : '#22c55e'} />
            </div>
          )}

          {/* Load + Info */}
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>{stats.hostname}</span>
            <span>Up {formatUptime(stats.uptime)}</span>
          </div>
          {stats.load && (
            <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              <span>Load: {stats.load['1m']} / {stats.load['5m']} / {stats.load['15m']}</span>
              <span>{stats.arch} · {stats.cpu.cores}c</span>
            </div>
          )}

          {/* Top processes */}
          {stats.processes?.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-[9px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex-1">Top Processes</span>
                <span className="ml-2 w-10 text-right">CPU</span>
                <span className="ml-2 w-10 text-right">RAM</span>
              </div>
              {stats.processes.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] py-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>{p.command}</span>
                  <span className="ml-2 font-mono w-10 text-right" style={{ color: parseFloat(p.cpu) > 50 ? '#ef4444' : parseFloat(p.cpu) > 20 ? '#f59e0b' : 'var(--text-secondary)' }}>{p.cpu}%</span>
                  <span className="ml-2 font-mono w-10 text-right" style={{ color: parseFloat(p.mem) > 50 ? '#ef4444' : parseFloat(p.mem) > 20 ? '#f59e0b' : 'var(--text-secondary)' }}>{p.mem}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
