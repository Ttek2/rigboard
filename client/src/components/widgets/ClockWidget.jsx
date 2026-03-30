import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';

function extractCity(tz) {
  const parts = tz.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
}

function formatTime(tz) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '--:--:--';
  }
}

function formatDate(tz) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

export default function ClockWidget({ config, onRemove, onConfigure }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const rawTimezones = config?.timezones || '';
  const timezones = rawTimezones
    .split(',')
    .map(tz => tz.trim())
    .filter(Boolean);

  // Default to local system time if nothing configured
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const displayZones = timezones.length > 0 ? timezones : [localTz];

  return (
    <WidgetWrapper title="Clocks" icon={Clock} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="space-y-3">
        {displayZones.map(tz => (
          <div key={tz} className="text-center">
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              {extractCity(tz)}
            </div>
            <div className="text-2xl font-bold font-mono mt-0.5" style={{ color: 'var(--text-primary)' }}>
              {formatTime(tz)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {formatDate(tz)}
            </div>
          </div>
        ))}
      </div>
    </WidgetWrapper>
  );
}
