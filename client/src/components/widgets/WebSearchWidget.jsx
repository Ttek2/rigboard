import { useState, useContext } from 'react';
import { Search, ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { SettingsContext } from '../../App';

const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', icon: '🦆' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=', icon: 'G' },
  searxng: { name: 'SearXNG', url: null, icon: '🔍' }, // URL from settings
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', icon: 'B' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/sp/search?query=', icon: 'S' },
  brave: { name: 'Brave', url: 'https://search.brave.com/search?q=', icon: '🦁' },
};

export default function WebSearchWidget({ config, onRemove, onConfigure }) {
  const { settings } = useContext(SettingsContext);
  const [query, setQuery] = useState('');
  const engineId = config?.engine || 'duckduckgo';
  const engine = ENGINES[engineId] || ENGINES.duckduckgo;

  // SearXNG uses custom URL from settings
  const searxngUrl = settings.searxng_url || config?.searxng_url;
  const searchUrl = engineId === 'searxng' && searxngUrl
    ? `${searxngUrl.replace(/\/$/, '')}/search?q=`
    : engine.url;

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!searchUrl) {
      alert('SearXNG URL not configured. Set searxng_url in widget settings or Settings page.');
      return;
    }
    window.open(`${searchUrl}${encodeURIComponent(query.trim())}`, '_blank');
    setQuery('');
  };

  // Quick search shortcuts
  const shortcuts = [
    { label: 'Reddit', prefix: 'site:reddit.com ' },
    { label: 'HN', prefix: 'site:news.ycombinator.com ' },
    { label: 'GitHub', prefix: 'site:github.com ' },
    { label: 'YouTube', prefix: 'site:youtube.com ' },
  ];

  return (
    <WidgetWrapper title="Web Search" icon={Search} onRemove={onRemove} onConfigure={onConfigure}>
      <form onSubmit={handleSearch} className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search with ${engine.name}...`}
            className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Engine selector row */}
        <div className="flex items-center gap-1 flex-wrap">
          {Object.entries(ENGINES).map(([id, eng]) => {
            if (id === 'searxng' && !searxngUrl) return null;
            return (
              <button key={id} type="button"
                onClick={() => {
                  // Can't change engine without config save, so just do the search with this engine
                  if (!query.trim()) return;
                  const url = id === 'searxng' && searxngUrl
                    ? `${searxngUrl.replace(/\/$/, '')}/search?q=`
                    : eng.url;
                  if (url) window.open(`${url}${encodeURIComponent(query.trim())}`, '_blank');
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${id === engineId ? 'font-bold' : 'opacity-60 hover:opacity-100'}`}
                style={{ color: id === engineId ? 'var(--accent)' : 'var(--text-secondary)' }}
                title={`Search with ${eng.name}`}>
                <span className="mr-0.5">{eng.icon}</span>{eng.name}
              </button>
            );
          })}
        </div>

        {/* Quick shortcuts */}
        {query.trim() && (
          <div className="flex gap-1 flex-wrap">
            {shortcuts.map(s => (
              <button key={s.label} type="button"
                onClick={() => {
                  if (searchUrl) window.open(`${searchUrl}${encodeURIComponent(s.prefix + query.trim())}`, '_blank');
                }}
                className="px-2 py-0.5 rounded border text-[10px] hover:border-cyan-500/50 transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* SearXNG config hint */}
      {engineId === 'searxng' && !searxngUrl && (
        <p className="text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>
          Configure your SearXNG instance URL in the widget gear icon (searxng_url).
        </p>
      )}
    </WidgetWrapper>
  );
}
