import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { getGpuStats } from '../../api';

function Bar({ percent, color }) {
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(percent || 0, 100)}%`, backgroundColor: color || 'var(--accent)' }} />
    </div>
  );
}

function tempColor(t) {
  if (t > 85) return '#ef4444';
  if (t > 70) return '#f59e0b';
  return '#22c55e';
}

export default function GpuWidget({ config, onRemove, onConfigure }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => getGpuStats().then(setData).catch(() => {});
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <WidgetWrapper title="GPU" icon={Cpu} onRemove={onRemove} onConfigure={onConfigure}>
      {!data ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : !data.detected ? (
        <div className="text-center py-2">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No GPU detected</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Requires /sys mount in Docker. For NVIDIA, install NVIDIA Container Toolkit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.gpus.map((gpu, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{gpu.name || data.vendor?.toUpperCase()}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent)11', color: 'var(--accent)' }}>{data.vendor}</span>
              </div>

              {/* Temperature */}
              {gpu.temp_c != null && (
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color: 'var(--text-secondary)' }}>Temp</span>
                    <span style={{ color: tempColor(gpu.temp_c) }}>{gpu.temp_c}°C</span>
                  </div>
                  <Bar percent={gpu.temp_c} color={tempColor(gpu.temp_c)} />
                </div>
              )}

              {/* Usage */}
              {gpu.usage_percent != null && (
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color: 'var(--text-secondary)' }}>Usage</span>
                    <span style={{ color: 'var(--text-primary)' }}>{gpu.usage_percent}%</span>
                  </div>
                  <Bar percent={gpu.usage_percent} color={gpu.usage_percent > 80 ? '#ef4444' : gpu.usage_percent > 50 ? '#f59e0b' : '#22c55e'} />
                </div>
              )}

              {/* VRAM */}
              {gpu.vram_total_mb > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span style={{ color: 'var(--text-secondary)' }}>VRAM</span>
                    <span style={{ color: 'var(--text-primary)' }}>{gpu.vram_used_mb} / {gpu.vram_total_mb} MB</span>
                  </div>
                  <Bar percent={(gpu.vram_used_mb / gpu.vram_total_mb) * 100} />
                </div>
              )}

              {/* Fan + Power */}
              <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {gpu.fan_speed_percent != null && <span>Fan: {gpu.fan_speed_percent}%</span>}
                {gpu.power_watts != null && <span>Power: {gpu.power_watts}W</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetWrapper>
  );
}
