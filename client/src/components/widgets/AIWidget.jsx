import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, Eye, Loader, HeartPulse, Brain, X } from 'lucide-react';
import { marked } from 'marked';
import WidgetWrapper from '../WidgetWrapper';
import { streamAIChat, getAIContext, triggerHeartbeat, getAIHistory, saveAIMessage, clearAIHistory, extractMemories, getAIMemory, executeAIAction, getAIAutonomy } from '../../api';

export default function AIWidget({ config, onRemove, onConfigure }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [contextPreview, setContextPreview] = useState(null);
  const [heartbeating, setHeartbeating] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [autonomy, setAutonomy] = useState({ mode: 'confirm', actions: {} });
  const scrollRef = useRef(null);

  // Load persisted chat history on mount
  useEffect(() => {
    getAIHistory().then(msgs => {
      setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
      setLoaded(true);
    }).catch(() => setLoaded(true));
    getAIMemory().then(m => setMemoryCount(Array.isArray(m) ? m.length : 0)).catch(() => {});
    getAIAutonomy().then(setAutonomy).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || streaming) return;

    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Persist user message
    saveAIMessage('user', userMsg.content).catch(() => {});

    try {
      const response = await streamAIChat(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        config?.include_context !== false
      );

      if (!response.ok) {
        const err = await response.json();
        const errMsg = { role: 'assistant', content: `Error: ${err.error}` };
        setMessages(prev => [...prev, errMsg]);
        saveAIMessage('assistant', errMsg.content).catch(() => {});
        setStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            assistantContent += delta;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
              return updated;
            });
          } catch {}
        }
      }

      // Persist assistant message
      saveAIMessage('assistant', assistantContent).catch(() => {});

      // Extract and save any [MEMORY:key=value] from the response
      if (assistantContent.includes('[MEMORY:')) {
        extractMemories(assistantContent).then(r => {
          if (r.saved > 0) setMemoryCount(prev => prev + r.saved);
        }).catch(() => {});
      }

    } catch (err) {
      const errMsg = { role: 'assistant', content: `Connection failed: ${err.message}` };
      setMessages(prev => [...prev, errMsg]);
    }

    setStreaming(false);
  };

  const handleClear = async () => {
    setMessages([]);
    clearAIHistory().catch(() => {});
  };

  const handlePreviewContext = async () => {
    if (contextPreview) { setContextPreview(null); return; }
    try {
      const data = await getAIContext();
      setContextPreview(data);
    } catch (err) {
      setContextPreview({ context: 'Failed to load context', token_estimate: 0 });
    }
  };

  // Strip [MEMORY:...] tags from display text
  const cleanContent = (text) => text.replace(/\[MEMORY:[^\]]+\]/g, '').replace(/\[ACTION:[^\]]+\]/g, '').trim();

  // Parse [ACTION:name|key=val|key=val] from text
  const parseActions = (text) => {
    const matches = [...(text || '').matchAll(/\[ACTION:([^\]]+)\]/g)];
    return matches.map(m => {
      const parts = m[1].split('|');
      const action = parts[0];
      const params = {};
      for (const p of parts.slice(1)) {
        const [k, ...v] = p.split('=');
        params[k.trim()] = v.join('=').trim();
      }
      return { action, params, raw: m[0] };
    });
  };

  function ActionButton({ action, params }) {
    const autoExec = autonomy.actions?.[action]?.auto_execute || false;
    const [state, setState] = useState(autoExec ? 'executing' : 'pending');
    const [result, setResult] = useState('');

    const handleConfirm = async () => {
      setState('executing');
      try {
        const r = await executeAIAction(action, params);
        setResult(r.message || 'Done');
        setState(r.success ? 'done' : 'error');
      } catch (e) { setResult(e.message); setState('error'); }
    };

    // Auto-execute on mount if autonomy allows
    useEffect(() => {
      if (autoExec) handleConfirm();
    }, []);

    const label = action.replace(/_/g, ' ');
    const paramStr = Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ');
    const riskLevel = autonomy.actions?.[action]?.risk || 'low';
    const riskColor = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }[riskLevel];

    return (
      <div className="mt-1.5 p-2 rounded-lg border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: riskColor }} title={`${riskLevel} risk`} />
            </div>
            {paramStr && <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{paramStr}</p>}
          </div>
          {state === 'pending' && (
            <button onClick={handleConfirm}
              className="px-2.5 py-1 rounded text-[10px] font-medium text-white flex-shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}>
              Confirm
            </button>
          )}
          {state === 'executing' && <Loader size={12} className="animate-spin" style={{ color: 'var(--accent)' }} />}
          {state === 'done' && <span className="text-[10px] font-medium" style={{ color: '#22c55e' }}>{result}</span>}
          {state === 'error' && <span className="text-[10px] font-medium" style={{ color: '#ef4444' }}>{result}</span>}
        </div>
      </div>
    );
  }

  if (!loaded) return <WidgetWrapper title="AI Assistant" icon={Bot} onRemove={onRemove} onConfigure={onConfigure}><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading...</p></WidgetWrapper>;

  return (
    <WidgetWrapper title="AI Assistant" icon={Bot} onRemove={onRemove} onConfigure={onConfigure}>
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto space-y-2 mb-2" style={{ minHeight: 0 }}>
          {messages.length === 0 && !contextPreview && (
            <div className="text-center py-4">
              <Bot size={24} className="mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Dashboard-aware AI with persistent memory. Ask about your hardware, services, or trending topics.
              </p>
              <div className="flex items-center justify-center gap-3 mt-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {memoryCount > 0 && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    <Brain size={10} /> {memoryCount} memories
                  </span>
                )}
                <span className="flex items-center gap-1">
                  Mode: <strong style={{ color: autonomy.mode === 'full' ? '#22c55e' : autonomy.mode === 'semi' ? '#f59e0b' : 'var(--text-secondary)' }}>
                    {autonomy.mode || 'confirm'}
                  </strong>
                </span>
              </div>
              <div className="flex flex-wrap gap-1 justify-center mt-2">
                {['What maintenance is due?', 'Summarize trending topics', 'Any deals for my rig?', 'Remember: my budget is 500 EUR'].map(q => (
                  <button key={q} onClick={() => setInput(q)}
                    className="px-2 py-1 rounded border text-[10px] hover:border-cyan-500/50 transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {contextPreview && (
            <div className="p-2 rounded text-[10px] font-mono whitespace-pre-wrap" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
              <div className="flex justify-between mb-1">
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Context sent to AI</span>
                <span>~{contextPreview.token_estimate} tokens</span>
              </div>
              {contextPreview.context}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs select-text ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                style={{
                  backgroundColor: msg.role === 'user' ? 'var(--accent)22' : 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}>
                {msg.role === 'assistant' ? (
                  <>
                    <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_li]:my-0 select-text"
                      dangerouslySetInnerHTML={{ __html: marked.parse(cleanContent(msg.content || '...')) }} />
                    {/* Action confirm buttons */}
                    {parseActions(msg.content).map((act, j) => (
                      <ActionButton key={j} action={act.action} params={act.params} />
                    ))}
                  </>
                ) : (
                  <p className="select-text">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {streaming && (
            <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              <Loader size={10} className="animate-spin" /> Thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-1.5 items-end">
          <div className="flex gap-1">
            <button type="button" onClick={handlePreviewContext}
              className={`p-1.5 rounded transition-colors ${contextPreview ? '' : 'opacity-50 hover:opacity-100'}`}
              style={{ color: contextPreview ? 'var(--accent)' : 'var(--text-secondary)' }}
              title="Preview context sent to AI">
              <Eye size={13} />
            </button>
            <button type="button" onClick={async () => {
                setHeartbeating(true);
                try { await triggerHeartbeat(); } catch {}
                setHeartbeating(false);
              }}
              disabled={heartbeating}
              className={`p-1.5 rounded transition-colors ${heartbeating ? 'animate-pulse' : 'opacity-50 hover:opacity-100'}`}
              style={{ color: heartbeating ? 'var(--accent)' : 'var(--text-secondary)' }}
              title="Run AI heartbeat — scan dashboard and generate notifications">
              <HeartPulse size={13} />
            </button>
            {messages.length > 0 && (
              <button type="button" onClick={handleClear}
                className="p-1.5 rounded opacity-50 hover:opacity-100"
                style={{ color: 'var(--text-secondary)' }} title="Clear chat history">
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <div className="flex-1 relative">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask anything..."
              disabled={streaming}
              className="w-full px-2.5 py-1.5 pr-7 rounded-lg border text-xs"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            {input && (
              <button onClick={() => setInput('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-40 hover:opacity-100"
                style={{ color: 'var(--text-secondary)' }}>
                <X size={11} />
              </button>
            )}
          </div>
          <button type="submit" disabled={streaming || !input.trim()}
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: streaming || !input.trim() ? 0.5 : 1 }}>
            <Send size={13} />
          </button>
        </form>
      </div>
    </WidgetWrapper>
  );
}
