import { useState, useEffect } from 'react';
import { Container, Play, Square, RotateCw } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { on } from '../../events';
import { getDockerContainers, dockerAction, getDockerStats } from '../../api';

const STATE_COLORS = {
  running: '#22c55e', exited: '#ef4444', paused: '#f59e0b',
  restarting: '#f59e0b', created: '#6b7280', dead: '#ef4444',
};

export default function DockerWidget({ config, onRemove, onConfigure }) {
  const [containers, setContainers] = useState([]);
  const [stats, setStats] = useState({});
  const [acting, setActing] = useState(null);

  const load = () => {
    getDockerContainers().then(setContainers).catch(console.error);
    getDockerStats().then(s => {
      const map = {};
      for (const st of (Array.isArray(s) ? s : [])) map[st.name] = st;
      setStats(map);
    }).catch(() => {});
  };
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);
  useEffect(() => { const off = on('refresh:docker', load); const off2 = on('refresh:all', load); return () => { off(); off2(); }; }, []);

  const handleAction = async (name, action) => {
    setActing(`${name}-${action}`);
    try { await dockerAction(name, action); } catch {}
    setTimeout(load, 1000);
    setActing(null);
  };

  return (
    <WidgetWrapper title="Docker" icon={Container} onRemove={onRemove} onConfigure={onConfigure}>
      {containers.length === 0 ? (
        <div className="text-center py-2">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No containers found</p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
            If running in Docker, add to your compose:<br/>
            <code className="text-[9px]" style={{ color: 'var(--accent)' }}>- /var/run/docker.sock:/var/run/docker.sock:ro</code>
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {containers.map((c, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg group"
              style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATE_COLORS[c.state] || '#6b7280' }} />
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                {stats[c.name] && c.state === 'running' && (
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                    CPU {stats[c.name].cpu} · Mem {stats[c.name].mem_pct}
                  </span>
                )}
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {c.state !== 'running' && (
                  <button onClick={() => handleAction(c.name, 'start')} className="p-0.5 rounded hover:bg-white/10"
                    style={{ color: '#22c55e' }} title="Start"><Play size={12} /></button>
                )}
                {c.state === 'running' && (
                  <button onClick={() => handleAction(c.name, 'stop')} className="p-0.5 rounded hover:bg-white/10"
                    style={{ color: '#ef4444' }} title="Stop"><Square size={12} /></button>
                )}
                <button onClick={() => handleAction(c.name, 'restart')} className="p-0.5 rounded hover:bg-white/10"
                  style={{ color: 'var(--text-secondary)' }} title="Restart"><RotateCw size={12} /></button>
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{c.state}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
