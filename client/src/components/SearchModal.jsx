import { useState, useEffect, useRef } from 'react';
import { Search, X, Rss, HardDrive, Bookmark, StickyNote, Cpu, Zap, Plus, Settings, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { globalSearch, createBookmark, createNote } from '../api';

const QUICK_ACTIONS = [
  { label: 'Go to Dashboard', icon: Monitor, action: (nav) => nav('/') },
  { label: 'Go to Feeds', icon: Rss, action: (nav) => nav('/feeds') },
  { label: 'Go to Hardware', icon: HardDrive, action: (nav) => nav('/hardware') },
  { label: 'Go to Settings', icon: Settings, action: (nav) => nav('/settings') },
  { label: 'Add Bookmark', icon: Plus, action: async (nav) => {
    const name = prompt('Bookmark name:');
    const url = prompt('URL:');
    if (name && url) await createBookmark({ name, url: url.startsWith('http') ? url : `https://${url}` });
  }},
  { label: 'New Note', icon: StickyNote, action: async (nav) => {
    await createNote({ title: 'Quick Note', content: '' });
    nav('/');
  }},
];

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query || query.length < 2) { setResults(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      globalSearch(query).then(setResults).catch(console.error);
    }, 200);
  }, [query]);

  if (!open) return null;

  const totalResults = results
    ? results.feeds.length + results.rigs.length + results.components.length + results.bookmarks.length + results.notes.length
    : 0;

  const go = (path) => { navigate(path); onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={18} style={{ color: 'var(--text-secondary)' }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search feeds, rigs, notes, bookmarks..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)' }}
            onKeyDown={e => e.key === 'Escape' && onClose()} />
          <kbd className="text-xs px-1.5 py-0.5 rounded border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Esc</kbd>
        </div>

        <div className="max-h-80 overflow-auto">
          {results && totalResults === 0 && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>No results found</p>
          )}

          {results?.feeds?.length > 0 && (
            <Section icon={Rss} title="Articles">
              {results.feeds.map(item => (
                <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
                  className="block px-4 py-2 hover:bg-white/5 text-sm"
                  style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                  {item.title}
                  <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{item.feed_title}</span>
                </a>
              ))}
            </Section>
          )}

          {results?.rigs?.length > 0 && (
            <Section icon={HardDrive} title="Rigs">
              {results.rigs.map(rig => (
                <button key={rig.id} onClick={() => go('/hardware')}
                  className="block w-full text-left px-4 py-2 hover:bg-white/5 text-sm"
                  style={{ color: 'var(--text-primary)' }}>
                  {rig.name}
                  {rig.description && <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{rig.description}</span>}
                </button>
              ))}
            </Section>
          )}

          {results?.components?.length > 0 && (
            <Section icon={Cpu} title="Components">
              {results.components.map(c => (
                <button key={c.id} onClick={() => go('/hardware')}
                  className="block w-full text-left px-4 py-2 hover:bg-white/5 text-sm"
                  style={{ color: 'var(--text-primary)' }}>
                  {c.name} {c.model && `(${c.model})`}
                  <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{c.category} · {c.rig_name}</span>
                </button>
              ))}
            </Section>
          )}

          {results?.bookmarks?.length > 0 && (
            <Section icon={Bookmark} title="Bookmarks">
              {results.bookmarks.map(b => (
                <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer"
                  className="block px-4 py-2 hover:bg-white/5 text-sm"
                  style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                  {b.name} <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{b.url}</span>
                </a>
              ))}
            </Section>
          )}

          {results?.notes?.length > 0 && (
            <Section icon={StickyNote} title="Notes">
              {results.notes.map(n => (
                <button key={n.id} onClick={() => go('/')}
                  className="block w-full text-left px-4 py-2 hover:bg-white/5 text-sm"
                  style={{ color: 'var(--text-primary)' }}>
                  {n.title}
                </button>
              ))}
            </Section>
          )}

          {/* Quick Actions — show when no query or query matches action */}
          {(!query || (results && totalResults === 0)) && (
            <Section icon={Zap} title="Quick Actions">
              {QUICK_ACTIONS.filter(a => !query || a.label.toLowerCase().includes(query.toLowerCase())).map((action, i) => (
                <button key={i} onClick={() => { action.action(navigate); onClose(); }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-white/5 text-sm"
                  style={{ color: 'var(--text-primary)' }}>
                  <action.icon size={14} style={{ color: 'var(--accent)' }} />
                  {action.label}
                </button>
              ))}
            </Section>
          )}

          {!results && !query && (
            <p className="text-xs text-center pb-3" style={{ color: 'var(--text-secondary)' }}>Type to search or pick an action</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="px-4 py-1.5 text-xs font-medium flex items-center gap-1.5"
        style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)' }}>
        <Icon size={12} /> {title}
      </div>
      {children}
    </div>
  );
}
