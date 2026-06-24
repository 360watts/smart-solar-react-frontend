// src/shared/components/SiteDataPanel/components/ChartTooltips.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../../../contexts/ThemeContext';

export const ForecastTooltip = ({ active, payload, label }: any) => {
  const { isDark } = useTheme();
  if (!active || !payload || !payload.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}`,
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        minWidth: 160,
      }}>
      <div style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827', fontSize: '0.875rem', marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}` }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((entry: any, idx: number) => {
          const unit = entry.name?.includes('Temp') ? '°C' : entry.name?.includes('GHI') ? 'W/m²' : 'kW';
          return (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', color: isDark ? '#94a3b8' : '#374151' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.stroke || entry.fill, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{entry.name?.split(' ')[0]}</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827' }}>
                {Number(entry.value).toFixed(2)} {unit}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

/** Reusable chart tooltip matching Forecast style */
export const ChartTooltip = ({ active, payload, label, unitResolver }: { active?: boolean; payload?: any[]; label?: string; unitResolver?: (entry: any) => string }) => {
  const { isDark } = useTheme();
  if (!active || !payload || !payload.length) return null;
  const getUnit = unitResolver ?? (() => 'kW');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}`,
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        minWidth: 160,
      }}>
      <div style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827', fontSize: '0.875rem', marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 166, 62, 0.2)'}` }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((entry: any, idx: number) => {
          const unit = getUnit(entry);
          const decimals = unit === '%' ? 0 : 3;
          const val = entry.value != null ? Number(entry.value).toFixed(decimals) : '—';
          return (
            <motion.div
              key={entry.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: '0.813rem', fontFamily: 'Inter, sans-serif', color: isDark ? '#94a3b8' : '#374151' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.stroke || entry.fill, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{entry.name ?? ''}</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: isDark ? '#f1f5f9' : '#111827' }}>
                {val} {unit}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export const REGIME_STYLE: Record<string, { bg: string; color: string }> = {
  night: { bg: '#1e293b1a', color: '#94a3b8' },
  ramp: { bg: '#f59e0b18', color: '#d97706' },
  midday: { bg: '#F0752218', color: '#c2410c' },
};

export const ForecastXAxisTick = ({ x, y, payload, forecastWindow: fw }: any) => {
  const val: string = payload?.value ?? '';
  if (!val) return null;
  const isToday = fw === 'today';
  const line1 = isToday ? val : (val.split('||')[0] ?? val).trim();
  const line2 = isToday ? '' : (val.split('||')[1] ?? '').trim();

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fill="#00a63e" fontSize={10} fontWeight={700} fontFamily="Inter, sans-serif">
        {line1}
      </text>
      {!isToday && line2 && (
        <text x={0} y={0} dy={25} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">
          {line2}
        </text>
      )}
    </g>
  );
};

export const ChartXAxisTick = ({ x, y, payload }: any) => {
  const val: string = (payload?.value ?? '').toString().trim();
  if (!val) return null;
  const parts = val.split('||').map((s: string) => s.trim());
  const line1 = parts[0] ?? val;
  const line2 = parts.length > 1 ? parts[1] : '';

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={13} textAnchor="middle" fill="#00a63e" fontSize={10} fontWeight={700} fontFamily="Inter, sans-serif">
        {line1}
      </text>
      {line2 && (
        <text x={0} y={0} dy={25} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">
          {line2}
        </text>
      )}
    </g>
  );
};
