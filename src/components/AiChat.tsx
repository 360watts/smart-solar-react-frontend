import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  BotMessageSquare, Sparkles, X, Send, Zap, AlertTriangle, Battery, MapPin,
  Maximize2, Minimize2, Copy, Check,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from '../hooks/useIsMobile';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  isError?: boolean;
}

type PanelSize = 'compact' | 'fullscreen';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.360watts.com/api';

function getAuthHeaders(): HeadersInit {
  const tokens = localStorage.getItem('authTokens');
  if (tokens) {
    try {
      const parsed = JSON.parse(tokens);
      return { Authorization: `Bearer ${parsed.access}`, 'Content-Type': 'application/json' };
    } catch {}
  }
  return { 'Content-Type': 'application/json' };
}

const SUGGESTED = [
  { icon: Zap, label: 'Which devices are offline?' },
  { icon: AlertTriangle, label: 'Show active alerts' },
  { icon: Battery, label: 'Battery status at coim_001' },
  { icon: MapPin, label: 'List all sites' },
];

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function CopyButton({ text, size = 14 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="ai-copy-btn" title="Copy">
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

const AiChat: React.FC = () => {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [panelSize, setPanelSize] = useState<PanelSize>('compact');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isStreamingRef = useRef(false);
  const [ticks, setTicks] = useState(0);

  // Tick timestamps every 30s for relative time display
  useEffect(() => {
    const id = setInterval(() => setTicks(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreamingRef.current ? 'instant' : 'smooth' } as any);
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Ctrl+/ global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const cycleSize = () => {
    setPanelSize(s => s === 'compact' ? 'fullscreen' : 'compact');
  };

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { role: 'user', content: trimmed, ts: Date.now() };
    const updatedMessages = [...messagesRef.current, userMsg];
    const assistantMsg: Message = { role: 'assistant', content: '', ts: Date.now() };

    setMessages([...updatedMessages, assistantMsg]);
    setInput('');
    setStreaming(true);
    isStreamingRef.current = true;

    try {
      const response = await fetch(`${API_BASE_URL}/ai/chat/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: `Error: ${err}`, ts: Date.now(), isError: true };
          return next;
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const token = line.slice(6);
          if (token === '[DONE]') break;
          if (token.startsWith('[ERROR]')) {
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'assistant', content: token.slice(8), ts: Date.now(), isError: true };
              return next;
            });
            break;
          }
          const text = token.replace(/\\n/g, '\n');
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + text };
            return next;
          });
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: 'Failed to connect to AI service.', ts: Date.now(), isError: true };
        return next;
      });
    } finally {
      setStreaming(false);
      isStreamingRef.current = false;
    }
  }, [streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Panel dimensions
  const panelW = isMobile ? 'calc(100vw - 16px)' : panelSize === 'compact' ? 380 : '100vw';
  const panelH = isMobile ? 'calc(100dvh - 220px)' : panelSize === 'compact' ? 560 : '100dvh';
  const panelBottom = panelSize === 'fullscreen' ? 0 : isMobile ? 144 : 88;
  const panelRight = panelSize === 'fullscreen' ? 0 : isMobile ? 8 : 24;
  const panelRadius = panelSize === 'fullscreen' ? 0 : 18;

  const SizeIcon = panelSize === 'fullscreen' ? Minimize2 : Maximize2;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`ai-fab ${open ? 'ai-fab--open' : ''}`}
        style={{ bottom: isMobile ? 80 : 24, right: isMobile ? 16 : 24 }}
        title="AI Assistant (Ctrl+/)"
      >
        <span className="ai-fab__ring" />
        {open
          ? <X size={20} color="white" />
          : <Sparkles size={20} color="white" />
        }
      </button>

      {/* Fullscreen backdrop */}
      {open && panelSize === 'fullscreen' && (
        <div className="ai-backdrop" onClick={() => setPanelSize('compact')} />
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`ai-panel ai-panel--${isDark ? 'dark' : 'light'}`}
          style={{
            bottom: panelBottom,
            right: panelRight,
            width: panelW,
            height: panelH,
            borderRadius: panelRadius,
          }}
        >
          {/* Header */}
          <div className="ai-header">
            <div className="ai-header__identity">
              <div className="ai-avatar">
                <BotMessageSquare size={16} color="white" />
                <span className="ai-avatar__pulse" />
              </div>
              <div>
                <div className="ai-header__name">360Watts Assistant</div>
                <div className="ai-header__status">
                  <span className="ai-status-dot" />
                  Real-time data · Read-only
                </div>
              </div>
            </div>
            <div className="ai-header__actions">
              {messages.length > 0 && (
                <button className="ai-hdr-btn" onClick={() => setMessages([])} title="Clear">
                  Clear
                </button>
              )}
              <button className="ai-hdr-btn ai-hdr-btn--icon" onClick={cycleSize} title="Resize">
                <SizeIcon size={14} />
              </button>
              <button className="ai-hdr-btn ai-hdr-btn--icon" onClick={() => setOpen(false)} title="Close">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-empty">
                <div className="ai-empty__icon">
                  <Sparkles size={26} color="white" />
                </div>
                <div className="ai-empty__title">How can I help?</div>
                <div className="ai-empty__sub">Ask about devices, sites, alerts, or telemetry.</div>
                <div className="ai-suggestions">
                  {SUGGESTED.map(({ icon: Icon, label }) => (
                    <button key={label} className="ai-chip" onClick={() => sendMessage(label)}>
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ai-msg--${msg.role} ${msg.isError ? 'ai-msg--error' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="ai-msg__avatar">
                    <BotMessageSquare size={12} color="white" />
                  </div>
                )}
                <div className="ai-msg__bubble">
                  {msg.content === '' && msg.role === 'assistant' ? (
                    <div className="ai-typing">
                      <span /><span /><span />
                    </div>
                  ) : msg.role === 'assistant' ? (
                    <div className="ai-markdown">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeStr = String(children).replace(/\n$/, '');
                            if (match) {
                              return (
                                <div className="ai-code-block">
                                  <div className="ai-code-block__header">
                                    <span>{match[1]}</span>
                                    <CopyButton text={codeStr} size={12} />
                                  </div>
                                  <SyntaxHighlighter
                                    style={isDark ? oneDark : oneLight}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', fontSize: '0.78rem' }}
                                  >
                                    {codeStr}
                                  </SyntaxHighlighter>
                                </div>
                              );
                            }
                            return <code className={className} {...props}>{children}</code>;
                          },
                          table({ children, ...props }: any) {
                            return (
                              <div className="ai-table-container">
                                <table {...props}>{children}</table>
                              </div>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</span>
                  )}
                  {msg.role === 'assistant' && msg.content && !msg.isError && (
                    <CopyButton text={msg.content} size={12} />
                  )}
                </div>
                {/* Timestamp on hover */}
                <div className="ai-msg__ts" key={ticks}>{timeAgo(msg.ts)}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="ai-input-area">
            <div className="ai-input-box">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything…"
                rows={1}
                disabled={streaming}
                className="ai-textarea"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                className="ai-send-btn"
                title="Send"
              >
                <Send size={14} />
              </button>
            </div>
            <div className="ai-input-hint">Enter to send · Shift+Enter for new line · Ctrl+/ to toggle</div>
          </div>
        </div>
      )}

      <style>{`
        /* ── FAB ── */
        .ai-fab {
          position: fixed; z-index: 9000;
          width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
          background: linear-gradient(135deg, #00a63e 0%, #00ca4a 100%);
          box-shadow: 0 8px 32px rgba(0,166,62,0.4), inset 0 2px 4px rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s, background 0.25s;
          outline: none;
        }
        .ai-fab:active { transform: scale(0.92); }
        .ai-fab:hover { transform: scale(1.08) translateY(-4px); box-shadow: 0 12px 40px rgba(0,166,62,0.6), inset 0 2px 4px rgba(255,255,255,0.4); }
        .ai-fab--open { background: linear-gradient(135deg, #334155, #0f172a); box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1); }
        .ai-fab--open:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
        .ai-fab__ring {
          position: absolute; inset: -4px; border-radius: 50%;
          border: 2px solid #00a63e;
          animation: aiFabRing 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes aiFabRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.25); opacity: 0; }
        }

        /* ── Backdrop ── */
        .ai-backdrop {
          position: fixed; inset: 0; z-index: 8999;
          background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
          animation: aiFadeIn 0.2s ease;
        }

        /* ── Panel ── */
        .ai-panel {
          position: fixed; z-index: 9000;
          display: flex; flex-direction: column; overflow: hidden;
          animation: aiPanelIn 0.28s cubic-bezier(.34,1.56,.64,1);
          transform-origin: bottom right;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .ai-panel--light {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(255,255,255,0.4);
          box-shadow: 0 24px 64px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,166,62,0.08);
        }
        .ai-panel--dark {
          background: rgba(15, 25, 35, 0.85);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,166,62,0.15);
        }
        @keyframes aiPanelIn {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes aiFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }

        /* ── Header ── */
        .ai-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px; flex-shrink: 0;
          background: linear-gradient(135deg, rgba(0, 166, 62, 0.95), rgba(0, 122, 46, 0.95));
          border-bottom: 1px solid rgba(0,0,0,0.15);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .ai-header__identity { display: flex; align-items: center; gap: 12px; }
        .ai-avatar {
          position: relative;
          width: 38px; height: 38px; border-radius: 12px;
          background: rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.3);
        }
        .ai-avatar__pulse {
          position: absolute; inset: -4px; border-radius: 16px;
          border: 2px solid rgba(255,255,255,0.5);
          opacity: 0;
          animation: aiAvatarPulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .ai-header__name { font-weight: 800; font-size: 0.95rem; color: #fff; letter-spacing: -0.01em; }
        .ai-header__status { font-size: 0.72rem; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 6px; margin-top: 2px; }
        .ai-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #6ee7b7; display: inline-block; animation: aiPulse 2.5s ease-in-out infinite; box-shadow: 0 0 8px #6ee7b7; }
        @keyframes aiPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes aiAvatarPulse { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
        .ai-header__actions { display: flex; align-items: center; gap: 6px; }
        .ai-hdr-btn {
          background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.95); border-radius: 8px; cursor: pointer;
          font-size: 0.75rem; padding: 6px 12px; font-weight: 600;
          transition: background 0.2s, transform 0.1s;
        }
        .ai-hdr-btn:hover { background: rgba(255,255,255,0.25); transform: scale(1.05); }
        .ai-hdr-btn:active { transform: scale(0.95); }
        .ai-hdr-btn--icon { padding: 6px; display: flex; align-items: center; justify-content: center; }

        /* ── Messages ── */
        .ai-messages {
          flex: 1; overflow-y: auto; padding: 14px 12px;
          display: flex; flex-direction: column; gap: 12px;
          scroll-behavior: smooth;
        }
        .ai-panel--light .ai-messages { scrollbar-color: rgba(0,0,0,0.15) transparent; }
        .ai-panel--dark  .ai-messages { scrollbar-color: rgba(255,255,255,0.1) transparent; }

        /* ── Empty state ── */
        .ai-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 14px; padding: 32px 12px; text-align: center;
        }
        .ai-empty__icon {
          width: 56px; height: 56px; border-radius: 18px;
          background: linear-gradient(135deg, #00a63e, #00c94a);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 12px 32px rgba(0,166,62,0.4), inset 0 2px 4px rgba(255,255,255,0.4);
          animation: aiFloat 4s ease-in-out infinite;
        }
        @keyframes aiFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .ai-panel--light .ai-empty__title { font-weight: 800; font-size: 1.1rem; color: #0f172a; letter-spacing: -0.02em; }
        .ai-panel--dark  .ai-empty__title { font-weight: 800; font-size: 1.1rem; color: #f1f5f9; letter-spacing: -0.02em; }
        .ai-panel--light .ai-empty__sub { font-size: 0.85rem; color: #64748b; max-width: 80%; line-height: 1.4; }
        .ai-panel--dark  .ai-empty__sub { font-size: 0.85rem; color: #94a3b8; max-width: 80%; line-height: 1.4; }
        .ai-suggestions {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; margin-top: 12px;
        }
        .ai-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px; border-radius: 12px;
          font-size: 0.8rem; cursor: pointer; text-align: left;
          transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s, border-color 0.2s;
        }
        .ai-panel--light .ai-chip {
          background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.08); color: #1e293b;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .ai-panel--dark .ai-chip {
          background: rgba(30,41,59,0.5); border: 1px solid rgba(255,255,255,0.06); color: #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .ai-chip:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 8px 16px rgba(0,166,62,0.15); border-color: rgba(0,166,62,0.5) !important; }
        .ai-chip svg { color: #00a63e; flex-shrink: 0; }

        /* ── Message rows ── */
        .ai-msg {
          display: flex; align-items: flex-end; gap: 7px;
          animation: aiMsgIn 0.18s cubic-bezier(.34,1.2,.64,1);
          position: relative;
        }
        .ai-msg:hover .ai-msg__ts { opacity: 1; }
        @keyframes aiMsgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ai-msg--user { flex-direction: row-reverse; }
        .ai-msg__avatar {
          width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
          background: linear-gradient(135deg, #00a63e, #00c94a);
          display: flex; align-items: center; justify-content: center;
        }
        .ai-msg__bubble {
          max-width: 82%; position: relative; min-width: 0;
        }
        .ai-msg--user .ai-msg__bubble > span {
          display: block;
          padding: 10px 14px;
          border-radius: 16px 16px 4px 16px;
          background: linear-gradient(135deg, #00a63e 0%, #00c94a 100%);
          color: #fff; font-size: 0.85rem; line-height: 1.55;
          box-shadow: 0 4px 12px rgba(0, 166, 62, 0.2);
        }
        .ai-msg--assistant .ai-msg__bubble {
          display: flex; flex-direction: column; gap: 4px;
        }
        .ai-msg__ts {
          position: absolute; bottom: -18px;
          font-size: 0.63rem; white-space: nowrap;
          opacity: 0; transition: opacity 0.15s;
          pointer-events: none;
        }
        .ai-msg--user .ai-msg__ts  { right: 0; }
        .ai-msg--assistant .ai-msg__ts { left: 33px; }
        .ai-panel--light .ai-msg__ts { color: #94a3b8; }
        .ai-panel--dark  .ai-msg__ts { color: #475569; }

        /* ── Markdown ── */
        .ai-markdown {
          padding: 12px 16px;
          border-radius: 4px 16px 16px 16px;
          font-size: 0.85rem; line-height: 1.65;
          max-width: 100%; overflow-x: auto; box-sizing: border-box;
          transform: translateZ(0); /* For crisp subpixel rendering */
        }
        .ai-panel--light .ai-markdown { background: rgba(241, 245, 249, 0.8); color: #0f172a; border: 1px solid rgba(255,255,255,0.7); box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
        .ai-panel--dark  .ai-markdown { background: rgba(26, 37, 53, 0.8); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .ai-markdown p { margin: 0 0 0.5em 0; }
        .ai-markdown p:last-child { margin-bottom: 0; }
        .ai-markdown ul, .ai-markdown ol { padding-left: 1.2em; margin: 0.4em 0; }
        .ai-markdown li { margin: 0.2em 0; }
        .ai-markdown strong { font-weight: 700; }
        .ai-markdown em { font-style: italic; }
        .ai-panel--light .ai-markdown code { background: rgba(0,0,0,0.07); padding: 1px 4px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.78em; }
        .ai-panel--dark  .ai-markdown code { background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.78em; }
        .ai-table-container { width: 100%; overflow-x: auto; margin: 0.5em 0; padding-bottom: 2px; }
        .ai-table-container::-webkit-scrollbar { height: 6px; }
        .ai-table-container::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.3); border-radius: 3px; }
        .ai-markdown table { width: 100%; border-collapse: collapse; font-size: 0.9em; min-width: 400px; }
        .ai-panel--light .ai-markdown th { background: rgba(0,166,62,0.1); }
        .ai-panel--dark  .ai-markdown th { background: rgba(0,166,62,0.18); }
        .ai-markdown th, .ai-markdown td { padding: 6px 10px; border: 1px solid rgba(0,0,0,0.1); text-align: left; }
        .ai-panel--dark .ai-markdown td, .ai-panel--dark .ai-markdown th { border-color: rgba(255,255,255,0.08); }
        .ai-markdown blockquote { border-left: 3px solid #00a63e; padding-left: 10px; margin: 0.4em 0; opacity: 0.8; }

        /* ── Error bubble ── */
        .ai-msg--error .ai-markdown,
        .ai-msg--error .ai-msg__bubble > span {
          border-color: rgba(239,68,68,0.4) !important;
          background: rgba(239,68,68,0.08) !important;
          color: #ef4444 !important;
        }

        /* ── Code block ── */
        .ai-code-block { border-radius: 8px; overflow: hidden; margin: 4px 0; }
        .ai-panel--light .ai-code-block { border: 1px solid rgba(0,0,0,0.1); }
        .ai-panel--dark  .ai-code-block { border: 1px solid rgba(255,255,255,0.08); }
        .ai-code-block__header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 4px 10px; font-size: 0.7rem; font-family: 'JetBrains Mono', monospace;
        }
        .ai-panel--light .ai-code-block__header { background: #e2e8f0; color: #64748b; }
        .ai-panel--dark  .ai-code-block__header { background: #0d1117; color: #64748b; }

        /* ── Copy button ── */
        .ai-copy-btn {
          background: transparent; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          padding: 3px; border-radius: 5px; opacity: 0.5;
          transition: opacity 0.15s;
        }
        .ai-copy-btn:hover { opacity: 1; }
        .ai-panel--light .ai-copy-btn { color: #475569; }
        .ai-panel--dark  .ai-copy-btn { color: #94a3b8; }

        /* ── Typing indicator ── */
        .ai-typing {
          display: flex; gap: 4px; align-items: center;
          padding: 10px 14px;
          border-radius: 4px 16px 16px 16px;
        }
        .ai-panel--light .ai-typing { background: #f1f5f9; border: 1px solid rgba(0,0,0,0.07); }
        .ai-panel--dark  .ai-typing { background: #1a2535; border: 1px solid rgba(255,255,255,0.07); }
        .ai-typing span {
          width: 7px; height: 7px; border-radius: 50%; background: #00a63e;
          display: inline-block; animation: aiDotBounce 1.1s ease-in-out infinite;
        }
        .ai-typing span:nth-child(2) { animation-delay: 0.18s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.36s; }
        @keyframes aiDotBounce {
          0%,80%,100% { transform: translateY(0); opacity:0.35; }
          40% { transform: translateY(-5px); opacity:1; }
        }

        /* ── Input area ── */
        .ai-input-area {
          padding: 12px 14px 10px; flex-shrink: 0;
        }
        .ai-panel--light .ai-input-area { border-top: 1px solid rgba(0,0,0,0.06); background: rgba(255,255,255,0.7); }
        .ai-panel--dark  .ai-input-area { border-top: 1px solid rgba(255,255,255,0.05); background: rgba(15,25,35,0.7); }
        .ai-input-box {
          display: flex; gap: 8px; align-items: flex-end;
          border-radius: 14px; padding: 10px 12px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .ai-panel--light .ai-input-box { background: rgba(248,250,252,0.8); border: 1px solid rgba(0,0,0,0.1); box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
        .ai-panel--dark  .ai-input-box { background: rgba(26,37,53,0.8); border: 1px solid rgba(255,255,255,0.05); box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
        .ai-input-box:focus-within { border-color: #00a63e !important; box-shadow: 0 0 0 4px rgba(0,166,62,0.15) !important; }
        .ai-textarea {
          flex: 1; resize: none; border: none; outline: none;
          background: transparent; font-size: 0.88rem; line-height: 1.5;
          font-family: inherit; max-height: 120px; overflow-y: auto;
          transition: opacity 0.15s;
        }
        .ai-panel--light .ai-textarea { color: #0f172a; }
        .ai-panel--dark  .ai-textarea { color: #f1f5f9; }
        .ai-textarea::placeholder { color: #94a3b8; }
        .ai-textarea:disabled { opacity: 0.5; }
        .ai-send-btn {
          width: 32px; height: 32px; border-radius: 9px; border: none; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background 0.15s, transform 0.12s;
        }
        .ai-send-btn:not(:disabled) {
          background: linear-gradient(135deg, #00a63e, #00c94a);
          color: white;
        }
        .ai-send-btn:not(:disabled):hover { transform: scale(1.08); }
        .ai-send-btn:disabled { background: rgba(0,0,0,0.08); color: #94a3b8; cursor: not-allowed; }
        .ai-panel--dark .ai-send-btn:disabled { background: rgba(255,255,255,0.08); }
        .ai-input-hint { font-size: 0.64rem; text-align: center; margin-top: 5px; }
        .ai-panel--light .ai-input-hint { color: #94a3b8; }
        .ai-panel--dark  .ai-input-hint { color: #475569; }
      `}</style>
    </>
  );
};

export default AiChat;
