import React from 'react';
import { DeviceStatus } from './types';

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
}

const STATUS_BG: Record<DeviceStatus, string> = {
  online:  '#16a34a',
  offline: '#dc2626',
  unknown: '#64748b',
};

export function NodeCard({
  label, icon, valueStr, unit, color, active,
  status, isAnomalous, subLabel, onClick, isDark,
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
        borderRadius: 12,
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
        borderTop: `3.5px solid ${active ? color : isDark ? '#cbd5e1' : '#e2e8f0'}`,
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
      {/* Icon circle */}
      <div style={{ position: 'relative' }}>
        {active && (
          <div style={{
            position: 'absolute', inset: -10,
            background: color, opacity: isDark ? 0.2 : 0.13,
            filter: 'blur(12px)', borderRadius: '50%',
          }} />
        )}
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: active
            ? isDark ? `${color}20` : `${color}12`
            : isDark ? '#1e293b' : '#f3f6fb',
          border: `1.5px solid ${active
            ? isDark ? `${color}50` : `${color}40`
            : isDark ? '#475569' : '#e5eaf3'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 16, fontWeight: 800, lineHeight: 1,
        color: active ? color : 'var(--text-dim)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        display: 'flex', alignItems: 'baseline', gap: 2,
      }}>
        {valueStr}
        <span style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.8 }}>{unit}</span>
      </div>

      {/* Sub-label */}
      {subLabel && (
        <span style={{
          fontSize: 8.5,
          color: active ? `${color}cc` : isDark ? '#cbd5e1' : 'var(--text-dim)',
          marginTop: -3,
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}>
          {subLabel}
        </span>
      )}

      {/* Node label */}
      <span style={{
        fontSize: 8, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: active ? color : isDark ? 'var(--text-dim)' : '#b0bcc8',
        marginTop: subLabel ? 0 : -3,
        whiteSpace: 'nowrap',
        opacity: active ? 0.85 : 1,
      }}>
        {label}
      </span>

      {/* Status badge */}
      {status && (
        <div style={{
          fontSize: 7, fontWeight: 700,
          color: status === 'online' ? '#0A0E1A' : '#FFFFFF', background: STATUS_BG[status],
          borderRadius: 3, padding: '1.5px 5px',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          marginTop: -3,
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
        width: compact ? 78 : 90,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 4 : 5,
        padding: compact ? '7px 6px 8px' : '9px 8px 9px',
        borderRadius: compact ? 9 : 10,
        background: isDark
          ? active ? `${color}12` : 'rgba(13,17,23,0.92)'
          : active ? `${color}09` : 'rgba(255,255,255,0.98)',
        border: isAnomalous
          ? '1.5px solid #ef4444'
          : `1.5px solid ${active
              ? isDark ? `${color}38` : `${color}30`
              : isDark ? 'rgba(31,41,55,0.8)' : '#e5eaf3'}`,
        borderTop: `3.5px solid ${active ? color : isDark ? '#cbd5e1' : '#e2e8f0'}`,
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
          background: active ? `${color}16` : isDark ? '#1e293b' : '#f3f6fb',
          border: `1.5px solid ${active ? `${color}45` : isDark ? '#475569' : '#e5eaf3'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div style={{
        fontSize: compact ? 12 : 14, fontWeight: 800, lineHeight: 1,
        color: active ? color : 'var(--text-dim)',
        fontVariantNumeric: 'tabular-nums',
        display: 'flex', alignItems: 'baseline', gap: 1.5,
        letterSpacing: '-0.01em',
      }}>
        {valueStr}
        <span style={{ fontSize: compact ? 7.5 : 8.5, fontWeight: 600, opacity: 0.8 }}>{unit}</span>
      </div>

      {/* Label */}
      <span style={{
        fontSize: compact ? 6.8 : 7.5, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.09em',
        color: active ? color : isDark ? 'var(--text-dim)' : '#b0bcc8',
        opacity: active ? 0.85 : 1,
        whiteSpace: 'nowrap', textAlign: 'center',
        maxWidth: compact ? 70 : 80, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
    </div>
  );
}

export { NodeCard as DeviceCard };
export default NodeCard;
