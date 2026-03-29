import { useState, useEffect } from 'react';
import { Home } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getHAEntities } from '../../api';

export default function HomeAssistantWidget({ config, onRemove, onConfigure }) {
  const [entities, setEntities] = useState([]);
  const [error, setError] = useState(null);
  const filterIds = config?.entities ? config.entities.split(',').map(s => s.trim()).filter(Boolean) : [];

  useEffect(() => {
    getHAEntities().then(data => {
      if (data.error) { setError(data.error); return; }
      setEntities(data);
    }).catch(e => setError(e.message));
    const interval = setInterval(() => {
      getHAEntities().then(data => {
        if (!data.error) setEntities(data);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filterIds.length > 0
    ? entities.filter(e => filterIds.some(id => e.entity_id.includes(id)))
    : entities.slice(0, 10);

  return (
    <WidgetWrapper title="Home Assistant" icon={Home} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {entities.length > 0 ? 'No matching entities. Configure entity IDs in widget settings.' : 'No entities found. Configure HA in Settings (ha_url, ha_token).'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(e => (
            <div key={e.entity_id} className="flex items-center justify-between px-2 py-1.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-primary)' }}>
              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {e.name}
              </span>
              <span className="text-sm font-mono flex-shrink-0 ml-2" style={{ color: 'var(--accent)' }}>
                {e.state}{e.unit ? ` ${e.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
