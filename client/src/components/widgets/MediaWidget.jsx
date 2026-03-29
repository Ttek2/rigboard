import { useState, useEffect } from 'react';
import { Tv, Play, Pause, Film, MonitorPlay, Library } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getPlexPlaying, getPlexRecent, getPlexLibraries, getJellyfinPlaying, getJellyfinRecent, getJellyfinLibraries } from '../../api';

function ProgressBar({ percent }) {
  return (
    <div className="h-1 w-full rounded-full mt-1" style={{ backgroundColor: 'var(--border)' }}>
      <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: 'var(--accent)' }} />
    </div>
  );
}

export default function MediaWidget({ config, onRemove, onConfigure }) {
  const [playing, setPlaying] = useState([]);
  const [recent, setRecent] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [error, setError] = useState(null);
  const source = config?.source || 'plex';

  useEffect(() => {
    const loadPlaying = source === 'jellyfin' ? getJellyfinPlaying : getPlexPlaying;
    const loadRecent = source === 'jellyfin' ? getJellyfinRecent : getPlexRecent;
    const loadLibs = source === 'jellyfin' ? getJellyfinLibraries : getPlexLibraries;

    loadPlaying().then(d => { if (d.error) setError(d.error); else setPlaying(d); }).catch(e => setError(e.message));
    loadRecent().then(d => { if (!d.error) setRecent(Array.isArray(d) ? d : []); }).catch(() => {});
    loadLibs().then(d => { if (!d.error) setLibraries(Array.isArray(d) ? d : []); }).catch(() => {});

    const i = setInterval(() => {
      loadPlaying().then(d => { if (!d.error) setPlaying(d); }).catch(() => {});
    }, 15000);
    return () => clearInterval(i);
  }, [source]);

  return (
    <WidgetWrapper title={source === 'jellyfin' ? 'Jellyfin' : 'Plex'} icon={Tv} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p> : (
        <div className="space-y-3">
          {/* Library stats */}
          {libraries.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Libraries</p>
              <div className="grid grid-cols-2 gap-1.5">
                {libraries.map((lib, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                    <Library size={10} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{lib.name}</span>
                    <span className="text-xs font-mono ml-auto" style={{ color: 'var(--text-secondary)' }}>
                      {lib.totalCount || lib.count || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Now playing */}
          {playing.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Now Playing</p>
              {playing.map((s, i) => (
                <div key={i} className="p-2 rounded-lg mb-1" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div className="flex items-center gap-2">
                    {s.state === 'paused' ? <Pause size={12} style={{ color: 'var(--text-secondary)' }} /> : <Play size={12} style={{ color: '#22c55e' }} />}
                    <span className="text-sm truncate flex-1" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
                  </div>
                  <p className="text-xs mt-0.5 ml-5" style={{ color: 'var(--text-secondary)' }}>{s.user} · {s.player}</p>
                  <ProgressBar percent={s.progress} />
                </div>
              ))}
            </div>
          )}

          {/* Recently added */}
          {recent.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>Recently Added</p>
              {recent.slice(0, 8).map((m, i) => (
                <div key={i} className="flex items-center gap-2 py-1 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <Film size={10} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)' }}>{m.title}</span>
                  {m.communityRating && <span className="text-[10px] font-mono" style={{ color: '#f59e0b' }}>{m.communityRating.toFixed(1)}</span>}
                  {m.addedAt && <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    {formatDistanceToNow(new Date(m.addedAt), { addSuffix: true })}
                  </span>}
                </div>
              ))}
            </div>
          )}

          {playing.length === 0 && recent.length === 0 && libraries.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No data available.</p>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
