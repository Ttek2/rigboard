import { useState, useEffect, useContext } from 'react';
import { Users, MessageSquare, ThumbsUp, Send, ChevronDown, ChevronRight, ExternalLink, ArrowLeft, Newspaper } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import WidgetWrapper from '../WidgetWrapper';
import { SettingsContext } from '../../App';
import { getPulse, getArticle } from '../../api';

const BASE = '/api/v1';
async function req(path) { return (await fetch(`${BASE}${path}`)).json(); }
async function authPost(path, token, body) {
  return (await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  })).json();
}

// === Comment Component ===

function CommentItem({ comment, token, siteKey, slug, onRefresh, depth = 0 }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(depth === 0);

  return (
    <div className={depth > 0 ? 'ml-4 pl-3 border-l' : ''} style={{ borderColor: depth > 0 ? 'var(--border)' : 'transparent' }}>
      <div className="py-1.5">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: comment.user?.avatar_color || '#3b82f6' }}>
            {(comment.user?.display_name || '?')[0].toUpperCase()}
          </div>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{comment.user?.display_name}</span>
          {comment.user?.rig_badge && (
            <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--accent)22', color: 'var(--accent)' }}>{comment.user.rig_badge}</span>
          )}
          {comment.relevant_components?.map((rc, i) => (
            <span key={i} className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: '#22c55e22', color: '#22c55e' }}>Owns {rc.short_name}</span>
          ))}
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {comment.created_at && formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>{comment.content}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <button onClick={async () => { if (token) { await authPost(`/community/comments/${comment.id}/vote`, token, { direction: 'up' }); onRefresh(); } }}
            className="flex items-center gap-1 text-[10px] hover:text-cyan-400" style={{ color: 'var(--text-secondary)' }}>
            <ThumbsUp size={9} /> {comment.vote_count || 0}
          </button>
          {token && depth === 0 && (
            <button onClick={() => setShowReply(!showReply)} className="text-[10px] hover:text-cyan-400" style={{ color: 'var(--text-secondary)' }}>Reply</button>
          )}
          {comment.replies?.length > 0 && (
            <button onClick={() => setShowReplies(!showReplies)} className="flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--accent)' }}>
              {showReplies ? <ChevronDown size={9} /> : <ChevronRight size={9} />} {comment.replies.length}
            </button>
          )}
        </div>
        {showReply && (
          <form onSubmit={async (e) => { e.preventDefault(); if (!replyText.trim()) return;
            await authPost('/community/comments', token, { page_type: 'trending', slug, site_id: siteKey, content: replyText.trim(), parent_id: comment.id, topic_context: [slug] });
            setReplyText(''); setShowReply(false); onRefresh();
          }} className="flex gap-1 mt-1">
            <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply..."
              className="flex-1 px-2 py-1 rounded border text-[11px]" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            <button type="submit" className="p-1 rounded" style={{ backgroundColor: 'var(--accent)', color: 'white' }}><Send size={9} /></button>
          </form>
        )}
      </div>
      {showReplies && comment.replies?.map(r => (
        <CommentItem key={r.id} comment={r} token={token} siteKey={siteKey} slug={slug} onRefresh={onRefresh} depth={depth + 1} />
      ))}
    </div>
  );
}

// === Article View ===

function ArticleView({ article, token, siteKey, onBack }) {
  const [content, setContent] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const slug = article.url?.split('/').filter(Boolean).pop() || article.slug || '';

  useEffect(() => {
    // Fetch full article content via reader proxy
    if (article.feedItemId) {
      getArticle(article.feedItemId).then(d => setContent(d.content)).catch(() => {});
    } else {
      // Fetch directly
      fetch(`${BASE}/articles/0`).catch(() => {}); // fallback
      setContent(article.excerpt || article.summary || '');
    }
    loadComments();
  }, [article]);

  const loadComments = () => {
    req(`/community/comments?page_type=article&slug=${slug}&topic_context=${slug}`).then(d => {
      if (d.ok) setComments(d.data.comments || []);
    }).catch(() => {});
  };

  return (
    <div className="flex flex-col h-full">
      <button onClick={onBack} className="flex items-center gap-1 text-xs mb-2 flex-shrink-0" style={{ color: 'var(--accent)' }}>
        <ArrowLeft size={12} /> Back
      </button>

      <div className="flex-1 overflow-auto min-h-0">
        {/* Article header */}
        {article.image && (
          <img src={article.image.startsWith('http') ? article.image : `https://ttek2.com${article.image}`}
            alt="" className="w-full h-28 object-cover rounded-lg mb-2" />
        )}
        <h3 className="text-sm font-bold leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>{article.title}</h3>
        {article.category && (
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mr-2" style={{ color: 'var(--accent)', backgroundColor: 'var(--accent)11' }}>{article.category}</span>
        )}
        {article.published_at && (
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}</span>
        )}

        {/* Content */}
        <div className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <p>{article.excerpt || 'Loading...'}</p>
          )}
        </div>

        <a href={article.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] mt-2 font-medium" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Read full article on ttek2.com <ExternalLink size={10} />
        </a>

        {/* Comments */}
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
            Comments ({comments.length})
          </p>
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} token={token} siteKey={siteKey} slug={slug} onRefresh={loadComments} />
          ))}
          {comments.length === 0 && (
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>No comments yet. Be first!</p>
          )}
        </div>
      </div>

      {/* Post comment */}
      {token && (
        <form onSubmit={async (e) => { e.preventDefault(); if (!newComment.trim()) return;
          await authPost('/community/comments', token, { page_type: 'article', slug, site_id: siteKey, content: newComment.trim(), topic_context: [slug] });
          setNewComment(''); loadComments();
        }} className="flex gap-1.5 mt-2 flex-shrink-0">
          <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Comment..."
            className="flex-1 px-2 py-1.5 rounded-lg border text-xs"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <button type="submit" disabled={!newComment.trim()} className="p-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: newComment.trim() ? 1 : 0.5 }}>
            <Send size={12} />
          </button>
        </form>
      )}
    </div>
  );
}

// === Main Widget ===

export default function CommunityWidget({ config, onRemove, onConfigure }) {
  const { settings } = useContext(SettingsContext);
  const [view, setView] = useState('feed'); // feed | article | discussions
  const [articles, setArticles] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [activeArticle, setActiveArticle] = useState(null);
  const [activeTopic, setActiveTopic] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const siteKey = settings.community_site_key || '';
  const enabled = settings.community_opted_in === 'true';

  useEffect(() => {
    if (!enabled || !siteKey) return;
    req(`/community/token?site_key=${siteKey}`).then(d => { if (d.ok) { setToken(d.token); setUser(d.user); } }).catch(() => {});
  }, [enabled, siteKey]);

  // Load articles + topics from pulse
  useEffect(() => {
    getPulse().then(d => {
      if (!d.ok) return;
      const topics = d.data.topics || [];
      setDiscussions(topics.slice(0, 10).map(t => ({ slug: t.slug, name: t.name, score: t.score })));
      // Collect articles from topics
      const arts = topics.filter(t => t.latest_article).map(t => ({
        ...t.latest_article,
        image: t.latest_article.image?.startsWith('http') ? t.latest_article.image : (t.latest_article.image ? `https://ttek2.com${t.latest_article.image}` : null),
        topicName: t.name, topicSlug: t.slug
      }));
      setArticles(arts);
    }).catch(() => {});
  }, []);

  const loadDiscussionComments = (slug) => {
    setActiveTopic(slug);
    setView('discussions');
    req(`/community/discussions?slug=${slug}&sort=hot&topic_context=${slug}`).then(d => {
      if (d.ok) setComments(d.data.comments || []);
    }).catch(() => {});
  };

  if (!enabled) {
    return (
      <WidgetWrapper title="ttek2 Community" icon={Users} onRemove={onRemove} onConfigure={onConfigure}>
        <div className="text-center py-4">
          <Users size={24} className="mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Enable ttek2 Community in Settings to browse articles and join discussions.</p>
        </div>
      </WidgetWrapper>
    );
  }

  return (
    <WidgetWrapper title="ttek2 Community" icon={Users} onRemove={onRemove} onConfigure={onConfigure}>
      {/* Article detail view */}
      {view === 'article' && activeArticle ? (
        <ArticleView article={activeArticle} token={token} siteKey={siteKey} onBack={() => setView('feed')} />
      ) : view === 'discussions' && activeTopic ? (
        /* Discussion view */
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <button onClick={() => setView('feed')} className="text-xs" style={{ color: 'var(--accent)' }}><ArrowLeft size={12} /></button>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{discussions.find(d => d.slug === activeTopic)?.name || activeTopic}</span>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            {comments.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>No discussions yet. Start one!</p>
            ) : comments.map(c => (
              <CommentItem key={c.id} comment={c} token={token} siteKey={siteKey} slug={activeTopic} onRefresh={() => loadDiscussionComments(activeTopic)} />
            ))}
          </div>
          {token && (
            <form onSubmit={async (e) => { e.preventDefault(); if (!newComment.trim()) return;
              await authPost('/community/discussions', token, { slug: activeTopic, site_id: siteKey, content: newComment.trim(), topic_context: [activeTopic] });
              setNewComment(''); loadDiscussionComments(activeTopic);
            }} className="flex gap-1.5 mt-2 flex-shrink-0">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={`Discuss ${activeTopic}...`}
                className="flex-1 px-2.5 py-1.5 rounded-lg border text-xs"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button type="submit" disabled={!newComment.trim()} className="p-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: newComment.trim() ? 1 : 0.5 }}>
                <Send size={12} />
              </button>
            </form>
          )}
        </div>
      ) : (
        /* Feed view -- browse articles + discussions */
        <div className="flex flex-col h-full">
          {/* Nav tabs */}
          <div className="flex gap-1 mb-2 border-b pb-1 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setView('feed')} className="text-[11px] font-medium flex items-center gap-1 px-2 py-0.5"
              style={{ color: 'var(--accent)' }}>
              <Newspaper size={11} /> Articles
            </button>
          </div>

          <div className="flex-1 overflow-auto min-h-0 space-y-1">
            {/* Articles */}
            {articles.map((a, i) => (
              <button key={i} onClick={() => { setActiveArticle(a); setView('article'); }}
                className="w-full text-left flex gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
                {a.image && <img src={a.image} alt="" className="w-14 h-10 object-cover rounded flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                  <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    {a.category && <span className="uppercase font-bold" style={{ color: 'var(--accent)' }}>{a.category}</span>}
                    {a.published_at && formatDistanceToNow(new Date(a.published_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}

            {/* Topic discussions */}
            <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-bold uppercase mb-1.5 px-1" style={{ color: 'var(--text-secondary)' }}>
                <MessageSquare size={10} className="inline mr-1" />Trending Discussions
              </p>
              {discussions.map(t => (
                <button key={t.slug} onClick={() => loadDiscussionComments(t.slug)}
                  className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>{t.score.toFixed(1)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </WidgetWrapper>
  );
}
