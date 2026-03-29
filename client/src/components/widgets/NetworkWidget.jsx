import { useState, useEffect } from 'react';
import { Wifi } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getNetworkInfo } from '../../api';

export default function NetworkWidget({ config, onRemove, onConfigure }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    getNetworkInfo().then(setInfo).catch(console.error);
    const i = setInterval(() => { getNetworkInfo().then(setInfo).catch(() => {}); }, 60000);
    return () => clearInterval(i);
  }, []);

  return (
    <WidgetWrapper title="Network" icon={Wifi} onRemove={onRemove} onConfigure={onConfigure}>
      {!info ? <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p> : (
        <div className="space-y-2">
          <Row label="WAN IP" value={info.wan || 'Unknown'} />
          {info.local?.map((l, i) => (
            <Row key={i} label={l.interface} value={l.ip} />
          ))}
          <Row label="Gateway" value={info.gateway || 'Unknown'} />
          <Row label="DNS" value={info.dns?.join(', ') || 'Unknown'} />
          {Object.entries(info.latency || {}).map(([host, ms]) => (
            <Row key={host} label={`Ping ${host}`} value={ms !== null ? `${ms}ms` : 'Timeout'} />
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
