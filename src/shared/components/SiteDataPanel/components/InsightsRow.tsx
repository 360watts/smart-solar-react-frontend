// src/shared/components/SiteDataPanel/components/InsightsRow.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../../../contexts/ThemeContext';

const InsightsRow = ({ latest, isLatestToday }: { latest: any; isLatestToday: boolean }) => {
  const { isDark } = useTheme();
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

  const items: { icon: string; label: string; value: string; sub?: string; color: string; bg: string }[] = [];

  if (pvKwh > 0) {
    items.push({
      icon: '🌿',
      label: 'CO₂ Avoided',
      value: co2Kg >= 1 ? `${co2Kg.toFixed(2)} kg` : `${(co2Kg * 1000).toFixed(0)} g`,
      sub: 'vs grid (0.82 kg/kWh)',
      color: '#10b981',
      bg: '#10b98115',
    });
  }
  if (selfSufPct != null) {
    const color = selfSufPct >= 70 ? '#00a63e' : selfSufPct >= 40 ? '#f59e0b' : '#ef4444';
    items.push({
      icon: '⚡',
      label: 'Self-Sufficiency',
      value: `${selfSufPct}%`,
      sub: 'load met by solar+battery (net)',
      color,
      bg: `${color}15`,
    });
  }
  if (gridDepPct != null) {
    const color = gridDepPct <= 20 ? '#10b981' : gridDepPct <= 50 ? '#f59e0b' : '#ef4444';
    items.push({
      icon: '🔌',
      label: 'Grid Dependency',
      value: `${gridDepPct}%`,
      sub: 'net grid import / load',
      color,
      bg: `${color}15`,
    });
  }

  if (!items.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}
    >
      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif', alignSelf: 'center', minWidth: 50 }}>
        Insights
      </span>
      {items.map((item, idx) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ delay: 0.7 + idx * 0.08, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.05, rotateY: 5, y: -4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 12,
            background: item.bg,
            border: `1px solid ${item.color}30`,
            flexShrink: 0,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${item.color}20`,
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{item.icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.688rem', color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {item.label}
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: item.color, fontSize: '1rem', lineHeight: 1 }}>
              {item.value}
            </span>
            {item.sub && (
              <span style={{ fontSize: '0.625rem', color: 'var(--muted-foreground)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
                {item.sub}
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default InsightsRow;
