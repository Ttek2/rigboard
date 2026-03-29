import { useState, useEffect } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, ExternalLink, HardDrive, ChevronDown, ChevronRight, Link as LinkIcon, AlertTriangle, DollarSign, Newspaper } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { getPulse, getRigMatchKeywords, getPulseCreator } from '../../api';

// --- Sub-components ---

const SENTIMENT_COLORS = {
  positive: { bg: 'rgba(16,185,129,0.1)', text: '#059669', label: 'Positive' },
  mostly_positive: { bg: 'rgba(16,185,129,0.07)', text: '#0d9488', label: 'Mostly Positive' },
  mixed: { bg: 'rgba(245,158,11,0.1)', text: '#d97706', label: 'Mixed' },
  mostly_negative: { bg: 'rgba(239,68,68,0.07)', text: '#e87161', label: 'Mostly Negative' },
  negative: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626', label: 'Negative' },
  neutral: { bg: 'rgba(100,116,139,0.1)', text: '#64748b', label: 'Neutral' },
};

const SEVERITY_COLORS = { alert: '#ef4444', notable: '#f59e0b', info: 'transparent' };

function TopicSparkline({ points, width = 60, height = 18 }) {
  if (!points || points.length < 2) return null;
  const scores = points.map(p => p.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores) || 1;
  const range = max - min || 1;
  const coords = scores.map((s, i) =>
    `${(i / (scores.length - 1)) * width},${height - ((s - min) / range) * height}`
  ).join(' ');
  const trending = scores[scores.length - 1] > scores[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      <polyline points={coords} fill="none"
        stroke={trending ? '#10b981' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MomentumArrow({ direction }) {
  if (direction === 'rising') return <TrendingUp size={12} style={{ color: '#10b981' }} />;
  if (direction === 'falling') return <TrendingDown size={12} style={{ color: '#94a3b8' }} />;
  if (direction === 'new') return <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: '#e53935', color: 'white' }}>NEW</span>;
  return <Minus size={12} style={{ color: '#64748b' }} />;
}

function SentimentBadge({ sentiment, score }) {
  const s = SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}{score != null && ` ${score}%`}
    </span>
  );
}

function ScoreBar({ score, maxScore }) {
  return (
    <div className="h-1 w-full rounded-full mt-1" style={{ backgroundColor: 'var(--border)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((score / maxScore) * 100, 100)}%`, backgroundColor: 'var(--accent)' }} />
    </div>
  );
}

function SourceTags({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((src, i) => {
        const name = typeof src === 'string' ? src : src.name;
        const url = typeof src === 'string' ? null : src.url;
        return url ? (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all hover:border-cyan-500 hover:text-cyan-400"
            style={{ borderColor: 'var(--border)', color: 'var(--accent)', textDecoration: 'none' }}>
            <LinkIcon size={8} />{name}
          </a>
        ) : (
          <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>{name}</span>
        );
      })}
    </div>
  );
}

function CurrencyBadge({ currency }) {
  if (!currency || currency === 'USD') return null;
  return <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>{currency}</span>;
}

function PriceMentions({ mentions, isInRig }) {
  if (!mentions?.length) return null;
  return (
    <div className="space-y-1 mt-1">
      {mentions.map((pm, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: isInRig ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.06)',
            border: isInRig ? '1px solid rgba(16,185,129,0.2)' : 'none',
          }}>
          <DollarSign size={10} style={{ color: '#059669' }} />
          <span className="font-bold" style={{ color: '#059669' }}>{pm.price}</span>
          <CurrencyBadge currency={pm.currency} />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{pm.product}</span>
          <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{pm.context}</span>
        </div>
      ))}
    </div>
  );
}

function LatestArticle({ article }) {
  if (!article) return null;
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      className="flex gap-2 p-2 rounded-lg border mt-1 hover:border-cyan-500/50 transition-colors"
      style={{ borderColor: 'var(--border)', textDecoration: 'none', backgroundColor: 'var(--bg-secondary)' }}>
      {article.image && (
        <img src={article.image.startsWith('http') ? article.image : `https://ttek2.com${article.image}`} alt="" className="w-16 h-11 object-cover rounded flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--accent)' }}>{article.category}</span>
        <p className="text-xs font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{article.title}</p>
        {article.excerpt && <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{article.excerpt}</p>}
      </div>
    </a>
  );
}

// Grouped feed items by source (from creator API)
function GroupedFeedItems({ bySource }) {
  const [expanded, setExpanded] = useState(false);
  if (!bySource || Object.keys(bySource).length === 0) return null;
  const totalItems = Object.values(bySource).reduce((sum, items) => sum + items.length, 0);

  return (
    <div className="mt-1">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-semibold py-0.5 transition-colors"
        style={{ color: 'var(--accent)' }}>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {totalItems} source {totalItems === 1 ? 'link' : 'links'} across {Object.keys(bySource).length} sources
      </button>
      {expanded && (
        <div className="mt-1 space-y-2">
          {Object.entries(bySource).map(([source, items]) => (
            <div key={source}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>{source}</span>
                <span className="text-[9px] px-1 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>{items.length}</span>
              </div>
              <div className="ml-1 pl-2.5 border-l-2 space-y-1" style={{ borderColor: 'var(--accent)33' }}>
                {items.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group" style={{ textDecoration: 'none' }}>
                    <p className="text-xs leading-snug group-hover:text-cyan-400 transition-colors flex items-start gap-1"
                      style={{ color: 'var(--accent)' }}>
                      <ExternalLink size={10} className="mt-0.5 flex-shrink-0 opacity-60" />
                      <span className="underline decoration-dotted underline-offset-2 decoration-cyan-500/40">{item.title}</span>
                    </p>
                    {item.published_at && (
                      <p className="text-[10px] ml-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Flat feed items list (fallback when grouped not available)
function FeedItemsList({ items }) {
  const [expanded, setExpanded] = useState(false);
  if (!items?.length) return null;
  return (
    <div className="mt-1">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] font-semibold py-0.5 transition-colors"
        style={{ color: 'var(--accent)' }}>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {items.length} source {items.length === 1 ? 'link' : 'links'}
      </button>
      {expanded && (
        <div className="space-y-1.5 mt-1 ml-1 pl-3 border-l-2" style={{ borderColor: 'var(--accent)33' }}>
          {items.map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group" style={{ textDecoration: 'none' }}>
              <p className="text-xs leading-snug group-hover:text-cyan-400 transition-colors flex items-start gap-1"
                style={{ color: 'var(--accent)' }}>
                <ExternalLink size={10} className="mt-0.5 flex-shrink-0 opacity-60" />
                <span className="underline decoration-dotted underline-offset-2 decoration-cyan-500/40">{item.title}</span>
              </p>
              <p className="text-[10px] ml-3.5" style={{ color: 'var(--text-secondary)' }}>
                {item.source}{item.published_at && ` · ${formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}`}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Topic Row ---

function PulseTopicRow({ topic, maxScore, rigKeywords }) {
  const [expanded, setExpanded] = useState(false);
  const [creator, setCreator] = useState(null);
  const [loadingCreator, setLoadingCreator] = useState(false);
  const severity = topic.pulse?.severity || 'info';
  const borderColor = SEVERITY_COLORS[severity] || 'transparent';

  const isInRig = rigKeywords.length > 0 && rigKeywords.some(kw =>
    topic.name.toLowerCase().includes(kw) ||
    topic.slug.toLowerCase().includes(kw) ||
    (topic.pulse?.themes || []).some(t => t.toLowerCase().includes(kw))
  );

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !creator && !loadingCreator) {
      setLoadingCreator(true);
      getPulseCreator(topic.slug).then(d => { if (d.ok) setCreator(d); }).catch(() => {}).finally(() => setLoadingCreator(false));
    }
  };

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--border)', borderLeft: `3px solid ${borderColor}` }}>
      <button onClick={handleExpand}
        className="w-full text-left px-2 py-2 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <MomentumArrow direction={topic.momentum?.direction} />
          <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{topic.name}</span>
          {isInRig && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: 'var(--accent)22', color: 'var(--accent)' }}>
              <HardDrive size={9} /> In your rig
            </span>
          )}
          <TopicSparkline points={creator?.history?.data_points} />
          {topic.momentum?.trending_since && (
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{topic.momentum.trending_since}</span>
          )}
          <SentimentBadge sentiment={topic.pulse?.sentiment} score={topic.pulse?.sentiment_score} />
          <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--text-secondary)' }}>{topic.score.toFixed(1)}</span>
        </div>

        {/* Severity banner */}
        {severity === 'alert' && topic.pulse?.key_takeaway && (
          <div className="flex items-center gap-1 mt-1 px-2 py-1 rounded text-[11px] font-semibold"
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
            <AlertTriangle size={11} />
            {isInRig ? 'Alert for hardware in your rig' : 'Alert'} — {topic.pulse.key_takeaway}
          </div>
        )}
        {severity === 'notable' && topic.pulse?.key_takeaway && (
          <div className="mt-1 px-2 py-1 rounded text-[11px] font-semibold"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: '#b45309' }}>
            Notable — {topic.pulse.key_takeaway}
          </div>
        )}

        <ScoreBar score={topic.score} maxScore={maxScore} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {topic.pulse?.summary && (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{topic.pulse.summary}</p>
          )}

          {severity === 'info' && topic.pulse?.key_takeaway && (
            <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{topic.pulse.key_takeaway}</p>
          )}

          {/* Themes */}
          {topic.pulse?.themes?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topic.pulse.themes.map((theme, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>{theme}</span>
              ))}
            </div>
          )}

          {/* Creator stats (loaded on expand) */}
          {creator?.stats && (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{creator.stats.total_discussions}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>discussions</div>
                </div>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{creator.stats.platform_count}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>platforms</div>
                </div>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div className="text-xs font-mono font-bold" style={{
                    color: SENTIMENT_COLORS[creator.stats.sentiment]?.text || 'var(--text-primary)'
                  }}>{creator.stats.sentiment_score}%</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>sentiment</div>
                </div>
                <div className="p-1.5 rounded text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <div className="text-xs font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{creator.stats.trending_duration}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>trending</div>
                </div>
              </div>

              {/* Sparkline chart */}
              {creator.history?.data_points?.length > 1 && (
                <div className="p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <TopicSparkline points={creator.history.data_points} width={280} height={32} />
                  <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span>Peak: {creator.stats.peak_score?.toFixed(2)}</span>
                    <span>Current: {creator.stats.current_score?.toFixed(2)}</span>
                    <span style={{ color: creator.stats.score_delta_24h > 0 ? '#10b981' : creator.stats.score_delta_24h < 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                      24h: {creator.stats.score_delta_24h > 0 ? '+' : ''}{creator.stats.score_delta_24h?.toFixed(2) || '0'}
                    </span>
                    <span>{creator.stats.snapshots_tracked} snapshots</span>
                  </div>
                </div>
              )}
            </>
          )}
          {loadingCreator && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Loading details...</p>}

          <SourceTags sources={topic.sources} />
          <PriceMentions mentions={topic.pulse?.price_mentions} isInRig={isInRig} />
          <LatestArticle article={topic.latest_article} />
          {creator?.feed_items_by_source
            ? <GroupedFeedItems bySource={creator.feed_items_by_source} />
            : <FeedItemsList items={creator?.feed_items || topic.feed_items} />
          }

          {/* Share + topic link */}
          <div className="flex items-center justify-between">
            {creator?.share && (
              <div className="flex gap-2">
                {[['twitter', 'X'], ['reddit', 'Reddit']].map(([key, label]) => (
                  creator.share[key] && (
                    <a key={key} href={creator.share[key]} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] px-1.5 py-0.5 rounded border hover:border-cyan-500/50 transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                      {label}
                    </a>
                  )
                ))}
              </div>
            )}
            {topic.url && (
              <a href={topic.url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] flex items-center gap-1 font-medium hover:underline ml-auto"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                More on ttek2.com <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Deals Section ---

function DealsSection({ deals }) {
  const [showAll, setShowAll] = useState(false);
  if (!deals?.length) return null;
  const visible = showAll ? deals : deals.slice(0, 5);
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs font-bold mb-2 flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
        <DollarSign size={12} /> Deals
      </p>
      {visible.map((deal, i) => (
        <a key={i} href={deal.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between py-1.5 border-t first:border-t-0 hover:bg-white/5 transition-colors"
          style={{ borderColor: 'var(--border)11', textDecoration: 'none' }}>
          <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)' }}>{deal.title}</span>
          <span className="text-[10px] ml-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{deal.source}</span>
        </a>
      ))}
      {deals.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} className="text-[10px] mt-1" style={{ color: 'var(--accent)' }}>
          {showAll ? 'Show less' : `Show all ${deals.length} deals`}
        </button>
      )}
    </div>
  );
}

// --- Price Alerts (flattened cross-topic) ---

function PriceAlertsSection({ alerts, rigKeywords }) {
  if (!alerts?.length) return null;
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
      <p className="text-xs font-bold mb-2 flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
        <DollarSign size={12} /> Price Alerts
      </p>
      <div className="space-y-1">
        {alerts.slice(0, 8).map((a, i) => {
          const isRig = rigKeywords.some(kw => a.topic.toLowerCase().includes(kw) || a.product.toLowerCase().includes(kw));
          return (
            <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded"
              style={{ backgroundColor: isRig ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)' }}>
              <span className="font-bold" style={{ color: '#059669' }}>{a.price}</span>
              <CurrencyBadge currency={a.currency} />
              <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.product}</span>
              {isRig && <HardDrive size={9} style={{ color: 'var(--accent)' }} />}
              <span className="flex-1 truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>{a.context}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main Widget ---

export default function PulseWidget({ config, onRemove, onConfigure }) {
  const [pulse, setPulse] = useState(null);
  const [rigKeywords, setRigKeywords] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPulse().then(d => { if (d.ok) setPulse(d); else setError('Failed to load'); }).catch(e => setError(e.message));
    getRigMatchKeywords().then(d => setRigKeywords(d.keywords || [])).catch(() => {});
    const interval = setInterval(() => { getPulse().then(d => { if (d.ok) setPulse(d); }).catch(() => {}); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const data = pulse?.data;
  const topics = data?.topics || [];
  const maxScore = topics.length > 0 ? Math.max(...topics.map(t => t.score)) : 1;

  return (
    <WidgetWrapper title="Community Pulse" icon={Zap} onRemove={onRemove} onConfigure={onConfigure}>
      {error ? (
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Trending data unavailable</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Will retry in 5 minutes</p>
        </div>
      ) : !pulse ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading pulse data...</p>
      ) : (
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 px-2 pb-2 mb-1 border-b text-[10px] flex-wrap" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <span>{data.topic_count || topics.length} topics</span>
            <span>{data.sources_healthy}/{data.sources_total} sources</span>
            {data.deal_count > 0 && <span>{data.deal_count} deals</span>}
            {data.platform_volume && (
              <span>Reddit {data.platform_volume.reddit} · RSS {data.platform_volume.rss} · HN {data.platform_volume.hackernews}</span>
            )}
            {data.refreshed_at && (
              <span className="ml-auto">{formatDistanceToNow(new Date(data.refreshed_at), { addSuffix: true })}</span>
            )}
          </div>

          {/* Topics grouped by sentiment */}
          <div>
            {(() => {
              const sentimentOrder = { positive: 0, mostly_positive: 1, mixed: 2, neutral: 3, mostly_negative: 4, negative: 5 };
              const groups = {};
              for (const topic of topics) {
                const s = topic.pulse?.sentiment || 'neutral';
                if (!groups[s]) groups[s] = [];
                groups[s].push(topic);
              }
              const sortedGroups = Object.entries(groups).sort((a, b) => (sentimentOrder[a[0]] ?? 3) - (sentimentOrder[b[0]] ?? 3));
              const groupLabels = {
                positive: 'Positive', mostly_positive: 'Mostly Positive', mixed: 'Mixed',
                neutral: 'Neutral', mostly_negative: 'Mostly Negative', negative: 'Negative'
              };
              return sortedGroups.map(([sentiment, group]) => (
                <div key={sentiment}>
                  <div className="flex items-center gap-2 px-2 py-1 mt-1 first:mt-0">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral).text }} />
                    <span className="text-[10px] font-bold uppercase" style={{ color: (SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral).text }}>
                      {groupLabels[sentiment] || sentiment} ({group.length})
                    </span>
                  </div>
                  {group.map(topic => (
                    <PulseTopicRow key={topic.slug} topic={topic} maxScore={maxScore} rigKeywords={rigKeywords} />
                  ))}
                </div>
              ));
            })()}
          </div>

          {/* Deals */}
          <DealsSection deals={data.deals} />

          {/* Price Alerts */}
          <PriceAlertsSection alerts={data.price_alerts} rigKeywords={rigKeywords} />

          {/* Velocity */}
          {(data.velocity || []).length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--text-secondary)' }}>Emerging Keywords</p>
              <div className="flex flex-wrap gap-1">
                {data.velocity.slice(0, 10).map((v, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px]"
                    style={{ backgroundColor: 'var(--accent)11', color: 'var(--accent)' }}>
                    {v.keyword}
                    <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>
                      {v.mention_count} · {typeof v.sources?.[0] === 'object' ? v.sources.length : v.source_count} src
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimers + Attribution */}
          <div className="mt-3 pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border)' }}>
            {pulse.disclaimers?.pricing && (
              <p className="text-[9px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                {pulse.disclaimers.pricing}
              </p>
            )}
            {pulse.attribution && (
              <a href={pulse.attribution.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] hover:underline"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                {pulse.attribution.logo && <img src={pulse.attribution.logo} alt="" className="w-3.5 h-3.5" />}
                {pulse.attribution.text}
              </a>
            )}
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
