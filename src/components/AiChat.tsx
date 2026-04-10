import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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
  'Which devices are offline?',
  'Show active alerts',
  'Battery status at coim_001',
  'List all sites',
];

const AiChat: React.FC = () => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const bg = isDark ? '#111827' : '#ffffff';
  const surface = isDark ? '#1f2937' : '#f8fafc';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);

    // Append empty assistant message that we'll fill via streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
          next[next.length - 1] = { role: 'assistant', content: `Error: ${err}` };
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
              next[next.length - 1] = { role: 'assistant', content: token.slice(8) };
              return next;
            });
            break;
          }
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + token };
            return next;
          });
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: `Failed to connect to AI service.` };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        title="AI Assistant"
      >
        {open ? <ChevronDown size={22} color="white" /> : <Bot size={22} color="white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: 88, right: 24, zIndex: 9000,
            width: 380, height: 560,
            background: bg,
            borderRadius: 16,
            border: `1px solid ${border}`,
            boxShadow: isDark
              ? '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)'
              : '0 25px 60px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${border}`,
            background: isDark ? '#1a2332' : '#f0f7ff',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={17} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: textPrimary }}>360Watts Assistant</div>
                <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Read-only · Real-time data
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textMuted, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6 }}
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textMuted, padding: 4, borderRadius: 6, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, paddingBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={24} color="white" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: textPrimary, marginBottom: 4 }}>How can I help?</div>
                  <div style={{ fontSize: '0.78rem', color: textMuted }}>Ask me about devices, sites, alerts, or telemetry.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  {SUGGESTED.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      style={{
                        padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`,
                        background: surface, color: textPrimary, fontSize: '0.78rem',
                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '9px 13px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                      : surface,
                    color: msg.role === 'user' ? '#fff' : textPrimary,
                    fontSize: '0.82rem',
                    lineHeight: 1.55,
                    border: msg.role === 'assistant' ? `1px solid ${border}` : 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content === '' && msg.role === 'assistant' ? (
                    // Typing indicator
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
                      {[0, 1, 2].map(dot => (
                        <span
                          key={dot}
                          style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: textMuted,
                            display: 'inline-block',
                            animation: `aiDotBounce 1.2s ${dot * 0.2}s ease-in-out infinite`,
                          }}
                        />
                      ))}
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: `1px solid ${border}`,
            background: bg,
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: surface,
              border: `1px solid ${border}`,
              borderRadius: 10, padding: '8px 10px',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything…"
                rows={1}
                disabled={streaming}
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none',
                  background: 'transparent', color: textPrimary,
                  fontSize: '0.83rem', lineHeight: 1.5, fontFamily: 'inherit',
                  maxHeight: 96, overflowY: 'auto',
                  opacity: streaming ? 0.6 : 1,
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || streaming}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
                  background: (!input.trim() || streaming) ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)') : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  cursor: (!input.trim() || streaming) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <Send size={14} color={(!input.trim() || streaming) ? textMuted : 'white'} />
              </button>
            </div>
            <div style={{ fontSize: '0.67rem', color: textMuted, textAlign: 'center', marginTop: 6 }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes aiDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default AiChat;
