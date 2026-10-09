// src/shared/components/SiteDataPanel/components/EnergyBreakdownRow.tsx
import React from 'react';
import { IST_TIMEZONE } from '../../../../app/constants';
import { FLOW_COLORS } from '../../EnergyFlow/FlowLines';

function formatEnergyForDisplay(kwh: number | null | undefined): { value: string; unit: string } {
  if (kwh == null || Number.isNaN(kwh)) return { value: '—', unit: 'kWh' };
  const absKwh = Math.abs(kwh);
  if (absKwh < 1) return { value: (kwh * 1000).toFixed(0), unit: 'Wh' };
  return { value: kwh.toFixed(2), unit: 'kWh' };
}

/** Today's energy totals as flat cards in the KpiCard language. Dot only for grid blue / battery green. */
const EnergyBreakdownRow = ({ latest, isLatestToday }: { latest: any; isLatestToday: boolean }) => {
  if (!latest) return null;
  if (!isLatestToday) return null;

  const items: { label: string; value: any; dot?: string }[] = [
    { label: 'Grid In', value: latest.grid_buy_today_kwh, dot: FLOW_COLORS.grid },
    { label: 'Grid Out', value: latest.grid_sell_today_kwh, dot: FLOW_COLORS.grid },
    { label: 'Batt Chg', value: latest.batt_charge_today_kwh, dot: FLOW_COLORS.batt },
    { label: 'Batt Dchg', value: latest.batt_discharge_today_kwh, dot: FLOW_COLORS.batt },
    { label: 'Consumption', value: latest.load_today_kwh },
  ].filter(e => e.value != null);

  if (!items.length) return null;

  const lastUpdated = latest?.timestamp
    ? new Date(latest.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST_TIMEZONE })
    : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 8 }}>
        Today{lastUpdated && <span style={{ textTransform: 'none', letterSpacing: 0 }}> · {lastUpdated}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        {items.map(e => {
          const d = formatEnergyForDisplay(Number(e.value));
          return (
            <div key={e.label} data-energy-chip style={{ minWidth: 0, boxSizing: 'border-box', padding: 16, borderRadius: 18, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {e.dot && <span data-energy-dot aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: e.dot, flexShrink: 0 }} />}
                <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
              </div>
              <div style={{ fontFamily: "'Rubik', sans-serif", fontSize: 22, fontWeight: 600, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                {d.value}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dim)', marginLeft: 5 }}>{d.unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EnergyBreakdownRow;
