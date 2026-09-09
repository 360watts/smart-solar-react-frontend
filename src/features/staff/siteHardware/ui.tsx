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
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  MoreVertical, X, Check, ChevronRight, AlertTriangle,
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
@keyframes fs-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fs-dialog { from { opacity: 0; transform: scale(0.95) translateY(6px); } to { opacity: 1; transform: none; } }
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

/** The measuring-device kinds a SmartDevice can be — and therefore what can
 *  meter a circuit line (its `device` FK points at SmartDevice). Not just
 *  plugs: a clamp meter or a wired DIN-rail meter counts too. */
export const SMART_DEVICE_KINDS: { value: string; label: string }[] = [
  { value: 'tuya_plug', label: 'Smart plug' },
  { value: 'tuya_switch', label: 'Smart switch' },
  { value: 'ct_clamp', label: 'Clamp meter' },
  { value: 'modbus_meter', label: 'Wired meter' },
];
export function smartDeviceKindLabel(type?: string): string {
  return SMART_DEVICE_KINDS.find(k => k.value === type)?.label
    ?? (String(type || '').replace(/_/g, ' ') || 'Device');
}

// ── list item + its overflow menu ──────────────────────────────────────────

const DANGER = '#e5484d';

export type ItemAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
  /** Optional second line — say what the action does (or doesn't) so a
   *  destructive-sounding label like "Disconnect" isn't mistaken for a delete. */
  hint?: string;
};

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  return reduce;
}

/**
 * Row overflow menu.
 *
 * Rendered into a portal on `document.body` and positioned from the trigger's
 * rect — the setup cards clip their overflow for clean corners, which used to
 * swallow the lower menu items (a "Disconnect" action could sit entirely in the
 * clipped strip and never show). The panel also flips above the trigger when it
 * would run past the viewport, and animates in from the corner it hangs off.
 */
function OverflowMenu({ isDark, actions }: { isDark: boolean; actions: ItemAction[] }) {
  const t = useTokens(isDark);
  const reduceMotion = usePrefersReducedMotion();
  const [render, setRender] = useState(false);
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number; place: 'top' | 'bottom' }>(
    { top: 0, left: 0, maxH: 0, place: 'bottom' },
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const PANEL_W = 224;
  const estHeight =
    10 + actions.reduce((s, a) => s + (a.hint ? 50 : 40), 0)
    + actions.filter((a, i) => i > 0 && !!a.danger && !actions[i - 1].danger).length * 11;

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const flip = spaceBelow < estHeight && spaceAbove > spaceBelow;
    setPos({
      place: flip ? 'top' : 'bottom',
      top: flip ? r.top - 8 : r.bottom + 8,
      left: Math.round(Math.min(Math.max(8, r.right - PANEL_W), vw - PANEL_W - 8)),
      maxH: Math.max(160, (flip ? spaceAbove : spaceBelow)),
    });
  }, [estHeight]);

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    place();
    setRender(true);
    setShown(false);
    // paint the closed state once, then transition in — also covers the
    // reopen-before-exit-finishes case, where `render` never toggles.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  };
  const closeMenu = useCallback((returnFocus = true) => {
    setShown(false);
    if (returnFocus) triggerRef.current?.focus();
    closeTimer.current = setTimeout(() => setRender(false), reduceMotion ? 0 : 150);
  }, [reduceMotion]);

  useLayoutEffect(() => { if (render) place(); }, [render, place]);

  useEffect(() => {
    if (!render) return;
    const reposition = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeMenu(false);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    const focusId = requestAnimationFrame(() => itemRefs.current[0]?.focus());
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      cancelAnimationFrame(focusId);
    };
  }, [render, place, closeMenu]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const roveFocus = (e: React.KeyboardEvent) => {
    const n = actions.length;
    if (!n) return;
    const cur = itemRefs.current.findIndex(el => el === document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); itemRefs.current[(cur + 1 + n) % n]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); itemRefs.current[(cur - 1 + n) % n]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); itemRefs.current[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); itemRefs.current[n - 1]?.focus(); }
    else if (e.key === 'Tab') { closeMenu(false); }
  };

  const setRowBg = (el: HTMLElement, on: boolean, danger?: boolean) => {
    el.style.background = on
      ? (danger
        ? (isDark ? 'rgba(229,72,77,0.16)' : 'rgba(229,72,77,0.10)')
        : t.card2)
      : 'transparent';
  };

  itemRefs.current = [];

  return (
    <div style={{ flexShrink: 0, lineHeight: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={render}
        aria-label="More actions"
        onClick={() => (render ? closeMenu() : openMenu())}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(); }
        }}
        style={{
          width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', cursor: 'pointer',
          border: `1px solid ${render ? 'transparent' : t.line}`,
          background: render ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)') : t.card,
          color: render ? t.ink : t.ink2,
          transition: 'background 130ms ease, color 130ms ease, border-color 130ms ease',
        }}
      >
        <MoreVertical size={16} />
      </button>

      {render && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 1400,
            transform: pos.place === 'top' ? 'translateY(-100%)' : undefined,
          }}
        >
          <div
            ref={panelRef}
            role="menu"
            aria-orientation="vertical"
            onKeyDown={roveFocus}
            style={{
              minWidth: PANEL_W, maxWidth: 288, padding: 5,
              maxHeight: pos.maxH, overflowY: 'auto',
              borderRadius: 14, background: t.card,
              border: `1px solid ${t.line}`,
              boxShadow: isDark
                ? '0 0 0 1px rgba(0,0,0,0.55), 0 10px 24px -6px rgba(0,0,0,0.6), 0 30px 60px -14px rgba(0,0,0,0.55)'
                : '0 1px 2px rgba(17,24,39,0.08), 0 12px 28px -8px rgba(17,24,39,0.20), 0 30px 56px -18px rgba(17,24,39,0.16)',
              transformOrigin: pos.place === 'bottom' ? 'top right' : 'bottom right',
              opacity: shown ? 1 : 0,
              transform: shown
                ? 'none'
                : `scale(0.94) translateY(${pos.place === 'bottom' ? -6 : 6}px)`,
              transition: reduceMotion
                ? 'opacity 120ms ease'
                : 'opacity 140ms ease, transform 200ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {actions.map((a, i) => {
              const groupBreak = i > 0 && !!a.danger && !actions[i - 1].danger;
              return (
                <React.Fragment key={i}>
                  {groupBreak && <div style={{ height: 1, background: t.line2, margin: '5px 9px' }} />}
                  <button
                    ref={el => { itemRefs.current[i] = el; }}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => { closeMenu(false); a.onClick(); }}
                    onMouseEnter={e => setRowBg(e.currentTarget, true, a.danger)}
                    onMouseLeave={e => setRowBg(e.currentTarget, false, a.danger)}
                    onFocus={e => setRowBg(e.currentTarget, true, a.danger)}
                    onBlur={e => setRowBg(e.currentTarget, false, a.danger)}
                    style={{
                      display: 'grid', gridTemplateColumns: '18px 1fr', columnGap: 11, alignItems: 'center',
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 9,
                      border: 'none', background: 'transparent', cursor: 'pointer', outline: 'none',
                      fontFamily: t.body, color: a.danger ? DANGER : t.ink,
                      transition: 'background 120ms ease',
                    }}
                  >
                    <span style={{
                      display: 'grid', placeItems: 'center',
                      color: a.danger ? DANGER : t.ink2,
                    }}>
                      {a.icon}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, letterSpacing: '-0.005em' }}>
                        {a.label}
                      </span>
                      {a.hint && (
                        <span style={{
                          display: 'block', marginTop: 1, fontSize: '0.75rem', lineHeight: 1.35,
                          color: a.danger ? (isDark ? 'rgba(242,150,153,0.85)' : 'rgba(180,42,47,0.8)') : t.ink2,
                        }}>
                          {a.hint}
                        </span>
                      )}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function Item({
  isDark, icon, iconTone = 'plain', title, status, actions,
}: {
  isDark: boolean; icon: React.ReactNode; iconTone?: 'plain' | 'good';
  title: React.ReactNode; status: React.ReactNode;
  actions: ItemAction[];
}) {
  const t = useTokens(isDark);
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
      {actions.length > 0 && <OverflowMenu isDark={isDark} actions={actions} />}
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

/**
 * Centered confirmation dialog — the app's standard destructive-action pattern
 * (portal + dimmed backdrop + focus trap + Esc), matched to this surface's
 * voice. Replaces the old bottom-sticky InlineConfirm, which rendered far from
 * the row you clicked (e.g. below the smart-plugs section).
 */
export function ConfirmDialog({
  isDark, open, title, body,
  confirmLabel = 'Remove', cancelLabel = 'Keep it', tone = 'danger',
  busy = false, onConfirm, onCancel,
}: {
  isDark: boolean; open: boolean; title: string; body?: React.ReactNode;
  confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'primary';
  busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useTokens(isDark);
  const reduceMotion = usePrefersReducedMotion();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cbs = useRef({ onConfirm, onCancel });
  cbs.current = { onConfirm, onCancel };

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusId = requestAnimationFrame(() => cancelRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); cbs.current.onCancel(); return; }
      if (e.key === 'Tab') {
        const a = cancelRef.current, b = confirmRef.current;
        if (!a || !b) return;
        const el = document.activeElement;
        if (e.shiftKey && el === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && el === b) { e.preventDefault(); a.focus(); }
        else if (el !== a && el !== b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(focusId);
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const danger = tone === 'danger';

  return ReactDOM.createPortal(
    <div
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000, display: 'grid', placeItems: 'center', padding: 20,
        background: isDark ? 'rgba(6,8,11,0.66)' : 'rgba(17,24,39,0.42)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        animation: reduceMotion ? undefined : 'fs-fade 130ms ease both',
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: 'min(400px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
          background: t.card, borderRadius: 18, border: `1px solid ${t.line}`, padding: '22px 22px 18px',
          boxShadow: isDark
            ? '0 0 0 1px rgba(0,0,0,0.5), 0 28px 72px rgba(0,0,0,0.62)'
            : '0 24px 70px rgba(17,24,39,0.22)',
          animation: reduceMotion ? undefined : 'fs-dialog 200ms cubic-bezier(0.2,0.9,0.3,1) both',
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: danger ? (isDark ? 'rgba(229,72,77,0.16)' : 'rgba(229,72,77,0.10)') : t.goodBg,
            color: danger ? DANGER : t.goodInk,
          }}>
            <AlertTriangle size={19} strokeWidth={1.9} />
          </span>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <div style={{ fontFamily: t.head, fontSize: '1.04rem', fontWeight: 600, letterSpacing: '-0.01em', color: t.ink }}>
              {title}
            </div>
            {body && (
              <p style={{ margin: '7px 0 0', fontSize: '0.86rem', lineHeight: 1.5, color: t.ink2 }}>{body}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '8px 14px', borderRadius: 11, border: `1px solid ${t.line}`,
              background: 'transparent', color: t.ink, fontFamily: t.body, fontSize: '0.86rem', fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 15px', borderRadius: 11, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.75 : 1,
              fontFamily: t.body, fontSize: '0.86rem', fontWeight: 600,
              border: `1px solid ${danger ? 'rgba(229,72,77,0.45)' : t.good}`,
              background: danger ? (isDark ? 'rgba(229,72,77,0.18)' : 'rgba(229,72,77,0.12)') : t.good,
              color: danger ? DANGER : '#fff',
            }}
          >
            {busy && (
              <span style={{
                width: 13, height: 13, borderRadius: '50%', display: 'inline-block',
                border: `2px solid ${danger ? 'rgba(229,72,77,0.35)' : 'rgba(255,255,255,0.45)'}`,
                borderTopColor: danger ? DANGER : '#fff', animation: 'fs-spin 700ms linear infinite',
              }} />
            )}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { Check as CheckIcon };
