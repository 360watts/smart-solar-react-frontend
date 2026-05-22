import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Sun, Zap, TrendingUp, Leaf,
  Maximize2, Minimize2, Crown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { usePortalFeedback } from './PortalFeedback';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  isError?: boolean;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.360watts.com/api';

const SUGGESTED = [
  { icon: Sun,        label: 'How much solar am I generating today?' },
  { icon: Zap,        label: "What's my battery status?" },
  { icon: TrendingUp, label: 'Show my energy savings this month' },
  { icon: Leaf,       label: 'Tips to improve solar efficiency' },
];

function getAuthHeaders(): HeadersInit {
  const raw = localStorage.getItem('authTokens');
  if (raw) {
    try {
      const t = JSON.parse(raw);
      return { Authorization: `Bearer ${t.access}`, 'Content-Type': 'application/json' };
    } catch {}
  }
  return { 'Content-Type': 'application/json' };
}

function normalizeFragment(fragment: string): string | null {
  const cleaned = fragment.replace(/ /g, ' ');
  if (!cleaned.trim() || cleaned.trim() === '[KEEPALIVE]') return null;
  return cleaned;
}

function normalizeContent(content: string): string {
  return content
    .replace(/\[KEEPALIVE\]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart();
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/* ─── Floating widget ────────────────────────────────────────────────────── */
const PortalChat: React.FC = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [canAccessAI, setCanAccessAI] = useState<boolean | null>(null);
  const { confirm: portalConfirm, PortalFeedbackUI } = usePortalFeedback(isDark);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [ticks, setTicks] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreamingRef = useRef(false);

  // Resolve plan access once — try portal/summary first, fall back to profile
  useEffect(() => {
    (async () => {
      try {
        const data: any = await apiService.getPortalSummary();
        const fromSummary = data?.plan_features?.can_access_ai;
        if (fromSummary !== undefined) { setCanAccessAI(fromSummary); return; }
        // summary returned but no plan_features — fall through to profile
        const profile: any = await apiService.getProfile();
        setCanAccessAI(profile?.plan_type !== 'free');
      } catch {
        // portal/summary not yet deployed — derive from profile
        try {
          const profile: any = await apiService.getProfile();
          setCanAccessAI(profile?.plan_type !== 'free');
        } catch {
          setCanAccessAI(true); // fail open — let the API enforce the gate
        }
      }
    })();
  }, []);

  // Tick for relative timestamps
  useEffect(() => {
    const id = setInterval(() => setTicks(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreamingRef.current ? 'instant' : 'smooth' } as any);
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [open]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed, ts: Date.now() };
    const history = [...messagesRef.current, userMsg];
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', ts: Date.now() };

    setMessages([...history, assistantMsg]);
    setInput('');
    setStreaming(true);
    isStreamingRef.current = true;

    try {
      const response = await fetch(`${API_BASE}/ai/user-chat/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        const errMsg = response.status === 403
          ? 'Your plan does not include AI access. Please upgrade.'
          : response.status === 503
          ? 'AI service is temporarily unavailable.'
          : `Error: ${errText}`;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { ...assistantMsg, content: errMsg, isError: true };
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
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const token = line.slice(6);
          if (token === '[DONE]') break;
          if (token === '[KEEPALIVE]') continue;
          if (token.startsWith('[ERROR]')) {
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { ...assistantMsg, content: token.slice(8), ts: Date.now(), isError: true };
              return next;
            });
            break;
          }
          const frag = normalizeFragment(token?.replace(/\\n/g, '\n') ?? '');
          if (!frag) continue;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + frag };
            return next;
          });
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], content: 'Connection lost. Please try again.', ts: Date.now(), isError: true };
        return next;
      });
    } finally {
      setStreaming(false);
      isStreamingRef.current = false;
    }
  }, [streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  // Panel dimensions
  const panelW  = expanded ? '520px' : '380px';
  const panelH  = expanded ? '680px' : '540px';

  return (
    <>
      {PortalFeedbackUI}
      <style>{`
        @keyframes pchat-fab-ring {
          0%   { transform: scale(1);    opacity: 0.7; }
          100% { transform: scale(1.35); opacity: 0;   }
        }
        @keyframes pchat-panel-in {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes pchat-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes pchat-bounce {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.4; }
          40%            { transform: scale(1.1);  opacity: 1;   }
        }
        .pchat-fab {
          position: fixed; bottom: 28px; right: 28px; z-index: 9100;
          width: 56px; height: 56px; border-radius: 50%; border: none;
          background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%);
          box-shadow: 0 8px 28px rgba(245,158,11,0.45), inset 0 1px 3px rgba(255,255,255,0.4);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.22s;
          outline: none;
        }
        .pchat-fab:hover { transform: scale(1.1) translateY(-3px); box-shadow: 0 14px 36px rgba(245,158,11,0.55); }
        .pchat-fab:active { transform: scale(0.94); }
        .pchat-fab--open { background: linear-gradient(135deg, #1E293B, #0F172A); box-shadow: 0 8px 28px rgba(0,0,0,0.4); }
        .pchat-fab__ring {
          position: absolute; inset: -5px; border-radius: 50%;
          border: 2px solid rgba(245,158,11,0.5);
          animation: pchat-fab-ring 2.2s ease-out infinite;
          pointer-events: none;
        }
        .pchat-panel {
          position: fixed; bottom: 96px; right: 28px; z-index: 9100;
          display: flex; flex-direction: column; overflow: hidden;
          border-radius: 20px;
          animation: pchat-panel-in 0.26s cubic-bezier(.34,1.56,.64,1);
          transform-origin: bottom right;
          transition: width 0.22s ease, height 0.22s ease;
        }
        .pchat-panel--dark {
          background: linear-gradient(160deg, #0D1422 0%, #080C14 100%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 28px 72px rgba(0,0,0,0.65), 0 0 0 1px rgba(245,158,11,0.12);
        }
        .pchat-panel--light {
          background: #FFFFFF;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 20px 56px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06);
        }
        .pchat-msg { animation: pchat-msg-in 0.22s ease both; }
        .pchat-typing-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #F59E0B;
          animation: pchat-bounce 1.1s ease-in-out infinite;
        }
        .pchat-markdown p         { margin: 0 0 8px; line-height: 1.6; }
        .pchat-markdown p:last-child { margin-bottom: 0; }
        .pchat-markdown ul, .pchat-markdown ol { padding-left: 18px; margin: 0 0 8px; }
        .pchat-markdown li        { margin-bottom: 3px; }
        .pchat-chip:hover         { border-color: rgba(245,158,11,0.45) !important; }
        @media (max-width: 600px) {
          .pchat-panel { right: 12px; bottom: 84px; width: calc(100vw - 24px) !important; height: 72dvh !important; border-radius: 16px; }
          .pchat-fab   { bottom: 20px; right: 16px; }
        }
      `}</style>

      {/* ── FAB ── */}
      <button
        className={`pchat-fab ${open ? 'pchat-fab--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Ask your solar AI"
        aria-label="Open AI assistant"
      >
        <span className="pchat-fab__ring" />
        {open
          ? <X size={20} color="white" strokeWidth={2.5} />
          : <Sparkles size={20} color="#0A0E1A" strokeWidth={2.5} />
        }
      </button>

      {/* ── Panel ── */}
      {open && (
        <div
          className={`pchat-panel pchat-panel--${isDark ? 'dark' : 'light'}`}
          style={{ width: panelW, height: panelH }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 12px rgba(245,158,11,0.4)',
              }}>
                <Sparkles size={15} color="#0A0E1A" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 14,
                  color: isDark ? '#F0F4FF' : '#0A0E1A',
                }}>Solar Assistant</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#34D399',
                    boxShadow: '0 0 6px #34D399',
                  }} />
                  <span style={{ fontSize: 11, color: isDark ? '#8892A4' : '#64748B', fontFamily: "'DM Sans', sans-serif" }}>
                    Online · Smarter Energy, Smarter Living
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {messages.length > 0 && (
                <button
                  onClick={async () => { if (await portalConfirm('This will erase all messages in this conversation.')) setMessages([]); }}
                  style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: isDark ? '#8892A4' : '#94A3B8', cursor: 'pointer', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#8892A4' : '#94A3B8' }}
                title={expanded ? 'Compact' : 'Expand'}
              >
                {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#8892A4' : '#94A3B8' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Plan gate */}
            {canAccessAI === false && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '24px 12px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Crown size={24} color="#F59E0B" />
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 16, color: isDark ? '#F0F4FF' : '#0A0E1A', marginBottom: 8 }}>
                  Upgrade to use AI Chat
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: isDark ? '#8892A4' : '#64748B', lineHeight: 1.6, marginBottom: 20 }}>
                  AI chat is available on <strong style={{ color: '#F59E0B' }}>Basic</strong> and <strong style={{ color: '#F59E0B' }}>Premium</strong> plans.
                </div>
                <a href="/portal/profile" style={{
                  padding: '9px 20px', borderRadius: 9,
                  background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                  color: '#0A0E1A', fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700, fontSize: 13, textDecoration: 'none',
                }}>
                  View Plans →
                </a>
              </div>
            )}

            {/* Welcome / empty state */}
            {canAccessAI === true && messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 8px 8px' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', marginBottom: 14,
                  background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 24px rgba(245,158,11,0.3)',
                }}>
                  <Sparkles size={22} color="#0A0E1A" />
                </div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 17, color: isDark ? '#F0F4FF' : '#0A0E1A', marginBottom: 6 }}>
                  {user?.first_name ? `Hi ${user.first_name}!` : 'Hello!'} Ask me anything.
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: isDark ? '#8892A4' : '#64748B', lineHeight: 1.5, marginBottom: 20 }}>
                  I can explain your solar data, diagnose issues, and give energy-saving tips.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
                  {SUGGESTED.map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      className="pchat-chip"
                      onClick={() => sendMessage(label)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '9px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        background: 'rgba(245,158,11,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={13} color="#F59E0B" />
                      </div>
                      <span style={{ fontSize: 13, color: isDark ? '#CBD5E1' : '#475569', fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {canAccessAI === true && messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className="pchat-msg" style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '10px 13px',
                    borderRadius: isUser ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                    background: isUser
                      ? 'linear-gradient(135deg, #F59E0B, #FBBF24)'
                      : isDark ? '#111827' : '#F8FAFC',
                    border: isUser ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                    color: isUser ? '#0A0E1A' : (isDark ? '#E2E8F0' : '#1E293B'),
                    fontSize: 13, lineHeight: 1.6,
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: isUser ? '0 3px 10px rgba(245,158,11,0.2)' : 'none',
                  }}>
                    {isUser ? (
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</span>
                    ) : msg.content === '' ? (
                      // Typing dots
                      <div style={{ display: 'flex', gap: 5, padding: '3px 0' }}>
                        {[0, 1, 2].map(i => (
                          <div key={i} className="pchat-typing-dot" style={{ animationDelay: `${i * 0.18}s` }} />
                        ))}
                      </div>
                    ) : msg.isError ? (
                      <span style={{ color: '#F87171' }}>{msg.content}</span>
                    ) : (
                      <div className="pchat-markdown">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p>{children}</p>,
                            ul: ({ children }) => <ul>{children}</ul>,
                            ol: ({ children }) => <ol>{children}</ol>,
                            li: ({ children }) => <li>{children}</li>,
                            strong: ({ children }) => <strong style={{ color: '#F59E0B', fontWeight: 600 }}>{children}</strong>,
                            code: ({ children }) => (
                              <code style={{
                                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                padding: '1px 5px', borderRadius: 4, fontSize: 12,
                                fontFamily: 'monospace', color: '#FBBF24',
                              }}>{children}</code>
                            ),
                          }}
                        >
                          {normalizeContent(msg.content)}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: isDark ? '#4A5568' : '#94A3B8', marginTop: 3, fontFamily: "'DM Sans', sans-serif" }} key={ticks}>
                    {timeAgo(msg.ts)}
                  </span>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {canAccessAI !== false && (
            <div style={{
              padding: '10px 12px 14px',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
              flexShrink: 0,
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 8,
                background: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                borderRadius: 13, padding: '8px 8px 8px 13px',
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your solar system…"
                  rows={1}
                  disabled={canAccessAI === null}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    resize: 'none', color: isDark ? '#E2E8F0' : '#1E293B',
                    fontSize: 13, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif",
                    maxHeight: 100,
                  }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || streaming || canAccessAI === null}
                  style={{
                    width: 34, height: 34, borderRadius: 9, border: 'none', flexShrink: 0,
                    background: input.trim() && !streaming
                      ? 'linear-gradient(135deg, #F59E0B, #FBBF24)'
                      : isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                    color: input.trim() && !streaming ? '#0A0E1A' : isDark ? '#4A5568' : '#94A3B8',
                    cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    boxShadow: input.trim() && !streaming ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
                  }}
                >
                  {streaming
                    ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid transparent`, borderTop: `2px solid ${isDark ? '#4A5568' : '#94A3B8'}`, animation: 'portal-spin 0.8s linear infinite' }} />
                    : <Send size={14} />
                  }
                </button>
              </div>
              <p style={{ fontSize: 10, color: isDark ? '#4A5568' : '#94A3B8', textAlign: 'center', marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>
                AI may make mistakes · Shift+Enter for newline
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PortalChat;
