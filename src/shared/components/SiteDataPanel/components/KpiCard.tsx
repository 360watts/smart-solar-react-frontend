// src/shared/components/SiteDataPanel/components/KpiCard.tsx
import React from 'react';

/** Flat Overview tile in the energy-flow card language: card surface, 1px border, 18 px radius, 12 px uppercase
 * muted label, 28 px Rubik value with tabular numbers, one muted sub-line. No glow, gradient or icon badge.
 * `dot` is a small colour key: solar amber / battery green / grid blue, or a status colour (temperature,
 * forecast) where the colour carries meaning the number alone does not. */
interface KpiCardProps {
  label: string; value: string; unit?: string; sub?: string;
  dot?: string; badge?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, sub, dot, badge }) => (
  <div
    data-kpi-tile
    style={{
      minWidth: 0, boxSizing: 'border-box', padding: 18, borderRadius: 18,
      background: 'var(--card)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {dot && <span data-kpi-dot aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
    <div style={{ fontFamily: "'Rubik', sans-serif", fontSize: 28, fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {value}
      {unit && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dim)', marginLeft: 5 }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 13, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    {badge && <div>{badge}</div>}
  </div>
);

export default KpiCard;
