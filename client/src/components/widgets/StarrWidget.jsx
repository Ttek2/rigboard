import { useState, useEffect } from 'react';
import { Calendar as CalIcon, Download, HardDrive, Film, Tv } from 'lucide-react';
import { format } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getSonarrCalendar, getRadarrCalendar, getSonarrQueue, getRadarrQueue, getSonarrStats, getRadarrStats } from '../../api';

function formatBytes(b) {
  if (!b) return '0 B';
  const k = 1024; const s = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(1) + ' ' + s[i];
}

function ProgressBar({ percent }) {
  return (
    <div className="h-1 w-full rounded-full mt-1" style={{ backgroundColor: 'var(--border)' }}>
      <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: percent === 100 ? '#22c55e' : 'var(--accent)' }} />
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="p-1.5 rounded text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-sm font-mono font-medium" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
      <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

export default function StarrWidget({ config, onRemove, onConfigure }) {
  const [calendar, setCalendar] = useState([]);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const service = config?.service || 'sonarr';

  useEffect(() => {
    const getCal = service === 'radarr' ? getRadarrCalendar : getSonarrCalendar;
    const getQ = service === 'radarr' ? getRadarrQueue : getSonarrQueue;
    const getSt = service === 'radarr' ? getRadarrStats : getSonarrStats;

    getCal().then(d => { if (d.error) setError(d.error); else setCalendar(d); }).catch(e => setError(e.message));
    getQ().then(d => { if (!d.error) setQueue(d); }).catch(() => {});
    getSt().then(d => { if (!d.error) setStats(d); }).catch(() => {});

    const i = setInterval(() => { getQ().then(d => { if (!d.error) setQueue(d); }).catch(() => {}); }, 30000);
    return () => clearInterval(i);
  }, [service]);

  const isSonarr = service !== 'radarr';

  return (
    <WidgetWrapper title={isSonarr ? 'Sonarr' : 'Radarr'} icon={isSonarr ? Tv : Film} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p> : (
        <div className="space-y-3">
          {/* Stats overview */}
          {stats && (
            <div className="grid grid-cols-4 gap-1.5">
              <StatBox label={isSonarr ? 'Series' : 'Movies'} value={isSonarr ? stats.series_total : stats.movies_total} />
              <StatBox label="Monitored" value={isSonarr ? stats.series_monitored : stats.movies_monitored} />
              <StatBox label="Missing" value={stats.missing} color={stats.missing > 0 ? '#f59e0b' : '#22c55e'} />
              <StatBox label="Queue" value={stats.queue_count} color={stats.queue_count > 0 ? 'var(--accent)' : undefined} />
            </div>
          )}
          {stats && (
            <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              <span><HardDrive size={10} className="inline" /> {formatBytes(stats.size_on_disk)} used</span>
              <span>{formatBytes(stats.disk_free)} free of {formatBytes(stats.disk_total)}</span>
            </div>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                <Download size={10} /> Queue
              </p>
              {queue.slice(0, 5).map((q, i) => (
                <div key={i} className="mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)' }}>{q.title}</span>
                    <span className="text-[10px] ml-2" style={{ color: 'var(--text-secondary)' }}>{q.progress}%</span>
                  </div>
                  <ProgressBar percent={q.progress} />
                </div>
              ))}
            </div>
          )}

          {/* Calendar */}
          {calendar.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Upcoming</p>
              {calendar.slice(0, 8).map((ep, i) => (
                <div key={i} className="flex items-center justify-between py-0.5 border-b last:border-b-0 text-xs" style={{ borderColor: 'var(--border)' }}>
                  <span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                    {ep.title} {ep.episode && <span style={{ color: 'var(--text-secondary)' }}>{ep.episode}</span>}
                  </span>
                  <span className="flex-shrink-0 ml-2" style={{ color: 'var(--text-secondary)' }}>
                    {ep.airDate ? format(new Date(ep.airDate), 'MMM d') : ep.releaseDate ? format(new Date(ep.releaseDate), 'MMM d') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!stats && calendar.length === 0 && queue.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No data available.</p>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
