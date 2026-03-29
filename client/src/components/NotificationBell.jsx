import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getNotifications, getUnreadCount, markAllRead, markNotificationRead, clearNotifications } from '../api';

const TYPE_COLORS = { maintenance: '#f59e0b', warranty: '#f97316', service: '#ef4444' };

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => {
    getUnreadCount().then(r => setUnread(r.count)).catch(() => {});
    if (open) getNotifications().then(setNotifications).catch(() => {});
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) getNotifications().then(setNotifications).catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative p-2 rounded-lg hover:bg-white/5"
        style={{ color: 'var(--text-secondary)' }}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white bg-red-500">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-xl overflow-hidden z-50"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Notifications</span>
            <div className="flex gap-1">
              {unread > 0 && (
                <button onClick={async () => { await markAllRead(); load(); }}
                  className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }} title="Mark all read">
                  <Check size={14} />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={async () => { await clearNotifications(); load(); }}
                  className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }} title="Clear all">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-72 overflow-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-secondary)' }}>No notifications</p>
            ) : notifications.map(n => (
              <div key={n.id}
                className={`px-3 py-2 border-b hover:bg-white/5 cursor-pointer ${n.is_read ? 'opacity-60' : ''}`}
                style={{ borderColor: 'var(--border)' }}
                onClick={async () => { await markNotificationRead(n.id); load(); }}>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: n.is_read ? 'var(--border)' : TYPE_COLORS[n.type] || 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                    {n.message && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
