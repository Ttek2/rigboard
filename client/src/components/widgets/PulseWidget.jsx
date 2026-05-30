import { useState, useEffect } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, ExternalLink, HardDrive, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getPulse, getRigMatchKeywords, getPulseCreator } from '../../api';

const TTEK2 = 'https://ttek2.com';

// ttek2's current sentiment scale (5 levels + neutral) → a single colored dot.
const SENTIMENT = {
  positive:        { dot: '#10b981', label: 'Positive' },
  mostly_positive: { dot: '#0d9488', label: 'Mostly positive' },
  mixed:           { dot: '#f59e0b', label: 'Mixed' },
  neutral:         { dot: '#64748b', label: 'Neutral' },
  mostly_negative: { dot: '#e87161', label: 'Mostly negative' },
  negative:        { dot: '#ef4444', label: 'Negative' },
};
const SEVERITY = { alert: '#ef4444', notable: '#f59e0b', info: 'transparent' };

const topicUrl = (t) => t.url || `${TTEK2}/topics/${t.slug}`;

function Momentum({ direction }) {
  if (direction === 'rising') return <TrendingUp size={12} style={{ color: '#10b981' }} />;
  if (direction === 'falling') return <TrendingDown size={12} style={{ color: '#94a3b8' }} />;
  if (direction === 'new') return <span className="text-[8px] font-bold px-1 rounded" style={{ backgroundColor: '#e53935', color: '#fff' }}>NEW</span>;
  return <Minus size={12} style={{ color: '#64748b' }} />;
}

function Sparkline({ points, width = 260, height = 28 }) {
  const scores = (points || []).map(p => p.score).filter(s => typeof s === 'number');
  if (scores.length < 2) return null;
  const min = Math.min(...scores), max = Math.max(...scores) || 1, range = max - min || 1;
  const coords = scores.map((s, i) => `${(i / (scores.length - 1)) * width},${height - ((s - min) / range) * height}`).join(' ');
  const up = scores[scores.length - 1] >= scores[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <polyline points={coords} fill="none" stroke={up ? '#10b981' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Expanded detail for a topic — pulls richer per-topic data from ttek2's
// /creator endpoint on demand (stats, score history, grouped source links).
function TopicDetail({ topic, isInRig }) {
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    getPulseCreator(topic.slug)
      .then(d => { if (alive && d?.ok) setCreator(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [topic.slug]);

  const p = topic.pulse || {};
  const bySource = creator?.feed_items_by_source;
  const flat = creator?.feed_items || topic.feed_items || [];

  return (
    <div className="px-3 pb-3 pt-1 space-y-2" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {p.summary && <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{p.summary}</p>}
      {p.key_takeaway && <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.key_takeaway}</p>}

      {p.themes?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.themes.map((t, i) => <span key={i} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{t}</span>)}
        </div>
      )}

      {creator?.stats && (
        <div className="grid grid-cols-4 gap-1">
          {[
            [creator.stats.total_discussions ?? '—', 'posts'],
            [creator.stats.platform_count ?? '—', 'platforms'],
            [creator.stats.sentiment_score != null ? `${creator.stats.sentiment_score}%` : '—', 'sentiment'],
            [creator.stats.trending_duration || '—', 'trending'],
          ].map(([v, l], i) => (
            <div key={i} className="p-1 rounded text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{v}</div>
              <div className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}
      {creator?.history?.data_points?.length > 1 && (
        <div className="p-1.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <Sparkline points={creator.history.data_points} />
        </div>
      )}

      {p.price_mentions?.length > 0 && (
        <div className="space-y-1">
          {p.price_mentions.map((pm, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 rounded text-[11px]" style={{ backgroundColor: isInRig ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.06)' }}>
              <DollarSign size={10} style={{ color: '#059669' }} />
              <span className="font-bold" style={{ color: '#059669' }}>{pm.price}</span>
              <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{pm.product}</span>
              <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{pm.context}</span>
            </div>
          ))}
        </div>
      )}

      {topic.sources?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topic.sources.map((s, i) => {
            const name = typeof s === 'string' ? s : s.name;
            const url = typeof s === 'string' ? null : s.url;
            return url
              ? <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--accent)', textDecoration: 'none' }}>{name}</a>
              : <span key={i} className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{name}</span>;
          })}
        </div>
      )}

      {loading && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Loading sources…</p>}
      {bySource
        ? Object.entries(bySource).slice(0, 6).map(([src, items]) => (
            <div key={src}>
              <div className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{src}</div>
              {(items || []).slice(0, 4).map((it, i) => (
                <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] leading-snug truncate" style={{ color: 'var(--accent)', textDecoration: 'none' }}>· {it.title}</a>
              ))}
            </div>
          ))
        : flat.slice(0, 8).map((it, i) => (
            <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="block text-[11px] leading-snug truncate" style={{ color: 'var(--accent)', textDecoration: 'none' }}>· {it.title}</a>
          ))
      }

      <a href={topicUrl(topic)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
        More on ttek2.com <ExternalLink size={9} />
      </a>
    </div>
  );
}

function TopicRow({ topic, maxScore, rigKeywords, comfortable, expanded, onToggle }) {
  const p = topic.pulse || {};
  const sentiment = SENTIMENT[p.sentiment] || SENTIMENT.neutral;
  const severity = p.severity || 'info';
  const isInRig = rigKeywords.length > 0 && rigKeywords.some(kw =>
    (topic.name || '').toLowerCase().includes(kw) ||
    (topic.slug || '').toLowerCase().includes(kw) ||
    (p.themes || []).some(t => (t || '').toLowerCase().includes(kw))
  );

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)', borderLeft: `2px solid ${SEVERITY[severity] || 'transparent'}` }}>
      <button onClick={onToggle} className="w-full text-left px-2 py-1.5 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <Momentum direction={topic.momentum?.direction} />
          <span className="text-[13px] font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>{topic.name}</span>
          {isInRig && <HardDrive size={10} style={{ color: 'var(--accent)' }} />}
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sentiment.dot }} title={sentiment.label} />
          <span className="text-[11px] font-mono w-9 text-right" style={{ color: 'var(--text-secondary)' }}>{(topic.score ?? 0).toFixed(1)}</span>
        </div>
        <div className="h-0.5 w-full rounded-full mt-1" style={{ backgroundColor: 'var(--border)' }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(((topic.score ?? 0) / maxScore) * 100, 100)}%`, backgroundColor: sentiment.dot }} />
        </div>
        {comfortable && (p.key_takeaway || p.summary) && (
          <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{p.key_takeaway || p.summary}</p>
        )}
      </button>
      {expanded && <TopicDetail topic={topic} isInRig={isInRig} />}
    </div>
  );
}

export default function PulseWidget({ config, onRemove, onConfigure }) {
  const [pulse, setPulse] = useState(null);
  const [rigKeywords, setRigKeywords] = useState([]);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('topics');
  const [expandedSlug, setExpandedSlug] = useState(null);

  const comfortable = String(config?.compact) === 'false';
  const maxTopics = Number(config?.maxTopics) || 20;

  useEffect(() => {
    getPulse().then(d => { if (d.ok) setPulse(d); else setError('Failed to load'); }).catch(e => setError(e.message));
    getRigMatchKeywords().then(d => setRigKeywords(d.keywords || [])).catch(() => {});
    const iv = setInterval(() => { getPulse().then(d => { if (d.ok) setPulse(d); }).catch(() => {}); }, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const data = pulse?.data;
  const topics = (data?.topics || []).filter(t => t && t.slug && t.name && typeof t.score === 'number').slice(0, maxTopics);
  const maxScore = topics.length ? Math.max(...topics.map(t => t.score)) : 1;
  const deals = data?.deals || [];
  const alerts = data?.price_alerts || [];
  const velocity = data?.velocity || [];

  const tabs = [
    { id: 'topics', label: 'Topics', n: topics.length },
    deals.length ? { id: 'deals', label: 'Deals', n: deals.length } : null,
    alerts.length ? { id: 'alerts', label: 'Alerts', n: alerts.length } : null,
    velocity.length ? { id: 'velocity', label: 'Velocity', n: velocity.length } : null,
  ].filter(Boolean);

  return (
    <WidgetWrapper title="Community Pulse" icon={Zap} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? (
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Trending data unavailable</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Will retry in 5 minutes</p>
        </div>
      ) : !pulse ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading pulse…</p>
      ) : (
        <div className="flex flex-col h-full min-h-0">
          {/* Header strip */}
          <div className="flex items-center gap-2 px-1 pb-1 text-[10px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
            <span>{data.topic_count || topics.length} topics</span>
            {data.sources_total != null && <span>· {data.sources_healthy}/{data.sources_total} sources</span>}
            {data.refreshed_at && <span className="ml-auto">{formatDistanceToNow(new Date(data.refreshed_at), { addSuffix: true })}</span>}
          </div>

          {/* Tabs (only when there's more than just topics) */}
          {tabs.length > 1 && (
            <div className="flex gap-1 px-1 pb-1 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold transition-colors"
                  style={{ color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)', backgroundColor: tab === t.id ? 'var(--accent)11' : 'transparent' }}>
                  {t.label} <span className="opacity-50">{t.n}</span>
                </button>
              ))}
            </div>
          )}

          {/* Body — scrolls inside the widget so nothing falls below the fold */}
          <div className="flex-1 overflow-auto min-h-0 mt-1">
            {tab === 'topics' && topics.map(t => (
              <TopicRow key={t.slug} topic={t} maxScore={maxScore} rigKeywords={rigKeywords} comfortable={comfortable}
                expanded={expandedSlug === t.slug}
                onToggle={() => setExpandedSlug(expandedSlug === t.slug ? null : t.slug)} />
            ))}

            {tab === 'deals' && deals.map((d, i) => (
              <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between px-2 py-1.5 border-b hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--border)', textDecoration: 'none' }}>
                <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)' }}>{d.title}</span>
                <span className="text-[10px] ml-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{d.source}</span>
              </a>
            ))}

            {tab === 'alerts' && alerts.map((a, i) => {
              const isRig = rigKeywords.some(kw => (a.topic || '').toLowerCase().includes(kw) || (a.product || '').toLowerCase().includes(kw));
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 border-b text-xs"
                  style={{ borderColor: 'var(--border)', backgroundColor: isRig ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
                  <span className="font-bold" style={{ color: '#059669' }}>{a.price}</span>
                  {isRig && <HardDrive size={9} style={{ color: 'var(--accent)' }} />}
                  <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.product}</span>
                  <span className="flex-1 truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>{a.context}</span>
                </div>
              );
            })}

            {tab === 'velocity' && (
              <div className="flex flex-wrap gap-1 p-2">
                {velocity.slice(0, 24).map((v, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: 'var(--accent)11', color: 'var(--accent)' }}>
                    {v.keyword} <span style={{ color: 'var(--text-secondary)' }}>{v.mention_count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Attribution (required) */}
          {pulse.attribution && (
            <a href={pulse.attribution.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] pt-1 mt-1 border-t flex-shrink-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              {pulse.attribution.logo && <img src={pulse.attribution.logo} alt="" className="w-3 h-3" />}
              {pulse.attribution.text}
            </a>
          )}
        </div>
      )}
    </WidgetWrapper>
  );
}
