import { useState, useEffect } from 'react';
import { Rss, Plus, Trash2, RefreshCw, ExternalLink, Star, BookOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getFeeds, addFeed, deleteFeed, refreshFeed, getLatestFeedItems, toggleStarItem, getStarredItems } from '../api';
import ArticleReader from '../components/ArticleReader';

export default function FeedsPage() {
  const [feeds, setFeeds] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [readerItemId, setReaderItemId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    getFeeds().then(setFeeds).catch(console.error);
    if (selectedGroup === '__starred') {
      getStarredItems().then(setItems).catch(console.error);
    } else {
      getLatestFeedItems(50, selectedGroup).then(setItems).catch(console.error);
    }
  };
  useEffect(() => { load(); }, [selectedGroup]);

  const groups = [...new Set(feeds.map(f => f.group_name))];

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      await addFeed({ url: newUrl, group_name: newGroup || 'Uncategorized' });
      setNewUrl(''); setNewGroup(''); setShowAdd(false);
      load();
    } catch (err) {
      setError(err.message);
    }
    setAdding(false);
  };

  const handleRefresh = async (id) => {
    await refreshFeed(id);
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar: Feed management */}
      <div className="lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Feeds</h2>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white"
            style={{ backgroundColor: 'var(--accent)' }}>
            <Plus size={14} /> Add Feed
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="mb-4 p-4 rounded-xl border space-y-3"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
              placeholder="Feed URL (RSS/Atom)" required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <input value={newGroup} onChange={e => setNewGroup(e.target.value)}
              placeholder="Group (optional)"
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={adding}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent)', opacity: adding ? 0.7 : 1 }}>
              {adding ? 'Adding...' : 'Add Feed'}
            </button>
          </form>
        )}

        {/* Group filters */}
        <div className="flex flex-wrap gap-1 mb-3">
          <button onClick={() => setSelectedGroup(null)}
            className={`px-2 py-1 rounded text-xs ${!selectedGroup ? 'font-medium' : ''}`}
            style={{ color: !selectedGroup ? 'var(--accent)' : 'var(--text-secondary)', backgroundColor: !selectedGroup ? 'var(--accent)11' : 'transparent' }}>
            All
          </button>
          <button onClick={() => setSelectedGroup('__starred')}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${selectedGroup === '__starred' ? 'font-medium' : ''}`}
            style={{ color: selectedGroup === '__starred' ? '#f59e0b' : 'var(--text-secondary)', backgroundColor: selectedGroup === '__starred' ? '#f59e0b11' : 'transparent' }}>
            <Star size={10} /> Starred
          </button>
          {groups.map(g => (
            <button key={g} onClick={() => setSelectedGroup(g)}
              className={`px-2 py-1 rounded text-xs ${selectedGroup === g ? 'font-medium' : ''}`}
              style={{ color: selectedGroup === g ? 'var(--accent)' : 'var(--text-secondary)', backgroundColor: selectedGroup === g ? 'var(--accent)11' : 'transparent' }}>
              {g}
            </button>
          ))}
        </div>

        {/* Feed list */}
        <div className="space-y-1">
          {feeds.filter(f => !selectedGroup || f.group_name === selectedGroup).map(feed => (
            <div key={feed.id} className="flex items-center gap-2 p-2 rounded-lg border group"
              style={{ borderColor: 'var(--border)' }}>
              {feed.favicon_url && <img src={feed.favicon_url} alt="" className="w-4 h-4 rounded-sm" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{feed.title || feed.url}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{feed.group_name}</p>
              </div>
              <button onClick={() => handleRefresh(feed.id)}
                className="opacity-0 group-hover:opacity-50 hover:!opacity-100 p-1"
                style={{ color: 'var(--text-secondary)' }}>
                <RefreshCw size={12} />
              </button>
              <button onClick={async () => { await deleteFeed(feed.id); load(); }}
                className="opacity-0 group-hover:opacity-50 hover:!opacity-100 p-1"
                style={{ color: 'var(--text-secondary)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main: Feed items */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {selectedGroup === '__starred' ? 'Starred Articles' : selectedGroup ? `${selectedGroup} Articles` : 'Latest Articles'}
          </h2>
        </div>
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg border hover:border-cyan-500/50 transition-colors group"
              style={{ borderColor: 'var(--border)' }}>
              {item.favicon_url && <img src={item.favicon_url} alt="" className="w-4 h-4 mt-1 rounded-sm flex-shrink-0" />}
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0" style={{ textDecoration: 'none' }}>
                <p className="text-sm font-medium group-hover:text-cyan-400 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </p>
                {item.summary && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{item.summary}</p>
                )}
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {item.feed_title}
                  {item.published_at && ` · ${formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}`}
                </p>
              </a>
              <button onClick={() => setReaderItemId(item.id)}
                className="mt-1 p-1 flex-shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
                style={{ color: 'var(--text-secondary)' }} title="Read inline">
                <BookOpen size={14} />
              </button>
              <button onClick={async () => { await toggleStarItem(item.id); load(); }}
                className="mt-1 p-1 flex-shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
                style={{ color: item.starred_at ? '#f59e0b' : 'var(--text-secondary)' }}>
                <Star size={14} fill={item.starred_at ? '#f59e0b' : 'none'} />
              </button>
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} className="mt-1.5 flex-shrink-0 opacity-0 group-hover:opacity-50" style={{ color: 'var(--text-secondary)' }} />
              </a>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>No articles yet. Add some feeds to get started.</p>
          )}
        </div>
        <ArticleReader itemId={readerItemId} onClose={() => setReaderItemId(null)} />
      </div>
    </div>
  );
}
