import { useState, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getArticle } from '../api';

export default function ArticleReader({ itemId, onClose }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    getArticle(itemId).then(a => { setArticle(a); setLoading(false); }).catch(() => setLoading(false));
  }, [itemId]);

  if (!itemId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] pb-[5vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl border shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 min-w-0">
            {article?.favicon_url && <img src={article.favicon_url} alt="" className="w-4 h-4 rounded-sm" />}
            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{article?.feed_title}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {article?.link && (
              <a href={article.link} target="_blank" rel="noopener noreferrer"
                className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
                <ExternalLink size={16} />
              </a>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading article...</p>
          ) : article ? (
            <>
              <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {article.title}
              </h1>
              <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
                {article.author && `${article.author} · `}
                {article.published_at && formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
              </p>
              <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed"
                style={{ color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: article.content || '<p>No content available. Open the original article instead.</p>' }} />
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Failed to load article.</p>
          )}
        </div>
      </div>
    </div>
  );
}
