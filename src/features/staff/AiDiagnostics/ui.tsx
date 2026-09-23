import React from 'react';

/** Bracket-cornered instrument panel — the recurring shell for every "device" on this page. */
export function Panel({
  children, style, className = '',
}: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative', background: 'var(--diag-panel)',
        border: '1px solid var(--diag-border)', borderRadius: 10, ...style,
      }}
    >
      <span className="diag-corner tl" />
      <span className="diag-corner tr" />
      <span className="diag-corner bl" />
      <span className="diag-corner br" />
      {children}
    </div>
  );
}

/** A single labeled telemetry readout — mono uppercase label over a large value. */
export function Readout({
  label, value, accent, sub,
}: { label: string; value: React.ReactNode; accent?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="diag-mono-label">{label}</span>
      <span
        className="diag-display"
        style={{ fontSize: '0.95rem', fontWeight: 700, color: accent ?? 'var(--diag-text)', lineHeight: 1.2 }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: '0.68rem', color: 'var(--diag-muted)' }}>{sub}</span>}
    </div>
  );
}

const SEVERITY_META: Record<string, { color: string; dim: string; label: string }> = {
  high: { color: 'var(--diag-danger)', dim: 'var(--diag-danger-dim)', label: 'HIGH' },
  medium: { color: 'var(--diag-amber)', dim: 'var(--diag-amber-dim)', label: 'MED' },
  low: { color: 'var(--diag-success)', dim: 'var(--diag-success-dim)', label: 'LOW' },
};

export function SeverityChip({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.low;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px 3px 7px',
        borderRadius: 999, border: `1px solid ${meta.color}`, background: meta.dim,
        color: meta.color, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
      {meta.label}
    </span>
  );
}
