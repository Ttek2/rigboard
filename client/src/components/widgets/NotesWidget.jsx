import { useState, useEffect, useRef, useCallback } from 'react';
import { StickyNote, Plus, Trash2, Pin, Eye, Edit3, Search } from 'lucide-react';
import { marked } from 'marked';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getNotes, createNote, updateNote, deleteNote } from '../../api';

marked.setOptions({ breaks: true, gfm: true });

export default function NotesWidget({ config, onRemove, onConfigure }) {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [filter, setFilter] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const debounceRef = useRef(null);
  const activeNoteRef = useRef(null);

  // Current active note from the list
  const activeNote = notes.find(n => n.id === activeId) || null;

  // Keep ref in sync for debounce callbacks
  useEffect(() => { activeNoteRef.current = activeNote; }, [activeNote]);

  const load = useCallback(() => {
    getNotes().then(n => {
      setNotes(n);
      setActiveId(prev => {
        if (prev && n.some(note => note.id === prev)) return prev;
        return n.length > 0 ? n[0].id : null;
      });
    }).catch(console.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveField = useCallback((id, field, value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = activeNoteRef.current;
      if (current && current.id === id) {
        updateNote(id, { ...current, [field]: value }).catch(console.error);
      }
    }, 500);
  }, []);

  const handleContentChange = (content) => {
    setNotes(prev => prev.map(n => n.id === activeId ? { ...n, content } : n));
    saveField(activeId, 'content', content);
  };

  const handleTitleChange = (title) => {
    setNotes(prev => prev.map(n => n.id === activeId ? { ...n, title } : n));
    saveField(activeId, 'title', title);
  };

  const handleAdd = async () => {
    const note = await createNote({ title: 'New Note', content: '' });
    setNotes(prev => [note, ...prev]);
    setActiveId(note.id);
    setPreview(false);
  };

  const handleDelete = async () => {
    if (!activeId) return;
    await deleteNote(activeId);
    setActiveId(null);
    load();
  };

  const handleTogglePin = async () => {
    if (!activeNote) return;
    const toggled = { ...activeNote, is_pinned: activeNote.is_pinned ? 0 : 1 };
    setNotes(prev => prev.map(n => n.id === activeId ? toggled : n));
    await updateNote(activeId, toggled);
    load();
  };

  const filteredNotes = filter
    ? notes.filter(n => (n.title || '').toLowerCase().includes(filter.toLowerCase()) || (n.content || '').toLowerCase().includes(filter.toLowerCase()))
    : notes;

  const wordCount = activeNote?.content ? activeNote.content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <WidgetWrapper title="Notes" icon={StickyNote} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="flex gap-2 h-full">
        {/* Sidebar */}
        <div className="w-28 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 mb-1">
            <button onClick={handleAdd}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--accent)' }}>
              <Plus size={10} /> New
            </button>
            <button onClick={() => setShowSearch(!showSearch)}
              className="p-1 rounded" style={{ color: showSearch ? 'var(--accent)' : 'var(--text-secondary)' }}>
              <Search size={11} />
            </button>
          </div>

          {showSearch && (
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..."
              className="w-full px-2 py-1 rounded border text-[10px] mb-1"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          )}

          <div className="flex-1 overflow-auto space-y-0.5">
            {filteredNotes.map(n => (
              <button key={n.id} onClick={() => { setActiveId(n.id); setPreview(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${activeId === n.id ? 'font-medium' : ''}`}
                style={{
                  color: activeId === n.id ? 'var(--accent)' : 'var(--text-secondary)',
                  backgroundColor: activeId === n.id ? 'var(--accent)11' : 'transparent',
                }}>
                <div className="flex items-center gap-1">
                  {n.is_pinned ? <Pin size={8} style={{ color: 'var(--accent)' }} /> : null}
                  <span className="truncate">{n.title || 'Untitled'}</span>
                </div>
                <p className="text-[9px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {n.content ? n.content.slice(0, 40) : 'Empty'}
                </p>
              </button>
            ))}
            {filteredNotes.length === 0 && (
              <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-secondary)' }}>
                {filter ? 'No matches' : 'No notes yet'}
              </p>
            )}
          </div>

          <div className="text-[9px] pt-1 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {activeNote ? (
            <div className="h-full flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center gap-1 mb-1">
                <input value={activeNote.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-medium outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="Note title..." />
                <button onClick={() => setPreview(!preview)}
                  className="p-1 rounded opacity-50 hover:opacity-100"
                  style={{ color: preview ? 'var(--accent)' : 'var(--text-secondary)' }}
                  title={preview ? 'Edit' : 'Preview markdown'}>
                  {preview ? <Edit3 size={12} /> : <Eye size={12} />}
                </button>
                <button onClick={handleTogglePin}
                  className="p-1 rounded opacity-50 hover:opacity-100"
                  style={{ color: activeNote.is_pinned ? 'var(--accent)' : 'var(--text-secondary)' }}
                  title={activeNote.is_pinned ? 'Unpin' : 'Pin'}>
                  <Pin size={12} />
                </button>
                <button onClick={handleDelete}
                  className="p-1 rounded opacity-50 hover:opacity-100"
                  style={{ color: 'var(--text-secondary)' }}
                  title="Delete note">
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Content */}
              {preview ? (
                <div className="flex-1 overflow-auto text-sm prose prose-invert prose-sm max-w-none select-text"
                  style={{ color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(activeNote.content || '*Empty note*') }} />
              ) : (
                <textarea value={activeNote.content || ''}
                  onChange={e => handleContentChange(e.target.value)}
                  className="flex-1 w-full bg-transparent text-sm outline-none resize-none font-mono select-text"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="Write markdown... (supports **bold**, *italic*, # headings, - lists, ```code```)" />
              )}

              {/* Status bar */}
              <div className="flex items-center justify-between pt-1 border-t text-[9px]" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
                {activeNote.updated_at && (
                  <span>Edited {formatDistanceToNow(new Date(activeNote.updated_at), { addSuffix: true })}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <StickyNote size={24} className="mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Select a note or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
}
