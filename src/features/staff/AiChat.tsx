import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Cpu, X, CornerDownLeft, ShieldAlert, WifiOff, BatteryWarning,
  BarChart3, Network, ArrowUpCircle, Expand, Shrink,
  ClipboardCopy, ClipboardCheck, Bot, Signal,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../shared/hooks/useIsMobile';

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

const COMMANDS = [
  { icon: BarChart3,    label: 'Summarize fleet health',     cmd: 'Summarize fleet health' },
  { icon: ShieldAlert,  label: 'Active alerts',               cmd: 'Show active alerts' },
  { icon: WifiOff,      label: 'Offline devices',             cmd: 'Which devices are offline?' },
  { icon: BatteryWarning, label: 'Battery status coim_001',  cmd: 'Battery status at coim_001' },
  { icon: Network,      label: 'Top sites by output',         cmd: 'Top 3 sites by generation today' },
  { icon: Signal,       label: 'Connectivity issues',         cmd: 'Connectivity issues today' },
];

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function normalizeStreamFragment(fragment: string): string | null {
  const cleaned = fragment.replace(/ /g, ' ');
  if (cleaned === '' || cleaned.trim() === '[KEEPALIVE]') return null;
  return cleaned;
}

function normalizeAssistantContent(content: string): string {
  return content
    .replace(/\[KEEPALIVE\]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart();
}

function extractStreamText(payload: string): string | null {
  if (!payload || payload === '[DONE]' || payload === '[KEEPALIVE]') return null;
  if (payload.startsWith('[ERROR]')) return payload;
  try {
    const parsed = JSON.parse(payload);
    const text =
      parsed?.content ?? parsed?.delta ?? parsed?.text ??
      parsed?.message?.content ?? parsed?.choices?.[0]?.delta?.content ??
      parsed?.choices?.[0]?.text;
    return typeof text === 'string' ? text : null;
  } catch {
    return payload;
  }
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTicks(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreamingRef.current ? 'instant' : 'smooth' } as any);
  }, [messages]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 112) + 'px';
    }
  }, [input]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const userMsg: Message = { role: 'user', content: trimmed, ts: Date.now() };
    const updated = [...messagesRef.current, userMsg];
    const asstMsg: Message = { role: 'assistant', content: '', ts: Date.now() };
    setMessages([...updated, asstMsg]);
    setInput('');
    setStreaming(true);
    isStreamingRef.current = true;
    try {
      const res = await fetch(`${API_BASE_URL}/ai/internal-chat/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) {
        const err = await res.text();
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: `Error: ${err}`, ts: Date.now(), isError: true }; return n; });
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) return;
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const token = line.slice(6);
          if (token === '[DONE]') break;
          if (token === '[KEEPALIVE]') continue;
          if (token.startsWith('[ERROR]')) {
            setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: token.slice(8), ts: Date.now(), isError: true }; return n; });
            break;
          }
          const text = normalizeStreamFragment(token.replace(/\\n/g, '\n'));
          if (!text) continue;
          setMessages(prev => { const n = [...prev]; const last = n[n.length - 1]; n[n.length - 1] = { ...last, content: last.content + text }; return n; });
        }
      }
      setMessages(prev => {
        const n = [...prev]; const last = n[n.length - 1];
        if (last?.role === 'assistant' && !last.isError && !normalizeAssistantContent(last.content))
          n[n.length - 1] = { ...last, content: 'No response generated. Please try again.' };
        return n;
      });
    } catch {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: 'assistant', content: 'Connection failed.', ts: Date.now(), isError: true }; return n; });
    } finally {
      setStreaming(false);
      isStreamingRef.current = false;
    }
  }, [streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const isFS = panelSize === 'fullscreen';
  const panelW = isFS ? '100vw' : isMobile ? 'calc(100vw - 16px)' : 'min(420px, calc(100vw - 48px))';
  const panelH = isFS ? '100dvh' : isMobile ? 'min(540px, 66dvh)' : 'min(580px, calc(100dvh - 132px))';
  const panelBottom = isFS ? 0 : isMobile ? 76 : 88;
  const panelRight  = isFS ? 0 : isMobile ? 8 : 24;
  const panelRadius = isFS ? 0 : 16;

  return (
    <>
      {/* FAB — pill shape */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`aif-fab ${open ? 'aif-fab--open' : ''}`}
        style={{
          bottom: isMobile ? 18 : 24,
          right: isMobile ? 14 : 24,
          width: isMobile ? 40 : 54,
          height: isMobile ? 40 : 54,
        }}
        title="Fleet AI (Ctrl+/)"
        aria-label={open ? 'Close Fleet AI' : 'Open Fleet AI'}
      >
        {open
          ? <X size={isMobile ? 16 : 20} strokeWidth={2.5} />
          : <Cpu size={isMobile ? 15 : 24} strokeWidth={2} />}
      </button>

      {open && isFS && <div className="aif-backdrop" onClick={() => setPanelSize('compact')} />}

      {open && (
        <div
          className={`aif-panel aif-panel--${isDark ? 'dark' : 'light'}`}
          style={{ bottom: panelBottom, right: panelRight, width: panelW, height: panelH, borderRadius: panelRadius }}
        >
          {/* Header */}
          <div className="aif-hdr">
            <div className="aif-hdr__left">
              <div className="aif-hdr__icon"><Bot size={13} strokeWidth={2} /></div>
              <span className="aif-hdr__name">360Watts Buddy</span>
              <span className="aif-hdr__divider" />
              <span className="aif-hdr__live"><span className="aif-live-dot" />LIVE</span>
            </div>
            <div className="aif-hdr__right">
              {messages.length > 0 && (
                <button className="aif-hdr-btn" onClick={() => setMessages([])}>CLR</button>
              )}
              <button className="aif-hdr-btn aif-hdr-btn--icon" onClick={() => setPanelSize(s => s === 'compact' ? 'fullscreen' : 'compact')}>
                {isFS ? <Shrink size={12} /> : <Expand size={12} />}
              </button>
              <button className="aif-hdr-btn aif-hdr-btn--icon" onClick={() => setOpen(false)}><X size={12} /></button>
            </div>
          </div>

          {/* Status strip */}
          <div className="aif-strip">
            <span className="aif-strip__tag">INTERNAL OPS</span>
            <span className="aif-strip__sep">·</span>
            <span className="aif-strip__hint">Ctrl+/ to toggle</span>
            <span className="aif-strip__spacer" />
            <span className="aif-strip__hint">Enter to send</span>
          </div>

          {/* Messages */}
          <div className="aif-msgs">
            {messages.length === 0 && (
              <div className="aif-empty">
                <p className="aif-empty__prompt">$ <span className="aif-cursor" /></p>
                <p className="aif-empty__sub">Query fleet, devices, and telemetry in plain language.</p>
                <div className="aif-cmds">
                  {COMMANDS.map(({ icon: Icon, label, cmd }) => (
                    <button key={cmd} className="aif-cmd" onClick={() => sendMessage(cmd)}>
                      <Icon size={13} className="aif-cmd__icon" strokeWidth={1.75} />
                      <span>{label}</span>
                      <CornerDownLeft size={11} className="aif-cmd__enter" strokeWidth={2} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`aif-msg aif-msg--${msg.role}`}>
                {msg.role === 'user' ? (
                  <div className="aif-msg__user">
                    <span className="aif-msg__prompt">you</span>
                    <span className="aif-msg__user-text">{msg.content}</span>
                    <span className="aif-msg__ts" key={ticks}>{timeAgo(msg.ts)}</span>
                  </div>
                ) : (
                  <div className="aif-msg__asst">
                    <div className="aif-msg__asst-header">
                      <span className="aif-msg__prompt aif-msg__prompt--ai">buddy</span>
                      <span className="aif-msg__ts" key={ticks}>{timeAgo(msg.ts)}</span>
                    </div>
                    {msg.content === '' ? (
                      <div className="aif-typing"><span /><span /><span /></div>
                    ) : (
                      <div className={`aif-md ${msg.isError ? 'aif-md--err' : ''}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              const codeStr = String(children).replace(/\n$/, '');
                              const cid = `c${i}-${codeStr.slice(0, 12)}`;
                              if (match) return (
                                <div className="aif-code">
                                  <div className="aif-code__bar">
                                    <span className="aif-code__lang">{match[1]}</span>
                                    <button className="aif-code__copy" onClick={() => copyCode(codeStr, cid)}>
                                      {copiedId === cid ? <><ClipboardCheck size={11} /> copied</> : <><ClipboardCopy size={11} /> copy</>}
                                    </button>
                                  </div>
                                  <SyntaxHighlighter style={isDark ? oneDark : oneLight} language={match[1]} PreTag="div" wrapLongLines customStyle={{ margin: 0, borderRadius: '0 0 6px 6px', fontSize: '0.74rem' }}>{codeStr}</SyntaxHighlighter>
                                </div>
                              );
                              return <code className={`aif-inline-code ${className || ''}`} {...props}>{children}</code>;
                            },
                            table:      ({ children, ...p }: any) => <div className="aif-tbl-wrap"><table {...p}>{children}</table></div>,
                            h1: ({ children }: any) => <h1 className="aif-md-h">{children}</h1>,
                            h2: ({ children }: any) => <h2 className="aif-md-h">{children}</h2>,
                            h3: ({ children }: any) => <h3 className="aif-md-h">{children}</h3>,
                            hr: () => <hr className="aif-md-hr" />,
                          }}
                        >
                          {normalizeAssistantContent(msg.content)}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="aif-input-area">
            <div className="aif-composer">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ask about fleet, devices, alerts, telemetry…"
                className="aif-textarea"
                disabled={streaming}
                rows={1}
              />
              <div className="aif-composer-bar">
                <span className="aif-composer-mode">
                  <span className="aif-composer-dollar">$</span>
                  <span className="aif-composer-ctx">ops</span>
                </span>
                <span className="aif-composer-keys">
                  <kbd>↑</kbd> send · <kbd>⇧↵</kbd> newline
                </span>
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || streaming}
                  className={`aif-send-btn ${input.trim() && !streaming ? 'aif-send-btn--active' : 'aif-send-btn--idle'}`}
                  title="Send (Enter)"
                >
                  {streaming
                    ? <span className="aif-spinner" />
                    : <ArrowUpCircle size={17} strokeWidth={2} />
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        /* ── FAB ── */
        .aif-fab {
          position: fixed; z-index: 9000;
          height: 40px; border: none; cursor: pointer;
          border-radius: 20px;
          display: flex; align-items: center; gap: 7px;
          padding: 0 16px 0 12px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em;
          transition: all 0.22s cubic-bezier(.34,1.4,.64,1);
          outline: none;
          overflow: hidden;
        }
        .aif-fab:not(.aif-fab--open) {
          background:
            radial-gradient(circle at 30% 25%, rgba(103,232,249,0.34), transparent 48%),
            linear-gradient(145deg, rgba(8,18,28,0.96) 0%, rgba(7,28,44,0.96) 52%, rgba(6,8,16,0.98) 100%);
          color: #67e8f9;
          border: 1px solid rgba(103,232,249,0.42);
          backdrop-filter: blur(12px);
          box-shadow:
            0 10px 32px rgba(2,8,23,0.62),
            0 0 0 1px rgba(103,232,249,0.14),
            0 0 28px rgba(34,211,238,0.22),
            inset 0 1px 0 rgba(255,255,255,0.1);
          padding: 0; justify-content: center;
          border-radius: 50%;
        }
        .aif-fab:not(.aif-fab--open):hover {
          background:
            radial-gradient(circle at 30% 25%, rgba(125,211,252,0.46), transparent 52%),
            linear-gradient(145deg, rgba(10,24,38,0.98) 0%, rgba(8,38,58,0.98) 52%, rgba(6,10,18,1) 100%);
          border-color: rgba(125,211,252,0.62);
          box-shadow:
            0 14px 36px rgba(2,8,23,0.68),
            0 0 34px rgba(34,211,238,0.3),
            inset 0 1px 0 rgba(255,255,255,0.16);
          transform: translateY(-2px);
        }
        .aif-fab--open {
          background:
            linear-gradient(145deg, rgba(15,23,42,0.94) 0%, rgba(12,34,52,0.94) 100%);
          color: #f8fafc;
          border: 1px solid rgba(125,211,252,0.26);
          backdrop-filter: blur(12px);
          box-shadow:
            0 8px 24px rgba(2,8,23,0.5),
            0 0 22px rgba(56,189,248,0.14);
          padding: 0; justify-content: center;
          border-radius: 50%;
        }
        .aif-fab--open:hover {
          background:
            linear-gradient(145deg, rgba(18,30,50,0.98) 0%, rgba(14,44,68,0.98) 100%);
          color: #ffffff;
        }
        /* ── Backdrop ── */
        .aif-backdrop {
          position: fixed; inset: 0; z-index: 8999;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
          animation: aifFadeIn 0.18s ease;
        }
        @keyframes aifFadeIn { from{opacity:0} to{opacity:1} }

        /* ── Panel ── */
        .aif-panel {
          position: fixed; z-index: 9000;
          display: flex; flex-direction: column; overflow: hidden;
          animation: aifIn 0.26s cubic-bezier(.34,1.3,.64,1);
          transform-origin: bottom right;
          font-family: 'IBM Plex Sans', sans-serif;
          max-width: calc(100vw - 16px);
          max-height: calc(100dvh - 16px);
        }
        @keyframes aifIn {
          0%   { opacity:0; transform:scale(0.91) translateY(16px); filter:blur(3px); }
          55%  { opacity:1; filter:blur(0); }
          100% { opacity:1; transform:scale(1) translateY(0); filter:blur(0); }
        }

        /* Glass panel variants — liquid glass 2026 */
        .aif-panel--dark {
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"),
            linear-gradient(150deg, rgba(14,20,40,0.92) 0%, rgba(6,8,16,0.96) 100%);
          border: 1px solid rgba(56,189,248,0.1);
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          box-shadow:
            0 40px 100px rgba(0,0,0,0.85),
            0 0 0 1px rgba(255,255,255,0.04),
            inset 0 1px 0 rgba(255,255,255,0.05),
            inset 0 -1px 0 rgba(0,0,0,0.3);
        }
        .aif-panel--light {
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E"),
            linear-gradient(150deg, rgba(248,250,252,0.94) 0%, rgba(241,245,249,0.96) 100%);
          border: 1px solid rgba(56,189,248,0.18);
          backdrop-filter: blur(20px) saturate(1.6);
          -webkit-backdrop-filter: blur(20px) saturate(1.6);
          box-shadow:
            0 28px 72px rgba(0,0,0,0.16),
            0 0 0 1px rgba(56,189,248,0.06),
            inset 0 1px 0 rgba(255,255,255,0.9);
        }

        /* ── Header ── */
        .aif-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 14px; height: 44px; flex-shrink: 0;
          border-bottom: 1px solid;
          gap: 8px;
        }
        .aif-panel--dark .aif-hdr {
          border-color: rgba(56,189,248,0.08);
          background: rgba(255,255,255,0.025);
          backdrop-filter: blur(8px);
        }
        .aif-panel--light .aif-hdr {
          border-color: rgba(56,189,248,0.12);
          background: rgba(255,255,255,0.65);
          backdrop-filter: blur(8px);
        }
        .aif-hdr__left {
          display: flex; align-items: center; gap: 8px;
          min-width: 0;
          flex: 1;
        }
        .aif-hdr__icon {
          width: 26px; height: 26px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(56,189,248,0.12); color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.2);
        }
        .aif-hdr__name {
          font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 0.8rem;
          letter-spacing: 0.02em;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .aif-panel--dark .aif-hdr__name { color: #e2e8f0; }
        .aif-panel--light .aif-hdr__name { color: #0f172a; }
        .aif-hdr__divider { width: 1px; height: 14px; background: currentColor; opacity: 0.15; }
        .aif-hdr__live {
          display: flex; align-items: center; gap: 5px;
          font-family: 'IBM Plex Mono', monospace; font-size: 0.64rem;
          font-weight: 600; letter-spacing: 0.1em; color: #34d399;
        }
        .aif-live-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #34d399;
          box-shadow: 0 0 6px #34d399; animation: aifPulse 2.5s ease-in-out infinite;
        }
        @keyframes aifPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .aif-hdr__right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .aif-hdr-btn {
          height: 26px; border: none; cursor: pointer; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; font-weight: 600;
          letter-spacing: 0.06em; padding: 0 8px;
          transition: background 0.15s, color 0.15s;
        }
        .aif-hdr-btn--icon { width: 26px; padding: 0; }
        .aif-panel--dark .aif-hdr-btn { background: rgba(255,255,255,0.05); color: #cbd5e1; }
        .aif-panel--dark .aif-hdr-btn:hover { background: rgba(255,255,255,0.09); color: #f8fafc; }
        .aif-panel--light .aif-hdr-btn { background: rgba(0,0,0,0.04); color: var(--muted-foreground); }
        .aif-panel--light .aif-hdr-btn:hover { background: rgba(0,0,0,0.08); color: #475569; }

        /* ── Status strip ── */
        .aif-strip {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 14px; flex-shrink: 0;
          font-family: 'IBM Plex Mono', monospace; font-size: 0.63rem;
          letter-spacing: 0.06em;
          border-bottom: 1px solid;
          flex-wrap: wrap;
        }
        .aif-panel--dark .aif-strip { border-color: rgba(255,255,255,0.04); background: rgba(56,189,248,0.03); }
        .aif-panel--light .aif-strip { border-color: rgba(0,0,0,0.05); background: rgba(56,189,248,0.04); }
        .aif-strip__tag {
          font-weight: 600; color: #38bdf8; letter-spacing: 0.1em; font-size: 0.6rem;
        }
        .aif-strip__sep { opacity: 0.3; }
        .aif-strip__spacer { flex: 1; }
        .aif-panel--dark .aif-strip__hint { color: #cbd5e1; }
        .aif-panel--light .aif-strip__hint { color: var(--muted-foreground); }

        /* ── Messages ── */
        .aif-msgs {
          flex: 1; overflow-y: auto; overflow-x: hidden; padding: 14px;
          display: flex; flex-direction: column; gap: 4px;
          min-height: 0;
        }
        .aif-panel--dark .aif-msgs::-webkit-scrollbar { width: 3px; }
        .aif-panel--dark .aif-msgs::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.15); border-radius: 2px; }
        .aif-panel--light .aif-msgs::-webkit-scrollbar { width: 3px; }
        .aif-panel--light .aif-msgs::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

        /* ── Empty state ── */
        .aif-empty { display: flex; flex-direction: column; gap: 12px; animation: aifFadeIn 0.3s ease; }
        .aif-empty__prompt {
          font-family: 'IBM Plex Mono', monospace; font-size: 0.9rem; font-weight: 500;
          display: flex; align-items: center; gap: 4px; margin: 0;
        }
        .aif-panel--dark .aif-empty__prompt { color: #38bdf8; }
        .aif-panel--light .aif-empty__prompt { color: #0284c7; }
        .aif-cursor {
          display: inline-block; width: 8px; height: 15px;
          background: currentColor; opacity: 0.7;
          animation: aifBlink 1.1s step-end infinite;
        }
        @keyframes aifBlink { 0%,100%{opacity:0.7} 50%{opacity:0} }
        .aif-empty__sub {
          font-size: 0.78rem; margin: 0; line-height: 1.5;
        }
        .aif-panel--dark .aif-empty__sub { color: #e2e8f0; }
        .aif-panel--light .aif-empty__sub { color: var(--muted-foreground); }
        .aif-cmds { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
        .aif-cmd {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 8px; cursor: pointer; border: none;
          font-family: 'IBM Plex Sans', sans-serif; font-size: 0.8rem; font-weight: 500;
          transition: all 0.15s; text-align: left;
        }
        .aif-panel--dark .aif-cmd {
          background: linear-gradient(145deg, rgba(255,255,255,0.045), rgba(56,189,248,0.035)); color: #f8fafc;
          border: 1px solid rgba(125,211,252,0.12);
        }
        .aif-panel--dark .aif-cmd:hover {
          background: linear-gradient(145deg, rgba(56,189,248,0.11), rgba(34,211,238,0.08));
          color: #ffffff;
          border-color: rgba(103,232,249,0.3);
          transform: translateX(2px);
        }
        .aif-panel--light .aif-cmd {
          background: rgba(255,255,255,0.7); color: var(--muted-foreground);
          border: 1px solid rgba(0,0,0,0.06);
        }
        .aif-panel--light .aif-cmd:hover { background: rgba(56,189,248,0.06); color: #0f172a; border-color: rgba(56,189,248,0.25); }
        .aif-cmd__icon { flex-shrink: 0; }
        .aif-panel--dark .aif-cmd__icon { color: #38bdf8; }
        .aif-panel--light .aif-cmd__icon { color: #0284c7; }
        .aif-cmd__enter { margin-left: auto; flex-shrink: 0; opacity: 0; transition: opacity 0.15s; }
        .aif-cmd:hover .aif-cmd__enter { opacity: 0.5; }

        /* ── Message rows ── */
        .aif-msg { animation: aifMsgIn 0.18s ease; }
        @keyframes aifMsgIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

        .aif-msg__user {
          display: flex; align-items: baseline; gap: 8px;
          padding: 6px 0; border-bottom: 1px dashed;
          margin-bottom: 2px;
          flex-wrap: wrap;
        }
        .aif-panel--dark  .aif-msg__user { border-color: rgba(255,255,255,0.05); }
        .aif-panel--light .aif-msg__user { border-color: rgba(0,0,0,0.06); }
        .aif-msg__prompt {
          font-family: 'IBM Plex Mono', monospace; font-size: 0.68rem;
          font-weight: 600; letter-spacing: 0.06em; flex-shrink: 0;
        }
        .aif-panel--dark  .aif-msg__prompt { color: #bae6fd; }
        .aif-panel--light .aif-msg__prompt { color: #cbd5e1; }
        .aif-msg__prompt--ai { color: #38bdf8 !important; }
        .aif-msg__user-text {
          font-size: 0.84rem; line-height: 1.5; flex: 1;
          white-space: pre-wrap; word-break: break-word;
        }
        .aif-panel--dark  .aif-msg__user-text { color: #f8fafc; }
        .aif-panel--light .aif-msg__user-text { color: #334155; }
        .aif-msg__ts {
          font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem;
          flex-shrink: 0; opacity: 0.35; letter-spacing: 0.04em;
        }
        .aif-panel--dark  .aif-msg__ts { color: #e2e8f0; }
        .aif-panel--light .aif-msg__ts { color: var(--muted-foreground); }

        .aif-msg__asst { padding: 8px 0 10px; border-left: 2px solid; padding-left: 12px; margin: 2px 0 6px; }
        .aif-panel--dark  .aif-msg__asst { border-color: rgba(56,189,248,0.35); }
        .aif-panel--light .aif-msg__asst { border-color: rgba(2,132,199,0.35); }
        .aif-msg__asst-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }

        /* ── Markdown ── frosted AI output area (liquid glass 2026) */
        .aif-msg__asst .aif-md:not(.aif-md--err) {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 0.83rem; line-height: 1.68; overflow-wrap: anywhere;
          max-width: 100%;
        }
        .aif-panel--dark .aif-msg__asst .aif-md:not(.aif-md--err) {
          background: rgba(56,189,248,0.04);
          border: 1px solid rgba(56,189,248,0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .aif-panel--light .aif-msg__asst .aif-md:not(.aif-md--err) {
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(56,189,248,0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .aif-md--err { padding: 8px 10px; border-radius: 7px; }
        .aif-md {
          font-size: clamp(0.77rem, 0.72rem + 0.16vw, 0.83rem);
          line-height: 1.68;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .aif-panel--dark  .aif-md { color: #f8fafc; }
        .aif-panel--light .aif-md { color: #1e293b; }
        .aif-md--err { }
        .aif-panel--dark  .aif-md--err { color: #f87171 !important; }
        .aif-panel--light .aif-md--err { color: #b91c1c !important; }
        .aif-md p  { margin: 0 0 0.5em; }
        .aif-md p:last-child { margin: 0; }
        .aif-md ul,.aif-md ol { padding-left: 1.2em; margin: 0.3em 0; }
        .aif-md li { margin: 0.18em 0; }
        .aif-md strong { font-weight: 700; color: #38bdf8; }
        .aif-panel--light .aif-md strong { color: #0284c7; }
        .aif-md a { color: #38bdf8; }
        .aif-panel--light .aif-md a { color: #0284c7; }
        .aif-md blockquote { border-left: 2px solid #38bdf8; padding-left: 10px; margin: 0.4em 0; opacity: 0.8; }
        .aif-md hr { border: none; border-top: 1px solid; margin: 0.6em 0; opacity: 0.15; }
        /* Headings — scaled down to fit panel, monospace for ops feel */
        .aif-md h1,.aif-md h2,.aif-md h3 {
          font-family: 'IBM Plex Mono', monospace; font-weight: 600;
          margin: 0.6em 0 0.3em; line-height: 1.3; letter-spacing: -0.01em;
          overflow-wrap: anywhere;
        }
        .aif-md h1 { font-size: 1em; }
        .aif-md h2 { font-size: 0.92em; }
        .aif-md h3 { font-size: 0.86em; }
        .aif-panel--dark  .aif-md h1,.aif-panel--dark  .aif-md h2,.aif-panel--dark  .aif-md h3 { color: #7dd3fc; }
        .aif-panel--light .aif-md h1,.aif-panel--light .aif-md h2,.aif-panel--light .aif-md h3 { color: #0284c7; }
        .aif-inline-code {
          font-family: 'IBM Plex Mono', monospace; font-size: 0.78em;
          padding: 1px 5px; border-radius: 4px;
        }
        .aif-panel--dark  .aif-inline-code { background: rgba(56,189,248,0.1); color: #7dd3fc; }
        .aif-panel--light .aif-inline-code { background: rgba(2,132,199,0.08); color: #0284c7; }
        .aif-tbl-wrap {
          overflow-x: auto;
          margin: 0.65em 0 0.4em;
          max-width: 100%;
          border-radius: 10px;
        }
        .aif-tbl-wrap::-webkit-scrollbar { height: 4px; }
        .aif-tbl-wrap::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 2px; }
        .aif-panel--dark .aif-tbl-wrap {
          background: linear-gradient(180deg, rgba(10,20,32,0.92), rgba(7,14,24,0.92));
          border: 1px solid rgba(125,211,252,0.14);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .aif-panel--light .aif-tbl-wrap {
          background: rgba(255,255,255,0.8);
          border: 1px solid rgba(2,132,199,0.12);
        }
        .aif-md table {
          border-collapse: separate;
          border-spacing: 0;
          font-size: 0.82em;
          width: 100%;
          min-width: min(440px, 100%);
          table-layout: auto;
        }
        .aif-md th,.aif-md td {
          padding: 8px 10px;
          border: 1px solid;
          text-align: left;
          vertical-align: top;
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .aif-panel--dark  .aif-md th,.aif-panel--dark  .aif-md td { border-color: rgba(56,189,248,0.12); }
        .aif-panel--dark  .aif-md th {
          background: linear-gradient(180deg, rgba(56,189,248,0.14), rgba(56,189,248,0.08));
          color: #bae6fd;
          font-weight: 700;
        }
        .aif-panel--dark .aif-md td { color: #f8fafc; }
        .aif-panel--dark .aif-md tbody tr:nth-child(odd) td { background: rgba(255,255,255,0.015); }
        .aif-panel--dark .aif-md tbody tr:nth-child(even) td { background: rgba(56,189,248,0.03); }
        .aif-panel--light .aif-md th,.aif-panel--light .aif-md td { border-color: rgba(0,0,0,0.08); }
        .aif-panel--light .aif-md th {
          background: rgba(2,132,199,0.07);
          color: #0284c7;
          font-weight: 700;
        }
        .aif-panel--light .aif-md tbody tr:nth-child(odd) td { background: rgba(255,255,255,0.72); }
        .aif-panel--light .aif-md tbody tr:nth-child(even) td { background: rgba(248,250,252,0.92); }

        /* ── Code block ── */
        .aif-code { border-radius: 7px; overflow: hidden; margin: 6px 0; }
        .aif-panel--dark  .aif-code { border: 1px solid rgba(56,189,248,0.12); }
        .aif-panel--light .aif-code { border: 1px solid rgba(0,0,0,0.09); }
        .aif-code__bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 4px 10px; font-family: 'IBM Plex Mono', monospace;
        }
        .aif-panel--dark  .aif-code__bar { background: rgba(56,189,248,0.07); }
        .aif-panel--light .aif-code__bar { background: rgba(2,132,199,0.07); }
        .aif-code__lang { font-size: 0.66rem; font-weight: 600; color: #38bdf8; letter-spacing: 0.06em; }
        .aif-panel--light .aif-code__lang { color: #0284c7; }
        .aif-code__copy {
          display: flex; align-items: center; gap: 4px;
          background: none; border: 1px solid rgba(100,116,139,0.2); border-radius: 4px;
          padding: 2px 7px; cursor: pointer; font-size: 0.64rem; font-weight: 500;
          font-family: 'IBM Plex Mono', monospace; color: var(--muted-foreground);
          transition: all 0.15s;
        }
        .aif-panel--dark .aif-code__copy { color: #f8fafc; }
        .aif-code__copy:hover { color: #38bdf8; border-color: rgba(56,189,248,0.35); background: rgba(56,189,248,0.06); }

        /* ── Typing ── */
        .aif-typing { display: flex; gap: 5px; align-items: center; padding: 4px 0; }
        .aif-typing span { width: 5px; height: 5px; border-radius: 50%; background: #38bdf8; opacity: 0.4; animation: aifDot 1.2s ease-in-out infinite; }
        .aif-typing span:nth-child(2) { animation-delay: 0.2s; }
        .aif-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes aifDot { 0%,80%,100%{opacity:0.25;transform:translateY(0)} 40%{opacity:1;transform:translateY(-4px)} }

        /* ── Input ── */
        .aif-input-area {
          flex-shrink: 0; padding: 10px 12px 12px;
          border-top: 1px solid;
        }
        .aif-panel--dark .aif-input-area {
          border-color: rgba(56,189,248,0.08);
          background: rgba(6,8,16,0.65);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .aif-panel--light .aif-input-area {
          border-color: rgba(0,0,0,0.05);
          background: rgba(248,250,252,0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        /* Composer card */
        .aif-composer {
          border-radius: 14px; overflow: hidden;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .aif-panel--dark .aif-composer {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(56,189,248,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .aif-panel--light .aif-composer {
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(56,189,248,0.2);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .aif-composer:focus-within {
          border-color: #38bdf8 !important;
          box-shadow: 0 0 0 3px rgba(56,189,248,0.13) !important;
        }
        .aif-textarea {
          display: block; width: 100%; resize: none; border: none; outline: none;
          background: transparent; font-size: 0.845rem; line-height: 1.55;
          font-family: 'IBM Plex Sans', sans-serif; max-height: 112px;
          overflow-y: auto; padding: 10px 12px 6px;
          box-sizing: border-box;
        }
        .aif-panel--dark  .aif-textarea { color: #f8fafc; }
        .aif-panel--light .aif-textarea { color: #0f172a; }
        .aif-textarea::placeholder { color: #cfe8f7; }
        .aif-panel--light .aif-textarea::placeholder { color: var(--muted-foreground); }
        .aif-textarea:disabled { opacity: 0.35; cursor: not-allowed; }
        /* Composer action bar */
        .aif-composer-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 8px 7px 10px;
          border-top: 1px solid;
          flex-wrap: wrap;
        }
        .aif-panel--dark .aif-composer-bar {
          border-color: rgba(56,189,248,0.08);
          background: rgba(0,0,0,0.18);
        }
        .aif-panel--light .aif-composer-bar {
          border-color: rgba(0,0,0,0.05);
          background: rgba(241,245,249,0.7);
        }
        .aif-composer-mode {
          display: flex; align-items: center; gap: 4px;
          font-family: 'IBM Plex Mono', monospace; font-size: 0.68rem;
          user-select: none;
          background: rgba(56,189,248,0.1); border-radius: 5px;
          padding: 2px 7px;
        }
        .aif-composer-dollar { color: #38bdf8; font-weight: 700; }
        .aif-panel--dark  .aif-composer-ctx { color: #67e8f9; }
        .aif-panel--light .aif-composer-ctx { color: #0284c7; }
        .aif-composer-keys {
          flex: 1; font-family: 'IBM Plex Mono', monospace;
          font-size: 0.62rem; letter-spacing: 0.02em;
          min-width: 0;
        }
        .aif-panel--dark  .aif-composer-keys { color: #e2e8f0; }
        .aif-panel--light .aif-composer-keys { color: rgba(0,0,0,0.28); }
        .aif-composer-keys kbd {
          font-family: inherit; background: rgba(56,189,248,0.1);
          border-radius: 3px; padding: 0 3px;
        }
        .aif-panel--dark  .aif-composer-keys kbd { color: #38bdf8; }
        .aif-panel--light .aif-composer-keys kbd { color: #0284c7; }
        /* Send button — new circle design */
        .aif-send-btn {
          width: 30px; height: 30px; border-radius: 50%; border: none;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.17s; padding: 0; cursor: pointer;
        }
        .aif-send-btn--active {
          background: #38bdf8;
          color: #08121c;
          box-shadow: 0 3px 12px rgba(56,189,248,0.45);
        }
        .aif-send-btn--active:hover {
          background: #67d2fb;
          box-shadow: 0 5px 18px rgba(56,189,248,0.6);
          transform: scale(1.1) translateY(-1px);
        }
        .aif-send-btn--idle {
          background: rgba(56,189,248,0.07);
          color: rgba(56,189,248,0.25);
          cursor: not-allowed;
        }
        .aif-panel--light .aif-send-btn--idle {
          background: rgba(0,0,0,0.05);
          color: #cbd5e1;
        }
        .aif-spinner {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(56,189,248,0.18); border-top-color: #38bdf8;
          animation: aifSpin 0.7s linear infinite;
        }
        @keyframes aifSpin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .aif-cmds { gap: 2px; }
          .aif-cmd { padding: 7px 9px; font-size: 0.76rem; }
          .aif-msgs { padding: 11px; }
          .aif-msg__user-text { font-size: 0.8rem; }
          .aif-md { font-size: 0.79rem; }
        }
        @media (max-width: 980px), (max-height: 760px) {
          .aif-hdr { padding: 0 12px; height: 42px; }
          .aif-strip { padding: 6px 12px; }
          .aif-msgs { padding: 12px; }
          .aif-input-area { padding: 9px 10px 10px; }
          .aif-hdr__name { font-size: 0.76rem; }
          .aif-empty__sub,
          .aif-msg__user-text,
          .aif-textarea { font-size: 0.8rem; }
        }
        @media (max-width: 760px), (max-height: 640px) {
          .aif-hdr__divider,
          .aif-hdr__live,
          .aif-strip__sep,
          .aif-strip__spacer { display: none; }
          .aif-strip { gap: 6px; justify-content: space-between; }
          .aif-composer-keys { width: 100%; flex-basis: 100%; order: 3; }
          .aif-send-btn { margin-left: auto; }
          .aif-md table { min-width: 320px; }
        }
      `}</style>
    </>
  );
};

export default AiChat;
