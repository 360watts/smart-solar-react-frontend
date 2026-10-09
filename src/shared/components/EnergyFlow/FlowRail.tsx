import React, { useState } from 'react';
import { MixShares } from './flowModel';
import { FLOW_COLORS } from './FlowLines';

/** A rail is a column of equal cards that together fill the centre panel's height (approved mockup:
    'Full dashboard · Overview'). The grid stretches the column; each tile takes an equal share. */
export const RailStack: React.FC<{ area: 'left' | 'right'; children: React.ReactNode }> = ({ area, children }) => (
  <div className="ef-rail" data-rail={area} style={{ gridArea: area, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
    {children}
  </div>
);

/** One equal-height rail card: muted title on top, the figure in the middle, one muted line at the foot. */
export const RailTile: React.FC<{
  title: string; value?: string | null; unit?: string; color?: string; sub?: React.ReactNode; children?: React.ReactNode; isDark: boolean;
}> = ({ title, value, unit, color, sub, children }) => (
  <div data-rail-tile className="ef-tile" style={{
    // minHeight auto (not 0): a tile never shrinks below its content, so a four-row ledger can't spill out.
    flex: '1 1 0', minWidth: 0, minHeight: 'auto', boxSizing: 'border-box', borderRadius: 18,
    padding: 'clamp(14px, 1.8cqw, 20px)', background: 'var(--card)', border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8,
  }}>
    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)' }}>{title}</div>
    {children ?? (
      <div style={{ fontFamily: "'Rubik', sans-serif", fontSize: 'clamp(26px, 2.6cqw, 34px)', fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--foreground)' }}>
        {value ?? '—'}{value != null && unit ? <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-dim)', marginLeft: 6 }}>{unit}</span> : null}
      </div>
    )}
    <div style={{ fontSize: 12, color: 'var(--text-dim)', minHeight: 16 }}>{sub}</div>
  </div>
);

// Older single-card rail pieces, kept for tests and other hosts.
export const RailCard: React.FC<{ title: string; children: React.ReactNode; isDark: boolean }> = ({ title, children, isDark }) => (
  <div style={{
    minWidth: 0, borderRadius: 18, padding: 'clamp(12px, 1.6cqw, 16px)',
    background: 'var(--card)', border: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', gap: 4,
  }}>
    <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{title}</div>
    <div data-rail-rows style={{ display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  </div>
);

/** Label left (muted), value right; `divider` draws the 1px line above the row. `note` sits under the row. */
export const RailRow: React.FC<{ label: string; value: string | null; unit?: string; divider?: boolean; note?: React.ReactNode; isDark: boolean }> = ({ label, value, unit, divider, note, isDark }) => (
  <div style={{ borderTop: divider ? '1px solid var(--border)' : undefined, minHeight: 52, padding: '12px 0', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 14, color: 'var(--text-dim)', minWidth: 0 }}>{label}</span>
      <span style={{ fontFamily: "'Rubik', sans-serif", fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--foreground)' }}>
        {value ?? '—'}{value != null && unit ? <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', marginLeft: 4 }}>{unit}</span> : null}
      </span>
    </div>
    {note}
  </div>
);

// points: values oldest -> newest; renders nothing for fewer than 2 points.
// `labels` (same length) name each point for the hover tooltip, e.g. "2 PM"; the tooltip reads "2 PM · 3.4 kW".
export const Sparkline: React.FC<{ points: number[]; color: string; labels?: string[]; unit?: string }> = ({ points, color, labels, unit = 'kW' }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const max = Math.max(...points, 0.001);
  const w = 200, h = 36;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 4) - 2;
  const xy = points.map((v, i) => `${x(i)},${y(v)}`);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };
  const tip = hover != null ? `${labels?.[hover] ? `${labels[hover]} · ` : ''}${points[hover].toFixed(points[hover] >= 10 ? 1 : 2)} ${unit}` : null;
  return (
    <div data-sparkline style={{ position: 'relative', marginTop: 6 }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', display: 'block' }} aria-hidden="true">
        <polyline points={xy.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {hover != null && <circle cx={x(hover)} cy={y(points[hover])} r={3.5} fill={color} stroke="var(--card)" strokeWidth={1.5} />}
      </svg>
      {tip && hover != null && (
        <div role="tooltip" style={{
          position: 'absolute', bottom: '100%', marginBottom: 4, transform: 'translateX(-50%)', pointerEvents: 'none', whiteSpace: 'nowrap',
          left: `${Math.max(14, Math.min(86, (hover / (points.length - 1)) * 100))}%`,
          padding: '3px 8px', borderRadius: 6, fontSize: 12, fontVariantNumeric: 'tabular-nums',
          background: 'var(--foreground)', color: 'var(--card)',
        }}>{tip}</div>
      )}
    </div>
  );
};

export const LedgerRow: React.FC<{ label: string; value: string; muted?: boolean; first?: boolean; compact?: boolean }> = ({ label, value, muted, first, compact }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: compact ? 0 : 52, padding: compact ? '5px 0' : '12px 0', boxSizing: 'border-box', borderTop: first ? undefined : '1px solid var(--border)', fontSize: 15, fontVariantNumeric: 'tabular-nums', color: muted ? 'var(--text-dim)' : undefined }}>
    <span style={{ color: 'var(--text-dim)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

const MIX: { key: keyof MixShares; name: string; color: string }[] = [
  { key: 'solar', name: 'Solar', color: FLOW_COLORS.solar },
  { key: 'battery', name: 'Battery', color: FLOW_COLORS.batt },
  { key: 'grid', name: 'Grid', color: FLOW_COLORS.grid },
];

/** What powers the home right now: one stacked bar (same three colours as the ring) and a compact legend. */
export const MixBar: React.FC<{ shares: MixShares | null; isDark: boolean; hideTitle?: boolean }> = ({ shares, isDark, hideTitle }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {!hideTitle && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Inverter supply mix</div>}
    <div role="img" aria-label="Power mix" style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--surface-muted)' }}>
      {shares && MIX.map(({ key, color }) => shares[key] > 0
        ? <div key={key} data-mix={key} style={{ width: `${shares[key] * 100}%`, background: color }} />
        : null)}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
      {MIX.map(({ key, name, color }) => (
        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
          {`${name} ${shares ? `${Math.round(shares[key] * 100)}%` : '—'}`}
        </span>
      ))}
    </div>
  </div>
);
