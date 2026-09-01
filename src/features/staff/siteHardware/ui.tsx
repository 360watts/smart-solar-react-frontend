/**
 * Friendly setup surface — the shared primitives.
 *
 * See the repo-root UI_GUIDE.md for the voice, the vocabulary, and when to reach
 * for each piece. In short:
 *   - plain names, no jargon or device codes in the primary view
 *   - appliance-first rows: what it powers, then how it's doing
 *   - calm status: Connected / Not set up yet / Needs attention (amber, not red)
 *   - guided flows that read like questions, closed by default, one primary action
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  MoreVertical, X, Check, ChevronRight,
  Refrigerator, Flame, AirVent, Droplets, WashingMachine, Plug, CarFront, HelpCircle,
} from 'lucide-react';

const HEAD = "'Outfit', ui-sans-serif, system-ui, sans-serif";
const BODY = "'DM Sans', ui-sans-serif, system-ui, sans-serif";

export function useTokens(isDark: boolean) {
  return {
    head: HEAD, body: BODY,
    card:    'var(--card)',
    card2:   isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    ink:     'var(--foreground)',
    ink2:    'var(--muted-foreground)',
    line:    isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.085)',
    line2:   isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.05)',
    good:    isDark ? '#2bb673' : '#0f9d58',
    goodBg:  isDark ? 'rgba(43,182,115,0.14)' : 'rgba(15,157,88,0.10)',
    goodInk: isDark ? '#8fe3b4' : '#0b6b3d',
    wait:    isDark ? '#eaa53a' : '#e8930c',
    waitBg:  isDark ? 'rgba(234,165,58,0.15)' : 'rgba(232,147,12,0.12)',
    waitInk: isDark ? '#f2c583' : '#9a5c05',
    idleBg:  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)',
  };
}

const KEYFRAMES = `
@keyframes fs-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes fs-pop  { from { opacity: 0; transform: scale(0.98) translateY(-4px); } to { opacity: 1; transform: none; } }
@keyframes fs-grow { from { width: 0; } }
@keyframes fs-spin { to { transform: rotate(360deg); } }
`;

// ── page shell ──────────────────────────────────────────────────────────────

export function SetupShell({
  isDark, heading, sub, progress, children,
}: {
  isDark: boolean; heading: string; sub: string;
  progress?: { done: number; total: number };
  children: React.ReactNode;
}) {
  const t = useTokens(isDark);
  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : null;
  return (
    <div style={{ fontFamily: t.body, color: t.ink }}>
      <style>{KEYFRAMES}</style>
      <h2 style={{ fontFamily: t.head, fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.015em', margin: '0 0 6px' }}>
        {heading}
      </h2>
      <p style={{ margin: '0 0 18px', color: t.ink2, fontSize: '0.95rem', maxWidth: '52ch', lineHeight: 1.5 }}>{sub}</p>
      {pct != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: t.idleBg, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: t.good, animation: 'fs-grow 900ms cubic-bezier(.2,.8,.2,1) both' }} />
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: t.ink2, whiteSpace: 'nowrap' }}>
            {progress!.done} of {progress!.total} done
          </span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

export function SetupCard({
  isDark, index = 0, icon, title, purpose, status, action, children,
}: {
  isDark: boolean; index?: number;
  icon: React.ReactNode; title: string; purpose?: string;
  status?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  const t = useTokens(isDark);
  return (
    <section style={{
      background: t.card, border: `1px solid ${t.line}`, borderRadius: 18, overflow: 'hidden',
      boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.35)' : '0 1px 2px rgba(0,0,0,0.04), 0 12px 30px rgba(0,0,0,0.05)',
      animation: 'fs-rise 440ms ease both', animationDelay: `${index * 60}ms`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 18px 14px' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: t.goodBg, color: t.goodInk,
        }}>
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: t.head, margin: 0, fontSize: '1.08rem', fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h3>
          {purpose && <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: t.ink2, lineHeight: 1.45 }}>{purpose}</p>}
        </div>
        {status}
      </div>
      <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      {action && <div style={{ padding: '0 18px 18px' }}>{action}</div>}
    </section>
  );
}

// ── status ──────────────────────────────────────────────────────────────────

type State = 'good' | 'wait' | 'idle';
export function StatusChip({ isDark, state, children }: { isDark: boolean; state: State; children: React.ReactNode }) {
  const t = useTokens(isDark);
  const c = state === 'good'
    ? { bg: t.goodBg, fg: t.goodInk }
    : state === 'wait'
      ? { bg: t.waitBg, fg: t.waitInk }
      : { bg: t.idleBg, fg: t.ink2 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
      fontSize: '0.76rem', fontWeight: 600, padding: '5px 10px', borderRadius: 999,
      background: c.bg, color: c.fg, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />
      {children}
    </span>
  );
}

// ── appliance iconography (shared) ─────────────────────────────────────────

export function applianceIcon(label: string, size = 19): React.ReactNode {
  const p = { size, strokeWidth: 1.8 } as const;
  switch (label) {
    case 'fridge': return <Refrigerator {...p} />;
    case 'geyser': return <Flame {...p} />;
    case 'ac_unit': return <AirVent {...p} />;
    case 'water_pump': return <Droplets {...p} />;
    case 'washing_machine': return <WashingMachine {...p} />;
    case 'ev_charger': return <CarFront {...p} />;
    case 'other': return <HelpCircle {...p} />;
    default: return <Plug {...p} />;
  }
}
export const APPLIANCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'fridge', label: 'Fridge' },
  { value: 'geyser', label: 'Geyser' },
  { value: 'ac_unit', label: 'Air conditioner' },
  { value: 'water_pump', label: 'Water pump' },
  { value: 'washing_machine', label: 'Washing machine' },
  { value: 'ev_charger', label: 'EV charger' },
  { value: 'other', label: 'Something else' },
];
export function applianceName(label: string): string {
  return APPLIANCE_OPTIONS.find(o => o.value === label)?.label
    ?? (String(label || '').replace(/_/g, ' ') || 'Appliance');
}

// ── list item ───────────────────────────────────────────────────────────────

export function Item({
  isDark, icon, iconTone = 'plain', title, status, actions,
}: {
  isDark: boolean; icon: React.ReactNode; iconTone?: 'plain' | 'good';
  title: React.ReactNode; status: React.ReactNode;
  actions: { label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }[];
}) {
  const t = useTokens(isDark);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13,
      padding: '12px 10px 12px 13px', border: `1px solid ${t.line}`, borderRadius: 14, background: t.card2,
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: iconTone === 'good' ? t.goodBg : t.card,
        border: iconTone === 'good' ? 'none' : `1px solid ${t.line}`,
        color: iconTone === 'good' ? t.goodInk : t.ink2,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.96rem', fontWeight: 600 }}>{title}</div>
        <div style={{ marginTop: 1, fontSize: '0.82rem', color: t.ink2 }}>{status}</div>
      </div>
      {actions.length > 0 && (
        <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button" onClick={() => setOpen(v => !v)} aria-label="Options"
            style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', border: `1px solid ${t.line}`, background: t.card, color: t.ink2, cursor: 'pointer' }}
          >
            <MoreVertical size={16} />
          </button>
          {open && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 40, minWidth: 160,
              border: `1px solid ${t.line}`, borderRadius: 11, background: t.card, overflow: 'hidden',
              boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
            }}>
              {actions.map((a, i) => (
                <button
                  key={i} type="button"
                  onClick={() => { setOpen(false); a.onClick(); }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.card2)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                    padding: '10px 13px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontFamily: t.body, fontSize: '0.85rem', color: a.danger ? '#e5484d' : t.ink,
                    borderTop: i === 0 ? 'none' : `1px solid ${t.line2}`,
                  }}
                >
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── buttons ─────────────────────────────────────────────────────────────────

export function Btn({
  isDark, onClick, disabled, children, variant = 'primary', full, size = 'md',
}: {
  isDark: boolean; onClick?: () => void; disabled?: boolean; children: React.ReactNode;
  variant?: 'primary' | 'soft' | 'plain'; full?: boolean; size?: 'sm' | 'md';
}) {
  const t = useTokens(isDark);
  const base: React.CSSProperties = {
    display: full ? 'flex' : 'inline-flex', width: full ? '100%' : undefined,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: size === 'sm' ? '8px 13px' : '11px 17px', borderRadius: 12,
    fontFamily: t.body, fontSize: size === 'sm' ? '0.84rem' : '0.92rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, border: '1px solid transparent',
    transition: 'opacity 120ms',
  };
  const v = variant === 'primary'
    ? { background: t.good, color: '#fff', borderColor: t.good, boxShadow: `0 4px 14px ${t.goodBg}` }
    : variant === 'soft'
      ? { background: t.goodBg, color: t.goodInk }
      : { background: 'transparent', color: t.ink, borderColor: t.line };
  return <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...v }}>{children}</button>;
}

// ── empty ───────────────────────────────────────────────────────────────────

export function EmptyState({
  isDark, headline, detail, action,
}: { isDark: boolean; headline: string; detail?: string; action?: React.ReactNode }) {
  const t = useTokens(isDark);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10,
      padding: '24px 18px', border: `1.5px dashed ${t.line}`, borderRadius: 14,
    }}>
      <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{headline}</span>
      {detail && <span style={{ fontSize: '0.85rem', color: t.ink2, maxWidth: '36ch', lineHeight: 1.45 }}>{detail}</span>}
      {action}
    </div>
  );
}

// ── guided flow (composer) ──────────────────────────────────────────────────

export function Flow({
  isDark, open, title, subtitle, onClose, children, footer,
}: {
  isDark: boolean; open: boolean; title: string; subtitle?: string;
  onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  const t = useTokens(isDark);
  if (!open) return null;
  return (
    <div style={{
      border: `1px solid ${t.good}`, borderRadius: 16, overflow: 'hidden', background: t.card,
      boxShadow: isDark ? '0 18px 44px rgba(0,0,0,0.5)' : '0 18px 44px rgba(0,0,0,0.12)',
      animation: 'fs-pop 220ms cubic-bezier(.2,.9,.3,1) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 17px 13px', borderBottom: `1px solid ${t.line2}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: t.head, fontSize: '1.02rem', fontWeight: 600 }}>{title}</div>
          {subtitle && <div style={{ fontSize: '0.83rem', color: t.ink2, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button
          type="button" onClick={onClose} aria-label="Close"
          style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'grid', placeItems: 'center', border: `1px solid ${t.line}`, background: 'transparent', color: t.ink2, cursor: 'pointer' }}
        >
          <X size={15} />
        </button>
      </div>
      <div style={{ padding: 17, display: 'flex', flexDirection: 'column', gap: 24 }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '13px 17px', borderTop: `1px solid ${t.line2}`, background: t.card2 }}>
        {footer}
      </div>
    </div>
  );
}

export function FlowStep({ isDark, n, title, question, children }: {
  isDark: boolean; n: number; title: string; question?: string; children: React.ReactNode;
}) {
  const t = useTokens(isDark);
  return (
    <div>
      <div style={{ fontFamily: t.head, fontSize: '0.98rem', fontWeight: 600, marginBottom: question ? 3 : 11 }}>
        {n}. {title}
      </div>
      {question && <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: t.ink2 }}>{question}</p>}
      {children}
    </div>
  );
}

/** Big tappable choice chips — use instead of a <select> whenever the options
 *  are a short fixed set the user recognises (appliances, yes/no, …). */
export function ChoiceGrid<T extends string>({
  isDark, value, options, onChange,
}: {
  isDark: boolean; value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  const t = useTokens(isDark);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12,
              border: `1.5px solid ${on ? t.good : t.line}`, background: on ? t.goodBg : t.card2,
              color: on ? t.goodInk : t.ink, fontFamily: t.body, fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            {o.icon && <span style={{ color: on ? t.goodInk : t.ink2, display: 'grid' }}>{o.icon}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function RadioCards<T extends string>({
  isDark, value, options, onChange,
}: {
  isDark: boolean; value: T;
  options: { value: T; label: string; detail?: string }[];
  onChange: (v: T) => void;
}) {
  const t = useTokens(isDark);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <label key={o.value} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 12,
            border: `1.5px solid ${on ? t.good : t.line}`, background: on ? t.goodBg : t.card2, cursor: 'pointer',
          }}>
            <input type="radio" checked={on} onChange={() => onChange(o.value)} style={{ accentColor: t.good }} />
            <span>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{o.label}</span>
              {o.detail && <small style={{ display: 'block', color: t.ink2, fontSize: '0.8rem' }}>{o.detail}</small>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function Field({ isDark, label, hint, children }: {
  isDark: boolean; label: string; hint?: string; children: React.ReactNode;
}) {
  const t = useTokens(isDark);
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: t.ink, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '0.78rem', color: t.ink2, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}
export function controlStyle(isDark: boolean): React.CSSProperties {
  const t = useTokens(isDark);
  return {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.line}`,
    background: t.card2, color: t.ink, fontFamily: t.body, fontSize: '0.9rem', outline: 'none',
  };
}

export function DetailsToggle({ isDark, open, onToggle }: { isDark: boolean; open: boolean; onToggle: () => void }) {
  const t = useTokens(isDark);
  return (
    <button
      type="button" onClick={onToggle}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: t.body, fontSize: '0.82rem', color: t.ink2 }}
    >
      <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
      Advanced details
    </button>
  );
}

export function InlineConfirm({ isDark, message, onConfirm, onCancel }: {
  isDark: boolean; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useTokens(isDark);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '11px 13px', borderRadius: 12,
      border: `1px solid ${isDark ? 'rgba(229,72,77,0.4)' : 'rgba(229,72,77,0.35)'}`,
      background: isDark ? 'rgba(229,72,77,0.12)' : 'rgba(229,72,77,0.07)',
      boxShadow: '0 12px 30px rgba(0,0,0,0.2)', fontFamily: t.body, fontSize: '0.87rem', color: t.ink,
    }}>
      <span style={{ flex: 1, minWidth: 170 }}>{message}</span>
      <Btn isDark={isDark} size="sm" variant="plain" onClick={onCancel}>Keep it</Btn>
      <button
        type="button" onClick={onConfirm}
        style={{ padding: '8px 13px', borderRadius: 10, border: '1px solid rgba(229,72,77,0.4)', background: 'rgba(229,72,77,0.14)', color: '#e5484d', fontFamily: t.body, fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}
      >
        Remove
      </button>
    </div>
  );
}

export { Check as CheckIcon };
