import { useState, useEffect } from 'react';
import { Gauge, Play, Loader } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { runSpeedtest, getSpeedtestHistory } from '../../api';

export default function SpeedtestWidget({ config, onRemove, onConfigure }) {
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    getSpeedtestHistory().then(h => {
      setHistory(h);
      if (h.length > 0) setLatest(h[0]);
    }).catch(() => {});
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runSpeedtest();
      setLatest(result);
      getSpeedtestHistory().then(setHistory).catch(() => {});
    } catch {}
    setRunning(false);
  };

  const maxSpeed = Math.max(...history.map(h => h.download_mbps || 0), latest?.download_mbps || 0, 1);

  return (
    <WidgetWrapper title="Speed Test" icon={Gauge} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="space-y-3">
        {/* Latest result */}
        {latest ? (
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{latest.download_mbps} <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>Mbps</span></p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Latency: {latest.latency_ms}ms &middot; {latest.server}
              {latest.tested_at && <> &middot; {formatDistanceToNow(new Date(latest.tested_at), { addSuffix: true })}</>}
            </p>
          </div>
        ) : (
          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>No results yet</p>
        )}

        {/* Run button */}
        <button onClick={handleRun} disabled={running}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}>
          {running ? <><Loader size={14} className="animate-spin" /> Running...</> : <><Play size={14} /> Run Speed Test</>}
        </button>

        {/* Mini history chart */}
        {history.length > 1 && (
          <div>
            <p className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>History</p>
            <div className="flex items-end gap-px" style={{ height: 40 }}>
              {history.slice(0, 20).reverse().map((h, i) => (
                <div key={i} className="flex-1 rounded-t" title={`${h.download_mbps} Mbps`}
                  style={{
                    height: `${Math.max((h.download_mbps / maxSpeed) * 100, 5)}%`,
                    backgroundColor: 'var(--accent)',
                    opacity: 0.4 + (i / 20) * 0.6,
                  }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </WidgetWrapper>
  );
}
