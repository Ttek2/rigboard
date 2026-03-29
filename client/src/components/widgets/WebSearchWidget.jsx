import { useState, useContext } from 'react';
import { Search, ExternalLink, Loader } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { SettingsContext } from '../../App';
import { webSearch } from '../../api';

const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', icon: '🦆', hasApi: true },
  brave: { name: 'Brave', icon: '🦁', hasApi: true },
  searxng: { name: 'SearXNG', icon: '🔍', hasApi: true },
  google: { name: 'Google', icon: 'G', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', icon: 'B', url: 'https://www.bing.com/search?q=' },
  startpage: { name: 'Startpage', icon: 'S', url: 'https://www.startpage.com/sp/search?query=' },
};

export default function WebSearchWidget({ config, onRemove, onConfigure }) {
  const { settings } = useContext(SettingsContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const engineId = config?.engine || settings.search_provider || 'duckduckgo';
  const engine = ENGINES[engineId] || ENGINES.duckduckgo;

  const handleSearch = async (e, overrideEngine) => {
    e?.preventDefault();
    if (!query.trim()) return;
    const eng = overrideEngine || engineId;
    const engDef = ENGINES[eng] || ENGINES.duckduckgo;

    // If engine has API support, search via backend and show results inline
    if (engDef.hasApi) {
      setSearching(true);
      setResults(null);
      try {
        const data = await webSearch(query.trim(), eng);
        if (data.ok) setResults(data.results);
        else setResults([]);
      } catch { setResults([]); }
      setSearching(false);
    } else {
      // No API — open in new tab
      window.open(`${engDef.url}${encodeURIComponent(query.trim())}`, '_blank');
    }
  };

  const shortcuts = [
    { label: 'Reddit', prefix: 'site:reddit.com ' },
    { label: 'HN', prefix: 'site:news.ycombinator.com ' },
    { label: 'GitHub', prefix: 'site:github.com ' },
    { label: 'YouTube', prefix: 'site:youtube.com ' },
  ];

  return (
    <WidgetWrapper title="Web Search" icon={Search} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="flex flex-col h-full">
        <form onSubmit={handleSearch} className="space-y-2 flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder={`Search with ${engine.name}...`}
              className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(ENGINES).map(([id, eng]) => {
              if (id === 'searxng' && !settings.searxng_url && !config?.searxng_url) return null;
              if (id === 'brave' && !settings.brave_search_api_key) return null;
              return (
                <button key={id} type="button"
                  onClick={(e) => handleSearch(e, id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${id === engineId ? 'font-bold' : 'opacity-60 hover:opacity-100'}`}
                  style={{ color: id === engineId ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <span className="mr-0.5">{eng.icon}</span>
                  {eng.name}
                  {eng.hasApi && <span className="ml-0.5 text-[8px] opacity-50">API</span>}
                </button>
              );
            })}
          </div>

          {query.trim() && (
            <div className="flex gap-1 flex-wrap">
              {shortcuts.map(s => (
                <button key={s.label} type="button"
                  onClick={(e) => { setQuery(s.prefix + query.trim()); handleSearch(e); }}
                  className="px-2 py-0.5 rounded border text-[10px] hover:border-cyan-500/50 transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Inline results */}
        {searching && (
          <div className="flex items-center gap-2 justify-center py-4">
            <Loader size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Searching...</span>
          </div>
        )}

        {results && !searching && (
          <div className="flex-1 overflow-auto mt-2 space-y-1 min-h-0">
            {results.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>No results found</p>
            ) : results.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                className="block p-2 rounded-lg hover:bg-white/5 transition-colors group"
                style={{ textDecoration: 'none' }}>
                <p className="text-xs font-medium group-hover:text-cyan-400 transition-colors flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  {r.title}
                  <ExternalLink size={9} className="opacity-0 group-hover:opacity-50 flex-shrink-0" />
                </p>
                <p className="text-[10px] truncate" style={{ color: '#22c55e' }}>{r.url}</p>
                {r.snippet && <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{r.snippet}</p>}
              </a>
            ))}
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
