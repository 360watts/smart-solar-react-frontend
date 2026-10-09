// src/shared/components/SiteDataPanel/components/InsightsRow.tsx
import React from 'react';

/** Flat insight tiles in the KpiCard language: neutral, no dots, no threshold colours. */
const InsightsRow = ({ latest, isLatestToday }: { latest: any; isLatestToday: boolean }) => {
  if (!latest || !isLatestToday) return null;

  const pvKwh = Number(latest.pv_today_kwh ?? 0);
  const loadKwh = Number(latest.load_today_kwh ?? 0);
  const gridBuy = Number(latest.grid_buy_today_kwh ?? 0);
  const gridSell = Number(latest.grid_sell_today_kwh ?? 0);

  if (pvKwh === 0 && loadKwh === 0) return null;

  const co2Kg = pvKwh * 0.82;
  // Net grid = imports minus exports; clamp to 0 if site is a net exporter
  const netGrid = Math.max(0, gridBuy - gridSell);
  const gridDepPct = loadKwh > 0
    ? Math.max(0, Math.min(100, Math.round((netGrid / loadKwh) * 100)))
    : null;
  const selfSufPct = gridDepPct != null ? 100 - gridDepPct : null;

  const items: { label: string; value: string; sub: string }[] = [];

  if (pvKwh > 0) {
    items.push({
      label: 'CO₂ Avoided',
      value: co2Kg >= 1 ? `${co2Kg.toFixed(2)} kg` : `${(co2Kg * 1000).toFixed(0)} g`,
      sub: 'vs grid (0.82 kg/kWh)',
    });
  }
  if (selfSufPct != null) {
    items.push({ label: 'Self-Sufficiency', value: `${selfSufPct}%`, sub: 'load met by solar+battery (net)' });
  }
  if (gridDepPct != null) {
    items.push({ label: 'Grid Dependency', value: `${gridDepPct}%`, sub: 'net grid import / load' });
  }

  if (!items.length) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 8 }}>
        Insights
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {items.map(item => (
          <div key={item.label} data-insight-tile style={{ minWidth: 0, boxSizing: 'border-box', padding: 16, borderRadius: 18, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            <span style={{ fontFamily: "'Rubik', sans-serif", fontSize: 28, fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{item.value}</span>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{item.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsightsRow;
