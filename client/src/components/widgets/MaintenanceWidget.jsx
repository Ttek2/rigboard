import { useState, useEffect } from 'react';
import { Wrench, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getUpcomingMaintenance } from '../../api';

export default function MaintenanceWidget({ config, onRemove, onConfigure }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getUpcomingMaintenance().then(setItems).catch(console.error);
    const interval = setInterval(() => {
      getUpcomingMaintenance().then(setItems).catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <WidgetWrapper title="Maintenance" icon={Wrench} onRemove={onRemove} onConfigure={onConfigure}>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No scheduled maintenance. Add some in the Hardware page.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id}
              className={`p-2.5 rounded-lg border ${item.is_overdue ? 'border-amber-500/50' : ''}`}
              style={{ borderColor: item.is_overdue ? undefined : 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {item.task_name}
                </span>
                {item.is_overdue ? (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle size={12} /> Overdue
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Clock size={12} />
                    {formatDistanceToNow(new Date(item.next_due), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {item.component_name} ({item.category}) · {item.rig_name}
              </p>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
