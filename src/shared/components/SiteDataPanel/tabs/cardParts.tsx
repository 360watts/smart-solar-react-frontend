/**
 * Controls and KPI tiles shared by the Load card and the Solar card.
 * Tiles: Nov 18 Solar card mockup (https://claude.ai/artifact/TAC9Vwj1bVjGNWSVhL2ffz).
 */
import React from 'react';

export const segWrap = (isDark: boolean): React.CSSProperties => ({
  display: 'inline-flex', borderRadius: 10, overflow: 'hidden',
  border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.1)'}`,
  background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(241,245,249,0.8)',
});
// one neutral selected state for every group: colour in the controls carried no meaning
export const segBtn = (active: boolean, first: boolean, isDark: boolean): React.CSSProperties => ({
  border: 'none', borderLeft: first ? 'none' : `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)'}`,
  background: active ? 'var(--foreground)' : 'transparent',
  color: active ? 'var(--background)' : 'var(--muted-foreground)',
  padding: '0 12px', minHeight: 32, fontSize: '0.8125rem', fontWeight: active ? 600 : 500, cursor: 'pointer',
  fontFamily: 'Rubik, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 5,
});
export const groupLabel: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 500, color: 'var(--muted-foreground)', fontFamily: 'Rubik, sans-serif',
};
export const groupRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };

export function Seg<T extends string>({ label, value, options, onChange, isDark }: {
  label: string; value: T; options: readonly (readonly [T, string, string?])[];
  onChange: (v: T) => void; isDark: boolean;
}) {
  return (
    <div role="group" aria-label={label} style={segWrap(isDark)}>
      {options.map(([k, text, hint], i) => (
        <button key={k} type="button" title={hint} aria-pressed={value === k} onClick={() => onChange(k)}
          style={segBtn(value === k, i === 0, isDark)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export type Tone = 'orange' | 'teal' | 'amber' | 'blue' | 'neutral';
// [background, border, label, value] for light and dark; every pair passes 4.5:1
const TONES: Record<Tone, { light: string[]; dark: string[] }> = {
  orange: { light: ['#fff7ed', '#fed7aa', '#9a3412', '#c2410c'], dark: ['rgba(240,117,34,0.12)', 'rgba(240,117,34,0.32)', '#fdba74', '#fb923c'] },
  teal: { light: ['#f0fdfa', '#99f6e4', '#115e59', '#0b7a6e'], dark: ['rgba(46,240,204,0.08)', 'rgba(46,240,204,0.26)', '#5eead4', '#2ef0cc'] },
  amber: { light: ['#fffbeb', '#fde68a', '#92400e', '#b45309'], dark: ['rgba(245,158,11,0.12)', 'rgba(245,158,11,0.32)', '#fcd34d', '#fbbf24'] },
  blue: { light: ['#eff6ff', '#bfdbfe', '#1e40af', '#1d4ed8'], dark: ['rgba(96,165,250,0.12)', 'rgba(96,165,250,0.32)', '#93c5fd', '#60a5fa'] },
  neutral: { light: ['#f8fafc', '#e2e8f0', '#334155', '#0f172a'], dark: ['rgba(148,163,184,0.08)', 'rgba(148,163,184,0.22)', '#cbd5e1', '#f1f5f9'] },
};

export const KpiRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>{children}</div>
);

export const KpiTile: React.FC<{
  label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode; tone?: Tone; isDark: boolean;
  bar?: number | null; // 0–100, a progress bar under the value
}> = ({ label, value, unit, sub, tone = 'neutral', isDark, bar }) => {
  const [bg, border, lab, val] = TONES[tone][isDark ? 'dark' : 'light'];
  return (
    <div data-testid="kpi" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontFamily: 'Rubik, sans-serif', fontSize: '0.8125rem', fontWeight: 700, color: lab, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.05, color: val, fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit && <span style={{ fontSize: '0.95rem', fontWeight: 500, marginLeft: 6 }}>{unit}</span>}
      </span>
      {bar != null && (
        <div style={{ height: 6, borderRadius: 3, background: border, overflow: 'hidden' }}>
          <div style={{ height: 6, width: `${Math.max(0, Math.min(100, bar))}%`, background: val, borderRadius: 3 }} />
        </div>
      )}
      {sub != null && <span style={{ fontFamily: 'Rubik, sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: lab }}>{sub}</span>}
    </div>
  );
};

/**
 * Chart text colours from the theme flag, not from CSS variables: options are built during render, before the
 * theme effect swaps the .dark-mode class, so reading the variable then gave the other theme's colour
 * (Nov 18: a near-white legend in light mode).
 */
export const ink = (isDark: boolean) => (isDark ? '#EEF1F8' : '#12151A');
export const inkMuted = (isDark: boolean) => (isDark ? '#A3ADBF' : '#4B6767');


/**
 * HTML legend above a chart (Nov 18): the Chart.js legend sized every marker from one box (24 px circles next
 * to small squares), showed dashed lines as solid and sat on the top tick. Items come from the datasets.
 */
type LegendKind = 'line' | 'dash' | 'dot' | 'hollow' | 'band';
export interface LegendItem { label: string; color: string; kind: LegendKind; fill?: string }

const solid = (c: any, fallback: string) => (typeof c === 'string' && c !== 'transparent' ? c : fallback);
export function legendFrom(datasets: any[]): LegendItem[] {
  return datasets
    .filter(d => d && !String(d.label).startsWith('_') && !String(d.label).endsWith(' forecast'))
    .sort((x, y) => (x.order ?? 0) - (y.order ?? 0)) // what is drawn on top (actual) is named first
    .map(d => {
      const color = solid(d.borderColor, solid(d.backgroundColor, '#94a3b8'));
      if (d.fill && d.fill !== false) return { label: d.label, color, kind: 'band' as const, fill: solid(d.backgroundColor, color) };
      if (d.pointBackgroundColor === '#fff') return { label: d.label, color, kind: 'hollow' as const };
      if (typeof d.pointRadius === 'number' && d.pointRadius > 0) return { label: d.label, color, kind: 'dot' as const };
      return { label: d.label, color, kind: d.borderDash ? 'dash' as const : 'line' as const };
    });
}

function Swatch({ item }: { item: LegendItem }) {
  const { color, kind } = item;
  return (
    <svg width="24" height="12" aria-hidden="true" style={{ flexShrink: 0 }}>
      {kind === 'band' && <rect x="0" y="1" width="24" height="10" rx="2" fill={item.fill} stroke={color === item.fill ? 'none' : color} strokeDasharray="2 2" />}
      {(kind === 'line' || kind === 'dot' || kind === 'hollow') && <line x1="0" y1="6" x2="24" y2="6" stroke={color} strokeWidth="2.4" strokeDasharray={kind === 'hollow' ? '3 3' : undefined} />}
      {kind === 'dash' && <line x1="0" y1="6" x2="24" y2="6" stroke={color} strokeWidth="2.4" strokeDasharray="6 4" />}
      {kind === 'dot' && <circle cx="12" cy="6" r="4" fill={color} />}
      {kind === 'hollow' && <circle cx="12" cy="6" r="4" fill="var(--card, #fff)" stroke={color} strokeWidth="2" />}
    </svg>
  );
}

export const ChartLegend: React.FC<{ items: LegendItem[] }> = ({ items }) => (
  <div data-testid="legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 10 }}>
    {items.map(it => (
      <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'Rubik, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>
        <Swatch item={it} />{it.label}
      </span>
    ))}
  </div>
);
