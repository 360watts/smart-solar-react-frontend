import React from 'react';
import { DeviceStatus } from './types';

// 270°-sweep progress arc around the icon — same polar-coordinate technique as
// the customer portal's EnergyFlowDiagram node rings (`arc()` there).
export function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  if (sweepDeg <= 0) return '';
  const clamped = Math.min(sweepDeg, 359.9);
  const rad = (d: number) => (d - 90) * Math.PI / 180;
  const sx = cx + r * Math.cos(rad(startDeg));
  const sy = cy + r * Math.sin(rad(startDeg));
  const ex = cx + r * Math.cos(rad(startDeg + clamped));
  const ey = cy + r * Math.sin(rad(startDeg + clamped));
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 ${clamped > 180 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

export function IconRing({ size, color, active, pct }: { size: number; color: string; active: boolean; pct?: number }) {
  const r = size / 2 - 2.5;
  const cx = size / 2, cy = size / 2;
  const clampedPct = pct != null ? Math.max(0, Math.min(1, pct)) : null;
  return (
    <svg width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <path d={arcPath(cx, cy, r, 225, 270)} fill="none" stroke={`${color}22`} strokeWidth={3} strokeLinecap="round" />
      {active && clampedPct != null && clampedPct > 0 && (
        <path d={arcPath(cx, cy, r, 225, clampedPct * 270)} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}99)` }} />
      )}
    </svg>
  );
}

export interface NodeCardProps {
  label: string;
  icon: React.ReactNode;
  valueStr: string;
  unit: string;
  color: string;
  active: boolean;
  status?: DeviceStatus;
  isAnomalous?: boolean;
  subLabel?: string;
  onClick?: () => void;
  isDark: boolean;
  /** 0–1 fill for the icon's progress-arc ring — e.g. PV vs. inverter capacity,
   * battery SoC/100, grid vs. a reference max. Omit to render icon-only (no ring). */
  arcPct?: number;
}

const STATUS_BG: Record<DeviceStatus, string> = {
  online:  '#16a34a',
  offline: '#dc2626',
  unknown: 'var(--muted-foreground)',
};

export function NodeCard({
  label, icon, valueStr, unit, color, active,
  status, isAnomalous, subLabel, onClick, isDark, arcPct,
}: NodeCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 108,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '11px 10px 10px',
        borderRadius: 24,
        background: isDark
          ? active
            ? `radial-gradient(ellipse at 50% 0%, ${color}1a 0%, #0d1117 70%)`
            : 'rgba(13,17,23,0.95)'
          : active
            ? `radial-gradient(ellipse at 50% 0%, ${color}11 0%, #ffffff 70%)`
            : 'rgba(255,255,255,0.98)',
        border: isAnomalous
          ? '2px solid #ef4444'
          : `1.5px solid ${active
              ? isDark ? `${color}42` : `${color}32`
              : isDark ? 'rgba(31,41,55,0.9)' : '#e5eaf3'}`,
        borderTop: `3.5px solid ${active ? color : 'var(--muted-foreground)'}`,
        boxShadow: isAnomalous
          ? `0 0 20px rgba(239,68,68,0.35), 0 4px 14px rgba(0,0,0,0.25)`
          : active
          ? `0 0 28px ${color}1a, 0 0 14px ${color}14, 0 6px 18px rgba(0,0,0,0.15)`
          : `0 2px 10px rgba(0,0,0,0.1)`,
        cursor: onClick ? 'pointer' : 'default',
        opacity: 1,
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        transform: 'translateZ(0)',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1.06) translateZ(0)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'scale(1) translateZ(0)';
      }}
    >
      {/* Icon circle, with a 270° progress-arc ring when arcPct is given */}
      <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {active && (
          <div style={{
            position: 'absolute', inset: 0,
            background: color, opacity: isDark ? 0.16 : 0.11,
            filter: 'blur(12px)', borderRadius: '50%',
          }} />
        )}
        {arcPct != null && <IconRing size={52} color={color} active={active} pct={arcPct} />}
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: active
            ? isDark ? `${color}20` : `${color}12`
            : 'var(--card)',
          border: `1.5px solid ${active
            ? isDark ? `${color}50` : `${color}40`
            : 'var(--muted-foreground)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 19, fontWeight: 800, lineHeight: 1,
        color: active ? color : 'var(--text-dim)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        {valueStr}
        <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.8 }}>{unit}</span>
      </div>

      {/* Sub-label */}
      {subLabel && (
        <span style={{
          fontSize: 10.5,
          color: active ? `${color}cc` : isDark ? '#cbd5e1' : 'var(--text-dim)',
          marginTop: -2,
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}>
          {subLabel}
        </span>
      )}

      {/* Node label */}
      <span style={{
        fontSize: 10, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: active ? color : isDark ? 'var(--text-dim)' : '#b0bcc8',
        marginTop: subLabel ? 0 : -2,
        whiteSpace: 'nowrap',
        opacity: active ? 0.85 : 1,
      }}>
        {label}
      </span>

      {/* Status badge */}
      {status && (
        <div style={{
          fontSize: 9, fontWeight: 700,
          color: status === 'online' ? '#0A0E1A' : '#FFFFFF', background: STATUS_BG[status],
          borderRadius: 3, padding: '2px 6px',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          marginTop: -2,
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

// Compact card for smart device sub-loads
export interface SmartCardProps {
  label: string;
  icon: React.ReactNode;
  valueStr: string;
  unit: string;
  active: boolean;
  isAnomalous?: boolean;
  onClick?: () => void;
  isDark: boolean;
  accentColor?: string;
  compact?: boolean;
}

export function SmartCard({
  label, icon, valueStr, unit, active, isAnomalous, onClick, isDark, accentColor, compact = false,
}: SmartCardProps) {
  const color = accentColor ?? '#a78bfa';
  return (
    <div
      onClick={onClick}
      style={{
        width: compact ? 88 : 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 4 : 5,
        padding: compact ? '7px 6px 8px' : '9px 8px 9px',
        borderRadius: compact ? 16 : 18,
        background: isDark
          ? active ? `${color}12` : 'rgba(13,17,23,0.92)'
          : active ? `${color}09` : 'rgba(255,255,255,0.98)',
        border: isAnomalous
          ? '1.5px solid #ef4444'
          : `1.5px solid ${active
              ? isDark ? `${color}38` : `${color}30`
              : isDark ? 'rgba(31,41,55,0.8)' : '#e5eaf3'}`,
        borderTop: `3.5px solid ${active ? color : 'var(--muted-foreground)'}`,
        boxShadow: isAnomalous
          ? '0 0 14px rgba(239,68,68,0.28)'
          : active
          ? `0 0 24px ${color}18, 0 0 12px ${color}12, 0 4px 14px rgba(0,0,0,0.12)`
          : '0 1px 6px rgba(0,0,0,0.08)',
        cursor: onClick ? 'pointer' : 'default',
        opacity: 1,
        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: 'translateZ(0)',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scale(1.05) translateZ(0)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'scale(1) translateZ(0)';
      }}
    >
      {/* Icon circle */}
      <div style={{ position: 'relative' }}>
        {active && (
          <div style={{
            position: 'absolute', inset: -7,
            background: color, opacity: isDark ? 0.18 : 0.1,
            filter: 'blur(8px)', borderRadius: '50%',
          }} />
        )}
        <div style={{
          width: compact ? 30 : 34, height: compact ? 30 : 34, borderRadius: '50%',
          background: active ? `${color}16` : 'var(--card)',
          border: `1.5px solid ${active ? `${color}45` : 'var(--muted-foreground)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontSize: compact ? 14 : 16, fontWeight: 800, lineHeight: 1,
        color: active ? color : 'var(--text-dim)',
        fontVariantNumeric: 'tabular-nums',
        display: 'flex', alignItems: 'baseline', gap: 1.5,
        letterSpacing: '-0.01em',
      }}>
        {valueStr}
        <span style={{ fontSize: compact ? 9.5 : 10.5, fontWeight: 600, opacity: 0.8 }}>{unit}</span>
      </div>

      {/* Label */}
      <span style={{
        fontSize: compact ? 9 : 9.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: active ? color : isDark ? 'var(--text-dim)' : '#b0bcc8',
        opacity: active ? 0.85 : 1,
        whiteSpace: 'nowrap', textAlign: 'center',
        maxWidth: compact ? 82 : 92, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
    </div>
  );
}

export { NodeCard as DeviceCard };
export default NodeCard;
