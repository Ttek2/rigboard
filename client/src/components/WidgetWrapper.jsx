import { GripVertical, X, Settings } from 'lucide-react';

export default function WidgetWrapper({ title, icon: Icon, children, onRemove, onConfigure }) {
  return (
    <div className="group h-full flex flex-col rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b cursor-move widget-drag-handle"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          <GripVertical size={14} style={{ color: 'var(--text-secondary)' }} />
          {Icon && <Icon size={14} style={{ color: 'var(--accent)' }} />}
          {title}
        </div>
        <div className="flex items-center gap-0.5">
          {onConfigure && (
            <button
              onClick={(e) => { e.stopPropagation(); onConfigure(); }}
              className="p-1 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Settings size={13} />
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
    </div>
  );
}
