import { useState, useEffect } from 'react';
import { Bookmark, Plus, Trash2, ExternalLink } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getBookmarks, createBookmark, deleteBookmark } from '../../api';
import { on } from '../../events';

export default function BookmarkWidget({ config, onRemove, onConfigure }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const load = () => getBookmarks().then(setBookmarks).catch(console.error);
  useEffect(() => { load(); }, []);
  useEffect(() => { const off = on('refresh:bookmarks', load); const off2 = on('refresh:all', load); return () => { off(); off2(); }; }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !url) return;
    await createBookmark({ name, url: url.startsWith('http') ? url : `https://${url}` });
    setName(''); setUrl(''); setAdding(false);
    load();
  };

  return (
    <WidgetWrapper title="Bookmarks" icon={Bookmark} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="space-y-1">
        {bookmarks.map(b => (
          <div key={b.id} className="flex items-center gap-2 group">
            <a href={b.url} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-sm transition-colors"
              style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
              <img src={`https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=16`}
                alt="" className="w-4 h-4 rounded-sm" />
              <span className="truncate">{b.name}</span>
              <ExternalLink size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-50" />
            </a>
            <button onClick={async () => { await deleteBookmark(b.id); load(); }}
              className="opacity-0 group-hover:opacity-50 hover:!opacity-100 p-1 rounded"
              style={{ color: 'var(--text-secondary)' }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <form onSubmit={handleAdd} className="mt-2 space-y-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
            className="w-full px-2 py-1 rounded border text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL"
            className="w-full px-2 py-1 rounded border text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <div className="flex gap-2">
            <button type="submit" className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>Add</button>
            <button type="button" onClick={() => setAdding(false)} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}>
          <Plus size={12} /> Add bookmark
        </button>
      )}
    </WidgetWrapper>
  );
}
