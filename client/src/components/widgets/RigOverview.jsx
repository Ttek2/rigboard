import { useState, useEffect } from 'react';
import { HardDrive, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getRigs } from '../../api';

export default function RigOverview({ config, onRemove, onConfigure }) {
  const [rigs, setRigs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getRigs().then(setRigs).catch(console.error);
  }, []);

  return (
    <WidgetWrapper title="My Rigs" icon={HardDrive} onRemove={onRemove} onConfigure={onConfigure}>
      {rigs.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>No rigs yet</p>
          <button onClick={() => navigate('/hardware')}
            className="text-sm px-3 py-1 rounded-lg"
            style={{ color: 'var(--accent)' }}>
            Add your first rig
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rigs.map(rig => (
            <div key={rig.id} onClick={() => navigate('/hardware')}
              className="p-2.5 rounded-lg border cursor-pointer hover:border-cyan-500/50 transition-colors"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{rig.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{rig.component_count} parts</span>
              </div>
              {rig.overdue_count > 0 && (
                <div className="flex items-center gap-1 text-xs text-amber-400">
                  <AlertTriangle size={12} />
                  {rig.overdue_count} overdue
                </div>
              )}
              {rig.next_maintenance && !rig.overdue_count && (
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Clock size={12} />
                  {rig.next_maintenance.task_name} · {formatDistanceToNow(new Date(rig.next_maintenance.next_due), { addSuffix: true })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
