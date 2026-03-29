import { useState, useEffect, useContext } from 'react';
import { Tag, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getGithubReleases } from '../../api';
import { SettingsContext } from '../../App';

export default function ReleasesWidget({ config, onRemove, onConfigure }) {
  const { settings } = useContext(SettingsContext);
  const [releases, setReleases] = useState([]);
  const repos = config?.repos || settings.tracked_repos || '';

  useEffect(() => {
    if (!repos) return;
    getGithubReleases(repos).then(setReleases).catch(console.error);
    const i = setInterval(() => { getGithubReleases(repos).then(setReleases).catch(() => {}); }, 15 * 60 * 1000);
    return () => clearInterval(i);
  }, [repos]);

  return (
    <WidgetWrapper title="Releases" icon={Tag} onRemove={onRemove} onConfigure={onConfigure}>
      {!repos ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Configure tracked repos in widget settings (e.g. jellyfin/jellyfin,sonarr/Sonarr)
        </p>
      ) : releases.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading releases...</p>
      ) : (
        <div className="space-y-1.5">
          {releases.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group"
              style={{ textDecoration: 'none' }}>
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {r.repo.split('/')[1]}
                  <span className="ml-1.5 text-xs font-mono" style={{ color: 'var(--accent)' }}>{r.tag}</span>
                  {r.prerelease && <span className="ml-1 text-xs text-amber-400">pre</span>}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatDistanceToNow(new Date(r.published), { addSuffix: true })}
                </p>
              </div>
              <ExternalLink size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-50" style={{ color: 'var(--text-secondary)' }} />
            </a>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
