import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, SunMedium, BatteryCharging, TrendingUp, Lightbulb,
  Maximize2, Minimize2, Gem, Star, StarOff, CircleAlert,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  starred?: boolean;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://api.360watts.com/api';

const CHIPS = [
  { icon: SunMedium,       label: 'How much solar today?',              q: 'How much solar am I generating today?' },
  { icon: BatteryCharging, label: 'Battery status',                     q: "What's my battery status?" },
  { icon: TrendingUp,      label: 'Energy savings this month',          q: 'Show my energy savings this month' },
  { icon: Lightbulb,       label: 'Tips for better efficiency',         q: 'Tips to improve solar efficiency' },
];

function getAuthHeaders(): HeadersInit {
  const raw = localStorage.getItem('authTokens');
  if (raw) {
    try { const t = JSON.parse(raw); return { Authorization: `Bearer ${t.access}`, 'Content-Type': 'application/json' }; }
    catch {}
  }
  return { 'Content-Type': 'application/json' };
}

function normalizeFragment(f: string): string | null {
  const c = f.replace(/&nbsp;/g, ' ');
  if (c === '' || c.trim() === '[KEEPALIVE]') return null;
  return c;
}

function normalizeContent(s: string): string {
  return s.replace(/\[KEEPALIVE\]/g, '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimStart();
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */
interface PortalChatProps {
  openRef?: React.MutableRefObject<(() => void) | null>;
}

const PortalChat: React.FC<PortalChatProps> = ({ openRef }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRef) openRef.current = () => setOpen(true);
    return () => { if (openRef) openRef.current = null; };
  }, [openRef]);

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

  useEffect(() => {
    (async () => {
      try {
        const data: any = await apiService.getPortalSummary();
        const v = data?.plan_features?.can_access_ai;
        if (v !== undefined) { setCanAccessAI(v); return; }
        const profile: any = await apiService.getProfile();
        setCanAccessAI(profile?.plan_type !== 'free');
      } catch {
        try { const p: any = await apiService.getProfile(); setCanAccessAI(p?.plan_type !== 'free'); }
        catch { setCanAccessAI(true); }
      }
    })();
  }, []);

  useEffect(() => { const id = setInterval(() => setTicks(t => t + 1), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: isStreamingRef.current ? 'instant' : 'smooth' } as any); }, [messages]);
  useEffect(() => { if (open) setTimeout(() => textareaRef.current?.focus(), 80); }, [open]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 96) + 'px';
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed, ts: Date.now() };
    const history = [...messagesRef.current, userMsg];
    const asstMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', ts: Date.now() };
    setMessages([...history, asstMsg]);
    setInput('');
    setStreaming(true);
    isStreamingRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/ai/user-chat/`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ messages: history.map(m => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) {
        const e = await res.text();
        const msg = res.status === 403 ? 'AI chat requires a Basic or Premium plan.' : res.status === 503 ? 'AI service is temporarily unavailable.' : `Something went wrong: ${e}`;
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { ...asstMsg, content: msg, isError: true }; return n; });
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
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const tok = line.slice(6);
          if (tok === '[DONE]') break;
          if (tok === '[KEEPALIVE]') continue;
          if (tok.startsWith('[ERROR]')) { setMessages(prev => { const n = [...prev]; n[n.length - 1] = { ...asstMsg, content: tok.slice(8), ts: Date.now(), isError: true }; return n; }); break; }
          const frag = normalizeFragment(tok?.replace(/\\n/g, '\n') ?? '');
          if (!frag) continue;
          setMessages(prev => { const n = [...prev]; const last = n[n.length - 1]; n[n.length - 1] = { ...last, content: last.content + frag }; return n; });
        }
      }
    } catch {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { ...n[n.length - 1], content: 'Connection lost. Please try again.', ts: Date.now(), isError: true }; return n; });
    } finally { setStreaming(false); isStreamingRef.current = false; }
  }, [streaming]);

  const toggleStar = (id: string) => setMessages(prev => prev.map(m => m.id === id ? { ...m, starred: !m.starred } : m));
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } };

  const W = expanded ? '460px' : '380px';
  const H = expanded ? '660px' : '540px';
  const d = isDark;

  const firstName = (user as any)?.first_name;

  return (
    <>
      {PortalFeedbackUI}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Figtree:wght@400;500;600&display=swap');

        @keyframes pc2-ring   { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.42);opacity:0} }
        @keyframes pc2-in {
          0%   { opacity:0; transform:scale(0.90) translateY(20px); filter:blur(4px); }
          60%  { opacity:1; filter:blur(0); }
          100% { opacity:1; transform:scale(1) translateY(0); filter:blur(0); }
        }
        @keyframes pc2-msg    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pc2-dot    { 0%,80%,100%{transform:translateY(0);opacity:0.3} 40%{transform:translateY(-5px);opacity:1} }
        @keyframes pc2-spin   { to{transform:rotate(360deg)} }
        @keyframes pc2-rays   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pc2-glow   { 0%,100%{box-shadow:0 0 16px rgba(251,191,36,0.4)} 50%{box-shadow:0 0 28px rgba(251,191,36,0.7)} }
        @keyframes pc2-fade   { from{opacity:0} to{opacity:1} }
        @keyframes pc2-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        .pc2-fab {
          position: fixed; bottom: 28px; right: 28px; z-index: 9100;
          width: 58px; height: 58px; border-radius: 50%; border: none;
          cursor: pointer; outline: none;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.26s cubic-bezier(.34,1.5,.64,1);
        }
        .pc2-fab--closed {
          background: conic-gradient(from 0deg, #F59E0B, #FBBF24, #FDE68A, #F59E0B);
          box-shadow: 0 6px 24px rgba(245,158,11,0.5), 0 2px 8px rgba(0,0,0,0.15);
          animation: pc2-glow 2.8s ease-in-out infinite;
        }
        .pc2-fab--closed:hover { transform: scale(1.1) translateY(-3px); }
        .pc2-fab--open {
          background: ${d ? 'rgba(30,41,59,0.95)' : 'rgba(241,245,249,0.95)'};
          border: 1.5px solid ${d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        }
        .pc2-fab__ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 2px solid rgba(245,158,11,0.45);
          animation: pc2-ring 2.6s ease-out infinite;
          pointer-events: none;
        }
        .pc2-fab--open .pc2-fab__ring { display: none; }
        .pc2-fab__rays {
          position: absolute; inset: -10px; border-radius: 50%;
          border: 1px dashed rgba(251,191,36,0.3);
          animation: pc2-rays 12s linear infinite;
          pointer-events: none;
        }
        .pc2-fab--open .pc2-fab__rays { display: none; }

        .pc2-panel {
          position: fixed; bottom: 96px; right: 28px; z-index: 9100;
          display: flex; flex-direction: column; overflow: hidden; border-radius: 24px;
          animation: pc2-in 0.3s cubic-bezier(.34,1.3,.64,1);
          transform-origin: bottom right;
          transition: width 0.26s cubic-bezier(.34,1.2,.64,1), height 0.26s cubic-bezier(.34,1.2,.64,1);
          font-family: 'Figtree', sans-serif;
        }
        .pc2-panel--dark {
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"),
            linear-gradient(160deg, rgba(16,22,40,0.93) 0%, rgba(6,7,14,0.97) 100%);
          border: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(22px) saturate(1.5);
          -webkit-backdrop-filter: blur(22px) saturate(1.5);
          box-shadow:
            0 40px 100px rgba(0,0,0,0.8),
            0 0 0 1px rgba(245,158,11,0.07),
            inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .pc2-panel--light {
          background:
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E"),
            rgba(254,254,254,0.95);
          border: 1px solid rgba(0,0,0,0.07);
          backdrop-filter: blur(22px) saturate(1.8);
          -webkit-backdrop-filter: blur(22px) saturate(1.8);
          box-shadow:
            0 28px 72px rgba(0,0,0,0.13),
            0 4px 16px rgba(0,0,0,0.05),
            inset 0 1px 0 rgba(255,255,255,1);
        }

        /* Header — frosted gradient (liquid glass 2026) */
        .pc2-hdr {
          flex-shrink: 0; padding: 20px 18px 16px; position: relative; overflow: hidden;
        }
        .pc2-hdr--dark {
          background: linear-gradient(145deg,
            rgba(245,158,11,0.16) 0%,
            rgba(251,191,36,0.08) 40%,
            rgba(47,191,113,0.10) 100%
          );
          border-bottom: 1px solid rgba(255,255,255,0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .pc2-hdr--light {
          background: linear-gradient(145deg,
            rgba(245,158,11,0.14) 0%,
            rgba(255,251,230,0.88) 50%,
            rgba(47,191,113,0.09) 100%
          );
          border-bottom: 1px solid rgba(0,0,0,0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .pc2-hdr__orb {
          position: absolute; top: -30px; right: -30px; width: 110px; height: 110px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%);
          pointer-events: none;
        }
        .pc2-hdr__top { display: flex; align-items: flex-start; justify-content: space-between; }
        .pc2-hdr__avatar {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #2FBF71 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(245,158,11,0.4), inset 0 1px 2px rgba(255,255,255,0.3);
          animation: pc2-float 5s ease-in-out infinite;
        }
        .pc2-hdr__controls { display: flex; gap: 4px; }
        .pc2-hdr-btn {
          width: 28px; height: 28px; border-radius: 8px; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s; background: transparent;
        }
        .pc2-hdr-btn--dark { color: rgba(255,255,255,0.4); }
        .pc2-hdr-btn--dark:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }
        .pc2-hdr-btn--light { color: rgba(0,0,0,0.35); }
        .pc2-hdr-btn--light:hover { background: rgba(0,0,0,0.07); color: rgba(0,0,0,0.65); }
        .pc2-hdr__greeting {
          font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 19px;
          letter-spacing: -0.02em; margin-top: 12px; line-height: 1.15;
        }
        .pc2-hdr__greeting--dark { color: #F9FAFB; }
        .pc2-hdr__greeting--light { color: #111827; }
        .pc2-hdr__sub { font-size: 13px; margin-top: 3px; line-height: 1.5; }
        .pc2-hdr__sub--dark { color: rgba(255,255,255,0.45); }
        .pc2-hdr__sub--light { color: rgba(0,0,0,0.45); }
        .pc2-hdr__status { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
        .pc2-hdr__dot { width: 7px; height: 7px; border-radius: 50%; background: #34D399; box-shadow: 0 0 8px #34D399; animation: pc2-dot 2.5s ease-in-out infinite; }
        .pc2-hdr__online { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
        .pc2-hdr__online--dark { color: rgba(255,255,255,0.35); }
        .pc2-hdr__online--light { color: rgba(0,0,0,0.35); }

        /* Body */
        .pc2-body {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 18px 16px; display: flex; flex-direction: column; gap: 18px;
        }
        .pc2-panel--dark .pc2-body::-webkit-scrollbar { width: 3px; }
        .pc2-panel--dark .pc2-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
        .pc2-panel--light .pc2-body::-webkit-scrollbar { width: 3px; }
        .pc2-panel--light .pc2-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 2px; }

        /* Welcome chips */
        .pc2-chips { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .pc2-chip {
          display: flex; flex-direction: column; gap: 8px;
          padding: 12px 12px; border-radius: 14px; cursor: pointer; border: none;
          text-align: left; transition: all 0.22s cubic-bezier(.34,1.3,.64,1);
          font-family: 'Figtree', sans-serif;
        }
        .pc2-chip--dark {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
          color: #CBD5E1;
        }
        .pc2-chip--light {
          background: #F8FAFC; border: 1px solid rgba(0,0,0,0.07);
          color: #334155;
        }
        .pc2-chip:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.35) !important; }
        .pc2-chip__icon {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,191,36,0.1));
        }
        .pc2-chip__label { font-size: 12px; font-weight: 600; line-height: 1.4; }

        /* Messages */
        .pc2-msg { display: flex; flex-direction: column; animation: pc2-msg 0.22s ease both; }

        /* User message */
        .pc2-user-bubble {
          align-self: flex-end; max-width: 82%;
          padding: 11px 15px; border-radius: 18px 18px 4px 18px;
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          color: #FFFFFF; font-size: 14px; line-height: 1.6; font-weight: 500;
          white-space: pre-wrap; word-break: break-word;
          box-shadow: 0 4px 16px rgba(245,158,11,0.3);
        }

        /* Assistant message — frosted glass card (liquid glass 2026) */
        .pc2-asst-card {
          max-width: 92%;
          border-radius: 4px 18px 18px 18px;
          overflow: hidden;
        }
        .pc2-asst-card--dark {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(22,32,56,0.55);
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          box-shadow: 0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .pc2-asst-card--light {
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(255,255,255,0.78);
          backdrop-filter: blur(16px) saturate(1.6);
          -webkit-backdrop-filter: blur(16px) saturate(1.6);
          box-shadow: 0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9);
        }
        .pc2-asst-card__body { padding: 12px 15px; }

        /* Typing */
        .pc2-typing { display: flex; gap: 5px; align-items: center; padding: 5px 0; }
        .pc2-dot { width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; animation: pc2-dot 1.2s ease-in-out infinite; }

        /* Asst footer */
        .pc2-asst-footer {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 15px 8px;
          border-top: 1px solid;
        }
        .pc2-asst-footer--dark  { border-color: rgba(255,255,255,0.05); }
        .pc2-asst-footer--light { border-color: rgba(0,0,0,0.05); }
        .pc2-footer-ts { font-size: 10.5px; flex: 1; }
        .pc2-footer-ts--dark  { color: rgba(255,255,255,0.35); }
        .pc2-footer-ts--light { color: rgba(0,0,0,0.38); }
        .pc2-star-btn {
          width: 24px; height: 24px; border-radius: 6px; border: none;
          background: transparent; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; padding: 0;
        }
        .pc2-star-btn:hover { transform: scale(1.2); }

        /* Timestamp row */
        .pc2-ts-row { display: flex; justify-content: flex-end; margin-top: 3px; }
        .pc2-user-ts { font-size: 10px; }
        .pc2-user-ts--dark  { color: rgba(255,255,255,0.2); }
        .pc2-user-ts--light { color: rgba(0,0,0,0.25); }

        /* Markdown */
        .pc2-md { font-size: 13.5px; line-height: 1.7; overflow-wrap: anywhere; }
        .pc2-md--dark  { color: #CBD5E1; }
        .pc2-md--light { color: #1E293B; }
        .pc2-md p { margin: 0 0 0.55em; }
        .pc2-md p:last-child { margin: 0; }
        .pc2-md ul,.pc2-md ol { padding-left: 1.25em; margin: 0.35em 0; }
        .pc2-md li { margin: 0.22em 0; line-height: 1.6; }
        .pc2-md strong { font-weight: 700; color: #F59E0B; }
        .pc2-md em { font-style: italic; }
        .pc2-md a { color: #2FBF71; text-decoration: underline; text-underline-offset: 2px; }
        .pc2-md blockquote {
          border-left: 3px solid #F59E0B; padding-left: 10px;
          margin: 0.5em 0; opacity: 0.85; font-style: italic;
        }
        .pc2-md-hr { border: none; border-top: 1px solid; margin: 0.7em 0; opacity: 0.12; }
        /* Headings — use Figtree (body font) so they don't stretch in the card */
        .pc2-md-h {
          font-family: 'Figtree', sans-serif; font-weight: 700;
          margin: 0.65em 0 0.25em; line-height: 1.3; letter-spacing: -0.01em;
        }
        .pc2-md-h1 { font-size: 1.02em; }
        .pc2-md-h2 { font-size: 0.94em; }
        .pc2-md-h3 { font-size: 0.88em; opacity: 0.9; }
        .pc2-md--dark  .pc2-md-h { color: #F1F5F9; }
        .pc2-md--light .pc2-md-h { color: #0F172A; }
        /* Inline code */
        .pc2-inline-code {
          font-family: 'Fira Code', 'JetBrains Mono', monospace; font-size: 0.8em;
          padding: 1px 5px; border-radius: 4px;
        }
        .pc2-md--dark  .pc2-inline-code { background: rgba(255,255,255,0.08); color: #FBBF24; }
        .pc2-md--light .pc2-inline-code { background: rgba(245,158,11,0.1); color: #B45309; }
        /* Code block */
        .pc2-code { border-radius: 8px; overflow: hidden; margin: 6px 0; }
        .pc2-code--dark  { border: 1px solid rgba(255,255,255,0.08); }
        .pc2-code--light { border: 1px solid rgba(0,0,0,0.08); }
        .pc2-code__bar {
          padding: 4px 12px; font-family: 'Fira Code', monospace; font-size: 0.67rem;
          font-weight: 600; letter-spacing: 0.06em;
        }
        .pc2-code--dark  .pc2-code__bar { background: rgba(245,158,11,0.1); color: #FBBF24; }
        .pc2-code--light .pc2-code__bar { background: rgba(245,158,11,0.08); color: #B45309; }
        .pc2-code__pre {
          margin: 0; padding: 10px 12px; overflow-x: auto;
          font-family: 'Fira Code', 'JetBrains Mono', monospace; font-size: 0.78rem; line-height: 1.55;
        }
        .pc2-code--dark  .pc2-code__pre { background: rgba(0,0,0,0.3); color: #E2E8F0; }
        .pc2-code--light .pc2-code__pre { background: rgba(0,0,0,0.04); color: #1E293B; }
        /* Table */
        .pc2-tbl-wrap { overflow-x: auto; margin: 0.55em 0; }
        .pc2-tbl-wrap::-webkit-scrollbar { height: 4px; }
        .pc2-tbl-wrap::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.25); border-radius: 2px; }
        .pc2-md table { border-collapse: collapse; font-size: 0.88em; width: 100%; }
        .pc2-md th,.pc2-md td { padding: 6px 10px; text-align: left; border: 1px solid; }
        .pc2-md--dark  .pc2-md th,.pc2-md--dark  .pc2-md td { border-color: rgba(255,255,255,0.07); }
        .pc2-md--dark  .pc2-md th { background: rgba(245,158,11,0.1); color: #FBBF24; font-weight: 600; }
        .pc2-md--light .pc2-md th,.pc2-md--light .pc2-md td { border-color: rgba(0,0,0,0.08); }
        .pc2-md--light .pc2-md th { background: rgba(245,158,11,0.08); color: #B45309; font-weight: 600; }
        .pc2-err { color: #F87171 !important; }

        /* Upgrade gate */
        .pc2-gate {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%;
          text-align: center; padding: 32px 20px;
          animation: pc2-fade 0.3s ease;
        }
        .pc2-gate__gem {
          width: 64px; height: 64px; border-radius: 50%; margin-bottom: 18px;
          background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08));
          border: 1.5px solid rgba(245,158,11,0.25);
          display: flex; align-items: center; justify-content: center;
          animation: pc2-float 4s ease-in-out infinite;
        }
        .pc2-gate__title {
          font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 18px;
          letter-spacing: -0.01em; margin-bottom: 8px;
        }
        .pc2-gate__sub { font-size: 13px; line-height: 1.6; margin-bottom: 24px; max-width: 260px; }
        .pc2-gate__cta {
          padding: 11px 28px; border-radius: 50px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: #fff; font-family: 'Outfit', sans-serif;
          font-weight: 700; font-size: 13.5px; text-decoration: none;
          box-shadow: 0 4px 18px rgba(245,158,11,0.4);
          transition: all 0.22s cubic-bezier(.34,1.4,.64,1); display: inline-block;
        }
        .pc2-gate__cta:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 8px 24px rgba(245,158,11,0.5); }

        /* Input */
        .pc2-input-wrap {
          flex-shrink: 0; padding: 12px 14px 14px;
          border-top: 1px solid;
        }
        .pc2-input-wrap--dark {
          border-color: rgba(255,255,255,0.05);
          background: rgba(6,7,14,0.5);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .pc2-input-wrap--light {
          border-color: rgba(0,0,0,0.06);
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .pc2-input-box {
          display: flex; flex-direction: column;
          border-radius: 18px; overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pc2-input-box--dark {
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.1);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .pc2-input-box--light {
          background: #FFFFFF;
          border: 1.5px solid rgba(0,0,0,0.09);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .pc2-input-box:focus-within {
          border-color: #F59E0B !important;
          box-shadow: 0 0 0 3px rgba(245,158,11,0.14) !important;
        }
        .pc2-textarea {
          flex: 1; resize: none; border: none; outline: none;
          background: transparent; font-size: 13.5px; line-height: 1.55;
          font-family: 'Figtree', sans-serif; max-height: 96px;
          padding: 12px 15px 6px; box-sizing: border-box;
        }
        .pc2-textarea--dark  { color: #E2E8F0; }
        .pc2-textarea--light { color: #1E293B; }
        .pc2-textarea--dark::placeholder  { color: rgba(255,255,255,0.28); }
        .pc2-textarea--light::placeholder { color: rgba(0,0,0,0.3); }
        /* Inner action bar */
        .pc2-input-actions {
          display: flex; justify-content: flex-end;
          padding: 6px 8px 8px;
          border-top: 1px solid;
        }
        .pc2-input-box--dark  .pc2-input-actions { border-color: rgba(255,255,255,0.05); }
        .pc2-input-box--light .pc2-input-actions { border-color: rgba(0,0,0,0.05); }
        /* Pill send button */
        .pc2-send-pill {
          display: flex; align-items: center; gap: 6px;
          height: 32px; padding: 0 14px; border-radius: 100px; border: none;
          cursor: pointer; transition: all 0.2s; font-family: 'Figtree', sans-serif;
          font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
        }
        .pc2-send-pill--active {
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(245,158,11,0.45);
        }
        .pc2-send-pill--active:hover {
          box-shadow: 0 6px 20px rgba(245,158,11,0.6);
          transform: translateY(-1px) scale(1.03);
        }
        .pc2-send-pill--idle--dark  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.2); cursor: not-allowed; }
        .pc2-send-pill--idle--light { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.22); cursor: not-allowed; }
        .pc2-send-label { line-height: 1; }
        .pc2-spinner {
          width: 13px; height: 13px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
          animation: pc2-spin 0.75s linear infinite;
        }
        .pc2-hint {
          font-size: 10.5px; text-align: center; margin-top: 8px;
          font-family: 'Figtree', sans-serif;
        }
        .pc2-hint--dark  { color: rgba(255,255,255,0.25); }
        .pc2-hint--light { color: rgba(0,0,0,0.28); }
        .pc2-kbd {
          font-family: 'Figtree', monospace; font-size: 9.5px;
          background: rgba(245,158,11,0.12); color: #F59E0B;
          border-radius: 3px; padding: 1px 4px;
        }
        .pc2-hint--light .pc2-kbd { background: rgba(245,158,11,0.12); color: #D97706; }

        .pc2-clr-btn {
          padding: 4px 10px; border-radius: 6px; border: none;
          background: transparent; cursor: pointer; font-size: 12px;
          font-family: 'Figtree', sans-serif; transition: background 0.15s;
        }
        .pc2-clr-btn--dark  { color: rgba(255,255,255,0.3); }
        .pc2-clr-btn--dark:hover  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); }
        .pc2-clr-btn--light { color: rgba(0,0,0,0.3); }
        .pc2-clr-btn--light:hover { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.6); }

        @media (max-width: 600px) {
          .pc2-panel { right: 12px; left: 12px; bottom: 88px; width: auto !important; height: 68dvh !important; border-radius: 20px; }
          .pc2-fab   { display: none; }
          .pc2-chips { grid-template-columns: 1fr; }
          .pc2-hdr__greeting { font-size: 16px; }
        }
      `}</style>

      {/* FAB */}
      <button
        className={`pc2-fab ${open ? 'pc2-fab--open' : 'pc2-fab--closed'}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close Solar Assistant' : 'Open Solar Assistant'}
        title="Solar Assistant"
      >
        <span className="pc2-fab__ring" />
        <span className="pc2-fab__rays" />
        {open
          ? <X size={20} color={d ? '#94a3b8' : '#64748b'} strokeWidth={2.5} />
          : <SunMedium size={24} color="#FFFFFF" strokeWidth={1.75} />
        }
      </button>

      {/* Panel */}
      {open && (
        <div className={`pc2-panel pc2-panel--${d ? 'dark' : 'light'}`} style={{ width: W, height: H }}>

          {/* Header */}
          <div className={`pc2-hdr pc2-hdr--${d ? 'dark' : 'light'}`}>
            <div className="pc2-hdr__orb" />
            <div className="pc2-hdr__top">
              <div className="pc2-hdr__avatar">
                <SunMedium size={22} color="#FFFFFF" strokeWidth={1.75} />
              </div>
              <div className="pc2-hdr__controls">
                {messages.length > 0 && (
                  <button
                    className={`pc2-clr-btn pc2-clr-btn--${d ? 'dark' : 'light'}`}
                    onClick={async () => { if (await portalConfirm('Clear all messages?')) setMessages([]); }}
                  >Clear</button>
                )}
                <button
                  className={`pc2-hdr-btn pc2-hdr-btn--${d ? 'dark' : 'light'}`}
                  onClick={() => setExpanded(e => !e)}
                  title={expanded ? 'Compact' : 'Expand'}
                >
                  {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  className={`pc2-hdr-btn pc2-hdr-btn--${d ? 'dark' : 'light'}`}
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className={`pc2-hdr__greeting pc2-hdr__greeting--${d ? 'dark' : 'light'}`}>
              {firstName ? `Hi ${firstName} ✦` : 'Solar Assistant'}
            </div>
            <div className={`pc2-hdr__sub pc2-hdr__sub--${d ? 'dark' : 'light'}`}>
              Ask anything about your solar system
            </div>
            <div className="pc2-hdr__status">
              <div className="pc2-hdr__dot" />
              <span className={`pc2-hdr__online pc2-hdr__online--${d ? 'dark' : 'light'}`}>
                Online · Smarter Energy, Smarter Living
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="pc2-body">

            {/* Upgrade gate */}
            {canAccessAI === false && (
              <div className="pc2-gate">
                <div className="pc2-gate__gem"><Gem size={28} color="#F59E0B" strokeWidth={1.5} /></div>
                <div className={`pc2-gate__title ${d ? 'pc2-hdr__greeting--dark' : 'pc2-hdr__greeting--light'}`}>
                  Unlock AI Assistant
                </div>
                <div className={`pc2-gate__sub pc2-hdr__sub--${d ? 'dark' : 'light'}`}>
                  Get instant solar insights, diagnose issues, and energy-saving tips — on <strong style={{ color: '#F59E0B' }}>Basic</strong> and <strong style={{ color: '#F59E0B' }}>Premium</strong> plans.
                </div>
                <a href="/portal/profile" className="pc2-gate__cta">View Plans →</a>
              </div>
            )}

            {/* Welcome */}
            {canAccessAI === true && messages.length === 0 && (
              <div style={{ animation: 'pc2-fade 0.3s ease' }}>
                <div className="pc2-chips">
                  {CHIPS.map(({ icon: Icon, label, q }) => (
                    <button key={q} className={`pc2-chip pc2-chip--${d ? 'dark' : 'light'}`} onClick={() => sendMessage(q)}>
                      <div className="pc2-chip__icon">
                        <Icon size={16} color="#F59E0B" strokeWidth={1.75} />
                      </div>
                      <span className="pc2-chip__label">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {canAccessAI === true && messages.map(msg => {
              const isUser = msg.role === 'user';
              const isTyping = !isUser && msg.content === '';
              return (
                <div key={msg.id} className="pc2-msg">
                  {isUser ? (
                    <>
                      <div className="pc2-user-bubble">{msg.content}</div>
                      <div className="pc2-ts-row">
                        <span className={`pc2-user-ts pc2-user-ts--${d ? 'dark' : 'light'}`} key={ticks}>
                          {timeAgo(msg.ts)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className={`pc2-asst-card pc2-asst-card--${d ? 'dark' : 'light'}`}>
                      <div className="pc2-asst-card__body">
                        {isTyping ? (
                          <div className="pc2-typing">
                            {[0,1,2].map(i => <div key={i} className="pc2-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
                          </div>
                        ) : msg.isError ? (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <CircleAlert size={14} color="#F87171" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span className={`pc2-md pc2-md--${d ? 'dark' : 'light'} pc2-err`}>{msg.content}</span>
                          </div>
                        ) : (
                          <div className={`pc2-md pc2-md--${d ? 'dark' : 'light'}`}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p:      ({ children }) => <p>{children}</p>,
                                ul:     ({ children }) => <ul>{children}</ul>,
                                ol:     ({ children }) => <ol>{children}</ol>,
                                li:     ({ children }) => <li>{children}</li>,
                                strong: ({ children }) => <strong>{children}</strong>,
                                em:     ({ children }) => <em>{children}</em>,
                                blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                                hr:     () => <hr className="pc2-md-hr" />,
                                h1: ({ children }) => <h1 className="pc2-md-h pc2-md-h1">{children}</h1>,
                                h2: ({ children }) => <h2 className="pc2-md-h pc2-md-h2">{children}</h2>,
                                h3: ({ children }) => <h3 className="pc2-md-h pc2-md-h3">{children}</h3>,
                                table: ({ children, ...p }: any) => (
                                  <div className="pc2-tbl-wrap"><table {...p}>{children}</table></div>
                                ),
                                code({ node, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const codeStr = String(children).replace(/\n$/, '');
                                  if (match) {
                                    return (
                                      <div className={`pc2-code pc2-code--${d ? 'dark' : 'light'}`}>
                                        <div className="pc2-code__bar">
                                          <span className="pc2-code__lang">{match[1]}</span>
                                        </div>
                                        <pre className="pc2-code__pre"><code>{codeStr}</code></pre>
                                      </div>
                                    );
                                  }
                                  return <code className="pc2-inline-code" {...props}>{children}</code>;
                                },
                              }}
                            >
                              {normalizeContent(msg.content)}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {!isTyping && (
                        <div className={`pc2-asst-footer pc2-asst-footer--${d ? 'dark' : 'light'}`}>
                          <span className={`pc2-footer-ts pc2-footer-ts--${d ? 'dark' : 'light'}`} key={ticks}>
                            {timeAgo(msg.ts)}
                          </span>
                          {!msg.isError && (
                            <button
                              className="pc2-star-btn"
                              onClick={() => toggleStar(msg.id)}
                              title={msg.starred ? 'Unstar' : 'Star this response'}
                            >
                              {msg.starred
                                ? <Star size={13} color="#F59E0B" fill="#F59E0B" />
                                : <StarOff size={13} color={d ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                              }
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {canAccessAI !== false && (
            <div className={`pc2-input-wrap pc2-input-wrap--${d ? 'dark' : 'light'}`}>
              <div className={`pc2-input-box pc2-input-box--${d ? 'dark' : 'light'}`}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={canAccessAI === null ? 'Loading…' : 'Ask about your solar system…'}
                  rows={1}
                  disabled={canAccessAI === null || streaming}
                  className={`pc2-textarea pc2-textarea--${d ? 'dark' : 'light'}`}
                />
                <div className="pc2-input-actions">
                  <button
                    className={`pc2-send-pill ${(input.trim() && !streaming) ? 'pc2-send-pill--active' : `pc2-send-pill--idle--${d ? 'dark' : 'light'}`}`}
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || streaming || canAccessAI === null}
                  >
                    {streaming ? (
                      <div className="pc2-spinner" />
                    ) : (
                      <>
                        <Send size={13} strokeWidth={2.5} />
                        <span className="pc2-send-label">Send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className={`pc2-hint pc2-hint--${d ? 'dark' : 'light'}`}>
                AI responses may not always be accurate · <kbd className="pc2-kbd">⇧↵</kbd> newline
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PortalChat;
