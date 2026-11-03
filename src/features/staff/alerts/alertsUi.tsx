import React from 'react';

export type Severity = 'critical' | 'warning' | 'info';
export const SEV: Record<Severity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#D92D20' },
  warning: { label: 'Warning', color: '#E3A008' },
  info: { label: 'Info', color: '#2E7BE0' },
};

/** Tint and text are mixed from one colour so the pill reads in light and dark mode. */
export const SevPill: React.FC<{ sev: Severity }> = ({ sev }) => {
  const c = (SEV[sev] ?? SEV.info).color;
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: `color-mix(in srgb, ${c} 70%, var(--foreground))` }}>
      {(SEV[sev] ?? SEV.info).label}
    </span>
  );
};

export const fmtSeconds = (sec?: number | null) => {
  if (sec == null) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
};

export const btn = 'ui-btn ui-btn--support';
export const btnPrimary = 'ui-btn ui-btn--main';
export const btnDanger = 'ui-btn ui-btn--danger';
export const panel = 'rounded-[22px] border border-border bg-card';
