import { useState, useEffect } from 'react';
import { HardDrive, AlertTriangle, Clock, Cpu, MonitorPlay, MemoryStick, DollarSign, Shield } from 'lucide-react';
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
          <HardDrive size={24} className="mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>No rigs yet</p>
          <button onClick={() => navigate('/hardware')}
            className="text-sm px-3 py-1 rounded-lg"
            style={{ color: 'var(--accent)' }}>
            Add your first rig
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rigs.map(rig => (
            <div key={rig.id} onClick={() => navigate('/hardware')}
              className="p-3 rounded-lg border cursor-pointer hover:border-cyan-500/50 transition-colors"
              style={{ borderColor: 'var(--border)' }}>

              {/* Rig name + component count */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{rig.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                  {rig.component_count} parts
                </span>
              </div>

              {/* Key specs */}
              <div className="space-y-1">
                {rig.gpu && (
                  <div className="flex items-center gap-2 text-xs">
                    <MonitorPlay size={11} style={{ color: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{rig.gpu}</span>
                  </div>
                )}
                {rig.cpu && (
                  <div className="flex items-center gap-2 text-xs">
                    <Cpu size={11} style={{ color: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{rig.cpu}</span>
                  </div>
                )}
                {rig.ram && (
                  <div className="flex items-center gap-2 text-xs">
                    <MemoryStick size={11} style={{ color: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{rig.ram}</span>
                  </div>
                )}
              </div>

              {/* Cost + status row */}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {rig.total_cost > 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <DollarSign size={10} /> {rig.currency} {rig.total_cost.toFixed(0)}
                  </span>
                )}
                {rig.overdue_count > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle size={10} /> {rig.overdue_count} overdue
                  </span>
                )}
                {rig.expiring_warranties > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orange-400">
                    <Shield size={10} /> {rig.expiring_warranties} warranty expiring
                  </span>
                )}
                {rig.next_maintenance && rig.overdue_count === 0 && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <Clock size={10} /> {rig.next_maintenance.task_name} {formatDistanceToNow(new Date(rig.next_maintenance.next_due), { addSuffix: true })}
                  </span>
                )}
              </div>

              {rig.description && (
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>{rig.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
