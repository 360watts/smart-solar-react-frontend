import React from 'react';
import { getDesignTokens } from '../../shared/theme';

interface HealthBandProps {
  devicesOnline: number;
  devicesTotal: number;
  pvKw: number | null;
  inverterKw: number | null;
  latitude: number;
  longitude: number;
  timezone: string;
  isActive: boolean;
  alertCount: number;
  hasCritical: boolean;
  onToggleAlerts: () => void;
  /** Whether the alerts list below is open (drives aria-expanded). */
  alertsOpen?: boolean;
  /** Equipment health score 0-100 (getSiteHardwareHealth().overall_score); null/undefined shows "—". */
  equipmentHealth?: number | null;
  isDark: boolean;
}

/** One-row site health for the staff dashboard (replaces the KPI cards and chip row). */
export default function HealthBand({
  devicesOnline, devicesTotal, pvKw, inverterKw, latitude, longitude, timezone,
  isActive, alertCount, hasCritical, onToggleAlerts, alertsOpen = false, equipmentHealth, isDark,
}: HealthBandProps) {
  const t = getDesignTokens(isDark);
  const allOnline = devicesTotal > 0 && devicesOnline >= devicesTotal;
  const status = devicesOnline === 0
    ? { label: 'Offline', dot: t.danger, bg: t.dangerSoft }
    : allOnline
      ? { label: 'Online', dot: t.success, bg: t.successSoft }
      : { label: 'Partly online', dot: t.warning, bg: t.warningSoft };
  const kw = (v: number | null) => (v == null ? '—' : `${v} kW`);

  const label: React.CSSProperties = { fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textMuted };
  const value: React.CSSProperties = { fontFamily: "'Rubik', sans-serif", fontSize: 18, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const cell: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 };

  // Flat card (mockup): no shadow. Wraps to new rows on narrow widths with a smaller row gap.
  return (
    <section
      aria-label="Site health"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 32px', minWidth: 0,
        padding: '16px 24px', borderRadius: 18,
        background: t.surface, border: `1px solid ${t.border}`,
      }}
    >
      <div style={cell}>
        <span style={label}>Status</span>
        <span style={{ ...value, fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: status.dot, boxShadow: `0 0 0 4px ${status.bg}` }} />
          <span>{status.label}</span>
          {!isActive && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: t.warningSoft, color: t.warning }}>Inactive</span>
          )}
        </span>
        {alertCount > 0 ? (
          <button
            type="button"
            onClick={onToggleAlerts}
            aria-expanded={alertsOpen}
            style={{
              minHeight: 44, padding: '0 12px', borderRadius: 10, cursor: 'pointer', alignSelf: 'flex-start',
              background: t.warningSoft, color: t.warning, fontSize: 13, fontWeight: hasCritical ? 800 : 600,
              border: `1px solid ${hasCritical ? t.warning : t.warningSoft}`,
            }}
          >
            {`${alertCount} open alert${alertCount === 1 ? '' : 's'}`}
          </button>
        ) : (
          <span style={{ fontSize: 13, color: t.textMuted }}>No active alerts</span>
        )}
      </div>
      <div style={cell}><span style={label}>Devices</span><span style={value}>{`${devicesOnline} / ${devicesTotal} online`}</span></div>
      <div style={cell}><span style={label}>Solar panels</span><span style={value}>{kw(pvKw)}</span></div>
      <div style={cell}><span style={label}>Inverter</span><span style={value}>{kw(inverterKw)}</span></div>
      <div style={cell}>
        <span style={label}>Equipment health</span>
        <span style={value}>{equipmentHealth == null ? '—' : `${Math.round(equipmentHealth)}%`}</span>
      </div>
      <div style={cell}>
        <span style={label}>Location</span>
        <span style={{ fontSize: 14, color: t.text, overflowWrap: 'anywhere' }}>{`${latitude.toFixed(1)}° N, ${longitude.toFixed(1)}° E · ${timezone}`}</span>
      </div>
    </section>
  );
}
