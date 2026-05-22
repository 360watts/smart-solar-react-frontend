/**
 * Portal-local toast + confirm dialog — matches the portal palette exactly.
 * No external dependencies. Designed for use inside the /portal layout.
 *
 * Usage:
 *   const { toast, confirm, PortalFeedbackUI } = usePortalFeedback();
 *   toast('success', 'Invite sent!');
 *   const ok = await confirm('Revoke access for user@example.com?');
 *   ...
 *   return <> {PortalFeedbackUI} <YourContent /> </>;
 */
import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle, XCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmState {
  message: string;
  resolve: (ok: boolean) => void;
}

const KIND_STYLES: Record<ToastKind, { bg: string; border: string; color: string; Icon: React.FC<any> }> = {
  success: { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)',  color: '#4ade80', Icon: CheckCircle   },
  error:   { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', color: '#f87171', Icon: XCircle       },
  info:    { bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)',  color: '#fbbf24', Icon: Info           },
};

export function usePortalFeedback(isDark = true) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const counter = useRef(0);

  const toast = useCallback((kind: ToastKind, message: string, durationMs = 3500) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), durationMs);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const resolveConfirm = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  const overlayBg  = isDark ? 'rgba(8,12,20,0.75)' : 'rgba(0,0,0,0.45)';
  const dialogBg   = isDark ? '#0D1422' : '#ffffff';
  const dialogBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
  const textColor  = isDark ? '#F0F4FF' : '#0A0E1A';
  const mutedColor = isDark ? '#8892A4' : '#64748b';
  const cancelBg   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const cancelHoverBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

  const PortalFeedbackUI = (
    <>
      {/* ── Toast stack (portalled to body so transforms don't affect fixed pos) */}
      {ReactDOM.createPortal(<div style={{
        position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
        display: 'flex', flexDirection: 'column-reverse', gap: 8,
        pointerEvents: 'none', alignItems: 'center',
      }}>
        {toasts.map(t => {
          const s = KIND_STYLES[t.kind];
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px', borderRadius: 12,
              background: s.bg, border: `1px solid ${s.border}`,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              maxWidth: 340,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, fontWeight: 500,
              color: isDark ? '#E2E8F0' : '#1E293B',
              animation: 'pchat-slide-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
              pointerEvents: 'auto',
            }}>
              <s.Icon size={15} color={s.color} strokeWidth={2} style={{ flexShrink: 0 }} />
              {t.message}
            </div>
          );
        })}
      </div>, document.body)}

      {/* ── Confirm dialog (portalled to body) ──────────────────────────────── */}
      {confirmState && ReactDOM.createPortal((
        <div
          onClick={() => resolveConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: overlayBg, backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: dialogBg, border: `1px solid ${dialogBorder}`,
              borderRadius: 16, padding: '28px 28px 22px',
              width: '100%', maxWidth: 360,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              fontFamily: "'DM Sans', sans-serif",
              animation: 'pchat-slide-in 0.2s cubic-bezier(0.34,1.4,0.64,1) both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'rgba(248,113,113,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={17} color="#f87171" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: textColor, marginBottom: 4, lineHeight: 1.4 }}>
                  Are you sure?
                </div>
                <div style={{ fontSize: 13, color: mutedColor, lineHeight: 1.5 }}>
                  {confirmState.message}
                </div>
              </div>
              <button
                onClick={() => resolveConfirm(false)}
                style={{ marginLeft: 'auto', padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: mutedColor, flexShrink: 0 }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => resolveConfirm(false)}
                style={{
                  padding: '8px 18px', borderRadius: 9, border: 'none',
                  background: cancelBg, color: mutedColor,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = cancelHoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = cancelBg)}
              >
                Cancel
              </button>
              <button
                onClick={() => resolveConfirm(true)}
                style={{
                  padding: '8px 18px', borderRadius: 9, border: 'none',
                  background: 'rgba(248,113,113,0.15)', color: '#f87171',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'background 0.15s',
                  border: '1px solid rgba(248,113,113,0.3)' as any,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.15)')}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      <style>{`
        @keyframes pchat-slide-in {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </>
  );

  return { toast, confirm, PortalFeedbackUI };
}
