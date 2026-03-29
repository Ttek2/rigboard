import { useState, useEffect, useRef } from 'react';
import { StickyNote, Plus, Trash2, Pin, Eye, Edit3 } from 'lucide-react';
import { marked } from 'marked';
import WidgetWrapper from '../WidgetWrapper';
import { getNotes, createNote, updateNote, deleteNote } from '../../api';

marked.setOptions({ breaks: true, gfm: true });

export default function NotesWidget({ config, onRemove, onConfigure }) {
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  const [preview, setPreview] = useState(false);
  const debounceRef = useRef(null);

  const load = () => getNotes().then(n => { setNotes(n); if (!activeNote && n.length > 0) setActiveNote(n[0]); }).catch(console.error);
  useEffect(() => { load(); }, []);

  const handleContentChange = (content) => {
    setActiveNote(prev => ({ ...prev, content }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNote(activeNote.id, { ...activeNote, content }).catch(console.error);
    }, 500);
  };

  const handleAdd = async () => {
    const note = await createNote({ title: 'New Note', content: '' });
    setNotes(prev => [note, ...prev]);
    setActiveNote(note);
    setPreview(false);
  };

  return (
    <WidgetWrapper title="Notes" icon={StickyNote} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="flex gap-2 h-full">
        <div className="w-24 flex-shrink-0 space-y-1 overflow-auto">
          {notes.map(n => (
            <button key={n.id} onClick={() => { setActiveNote(n); setPreview(false); }}
              className={`w-full text-left px-2 py-1 rounded text-xs truncate ${activeNote?.id === n.id ? 'font-medium' : ''}`}
              style={{
                color: activeNote?.id === n.id ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: activeNote?.id === n.id ? 'var(--accent)11' : 'transparent',
              }}>
              {n.is_pinned ? '* ' : ''}{n.title || 'Untitled'}
            </button>
          ))}
          <button onClick={handleAdd}
            className="w-full flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ color: 'var(--text-secondary)' }}>
            <Plus size={10} /> New
          </button>
        </div>
        <div className="flex-1 min-w-0">
          {activeNote ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-1 mb-1">
                <input value={activeNote.title}
                  onChange={e => {
                    const title = e.target.value;
                    setActiveNote(prev => ({ ...prev, title }));
                    clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => {
                      updateNote(activeNote.id, { ...activeNote, title }).catch(console.error);
                    }, 500);
                  }}
                  className="flex-1 bg-transparent text-sm font-medium outline-none"
                  style={{ color: 'var(--text-primary)' }} />
                <button onClick={() => setPreview(!preview)}
                  className="p-1 rounded opacity-50 hover:opacity-100"
                  style={{ color: preview ? 'var(--accent)' : 'var(--text-secondary)' }}
                  title={preview ? 'Edit' : 'Preview markdown'}>
                  {preview ? <Edit3 size={12} /> : <Eye size={12} />}
                </button>
                <button onClick={async () => {
                    const toggled = { ...activeNote, is_pinned: activeNote.is_pinned ? 0 : 1 };
                    setActiveNote(toggled);
                    await updateNote(activeNote.id, toggled);
                    load();
                  }}
                  className="p-1 rounded opacity-50 hover:opacity-100"
                  style={{ color: activeNote.is_pinned ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  <Pin size={12} />
                </button>
                <button onClick={async () => { await deleteNote(activeNote.id); setActiveNote(null); load(); }}
                  className="p-1 rounded opacity-50 hover:opacity-100"
                  style={{ color: 'var(--text-secondary)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
              {preview ? (
                <div className="flex-1 overflow-auto text-sm prose prose-invert prose-sm max-w-none"
                  style={{ color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: marked.parse(activeNote.content || '') }} />
              ) : (
                <textarea value={activeNote.content || ''}
                  onChange={e => handleContentChange(e.target.value)}
                  className="flex-1 w-full bg-transparent text-sm outline-none resize-none font-mono"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="Write markdown..." />
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No notes yet</p>
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
}
