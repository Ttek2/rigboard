import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';

export default function CalendarWidget({ config, onRemove, onConfigure }) {
  const now = new Date();

  return (
    <WidgetWrapper title="Calendar" icon={CalendarIcon} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="text-center py-2">
        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          {format(now, 'EEEE')}
        </div>
        <div className="text-4xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
          {format(now, 'd')}
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {format(now, 'MMMM yyyy')}
        </div>
      </div>
    </WidgetWrapper>
  );
}
