// src/shared/components/SiteDataPanel/components/EnergyBreakdownRow.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { IST_TIMEZONE } from '../../../app/constants';

function formatEnergyForDisplay(kwh: number | null | undefined): { value: string; unit: string } {
  if (kwh == null || Number.isNaN(kwh)) return { value: '—', unit: 'kWh' };
  const absKwh = Math.abs(kwh);
  if (absKwh < 1) return { value: (kwh * 1000).toFixed(0), unit: 'Wh' };
  return { value: kwh.toFixed(2), unit: 'kWh' };
}

const EnergyBreakdownRow = ({ latest, isLatestToday }: { latest: any; isLatestToday: boolean }) => {
  if (!latest) return null;
  if (!isLatestToday) return null;

  const items = [
    { label: 'Grid In', value: latest.grid_buy_today_kwh, color: '#3b82f6', bg: '#3b82f615', icon: '⬇' },
    { label: 'Grid Out', value: latest.grid_sell_today_kwh, color: '#10b981', bg: '#10b98115', icon: '⬆' },
    { label: 'Batt Chg', value: latest.batt_charge_today_kwh, color: '#8b5cf6', bg: '#8b5cf615', icon: '↑' },
    { label: 'Batt Dchg', value: latest.batt_discharge_today_kwh, color: '#ec4899', bg: '#ec489915', icon: '↓' },
    { label: 'Consumption', value: latest.load_today_kwh, color: '#6b7280', bg: '#6b728015', icon: '⌂' },
  ].filter(e => e.value != null);

  if (!items.length) return null;

  const lastUpdated = latest?.timestamp
    ? new Date(latest.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST_TIMEZONE })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}
    >
      {items.map((e, idx) => (
        (() => {
          const energyDisplay = formatEnergyForDisplay(Number(e.value));
          return (
        <motion.span
          key={e.label}
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.5 + idx * 0.05, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.08, y: -2 }}
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            fontFamily: 'Poppins, sans-serif',
            padding: '6px 12px',
            borderRadius: 20,
            background: e.bg,
            border: `1px solid ${e.color}30`,
            color: e.color,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            boxShadow: `0 2px 8px ${e.color}20`,
          }}
        >
          <span style={{ opacity: 0.85, fontSize: '1rem' }}>{e.icon}</span>
          {e.label}:&nbsp;
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', fontWeight: 700 }}>
              {energyDisplay.value}
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{energyDisplay.unit}</span>
          </span>
        </motion.span>
          );
        })()
      ))}
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          fontFamily: 'Poppins, sans-serif',
          alignSelf: 'flex-start',
          flexBasis: '100%',
          marginTop: 2,
          whiteSpace: 'nowrap',
        }}
      >
        Today{lastUpdated && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> · {lastUpdated}</span>}
      </span>
    </motion.div>
  );
};

export default EnergyBreakdownRow;
