import { useState, useEffect, useRef } from 'react';
import { StickyNote } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { createNote, updateNote } from '../../api';

const COLORS = {
  yellow: { bg: '#fef9c3', text: '#713f12' },
  pink: { bg: '#fce7f3', text: '#831843' },
  green: { bg: '#dcfce7', text: '#14532d' },
  blue: { bg: '#dbeafe', text: '#1e3a5f' },
  purple: { bg: '#f3e8ff', text: '#581c87' },
};

export default function StickyNoteWidget({ config, onRemove, onConfigure }) {
  const [content, setContent] = useState('');
  const noteIdRef = useRef(null);
  const debounceRef = useRef(null);
  const initRef = useRef(false);

  const colorName = config?.color || 'yellow';
  const palette = COLORS[colorName] || COLORS.yellow;

  // Create or load a note on first mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (config?.note_id) {
      noteIdRef.current = config.note_id;
      // Fetch existing note content
      fetch(`/api/v1/notes`)
        .then(r => r.json())
        .then(notes => {
          const found = notes.find(n => n.id === config.note_id);
          if (found) setContent(found.content || '');
        })
        .catch(console.error);
    } else {
      createNote({ title: 'Sticky Note', content: '' })
        .then(note => {
          noteIdRef.current = note.id;
        })
        .catch(console.error);
    }
  }, [config?.note_id]);

  const handleChange = (value) => {
    setContent(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (noteIdRef.current) {
        updateNote(noteIdRef.current, { content: value }).catch(console.error);
      }
    }, 500);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return (
    <WidgetWrapper title="Sticky Note" icon={StickyNote} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="h-full flex flex-col -m-3 -mt-3">
        <textarea
          value={content}
          onChange={e => handleChange(e.target.value)}
          className="flex-1 w-full resize-none outline-none p-3 text-sm leading-relaxed"
          style={{
            backgroundColor: palette.bg,
            color: palette.text,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
          placeholder="Type your note here..."
        />
      </div>
    </WidgetWrapper>
  );
}
