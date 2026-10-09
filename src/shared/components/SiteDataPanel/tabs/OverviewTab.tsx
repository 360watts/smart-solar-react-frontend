/**
 * OverviewTab — extracted from SiteDataPanel.tsx (lines 5074–5419)
 * Renders: Deye Cloud banner, RS-485 stale banner, EnergyFlow block, six KPI tiles in one row.
 */
import React from 'react';
import { motion } from 'framer-motion';
import KpiCard from '../components/KpiCard';
import { EnergyFlowHealthRow } from '../../../../features/staff/EnergyFlowHealthRow';
import { FLOW_COLORS } from '../../EnergyFlow/FlowLines';
import type { EnergyFlowBlockProps } from '../../EnergyFlow/types';

// Tiles below the flow: the six live tiles in one row on desktop (min 150 px), wrapping on narrow screens, 16 px gaps. Inline grid, not the `grid` class (UI_GUIDE §8).
const TILE_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 };
// "Needs a look" pill: amber, never red (UI_GUIDE §3).
const staleBadge = (text: string) => (
  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', background: 'var(--warning-soft)', padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
    {text}
  </span>
);

const tabTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

interface OverviewTabProps {
  isDark: boolean;
  isTouch: boolean;
  pvKw: number | null;
  loadKw: number | null;
  gridKw: number | null;
  batPowerKw: number | null;
  batSoc: number | null;
  todayKwh: number | null;
  flowToday?: EnergyFlowBlockProps['today'];
  totalPvKwh: number | null;
  invTemp: number | null;
  pvPowerDisplay: { value: string; unit: string };
  gridPowerDisplay: { value: string; unit: string };
  loadPowerDisplay: { value: string; unit: string };
  batteryPowerDisplay: { value: string; unit: string };
  acOutputPowerDisplay: { value: string; unit: string };
  isDataLive: boolean;
  latest: any | null;
  smartDevices: any[];
  siteId: string;
  /** Switches the panel to the Smart plugs tab (the flow's "N smart plugs ›" link). */
  onOpenPlugs?: () => void;
  inverterPhasesForFlow: any;
  isDeyeCloud: boolean;
  rs485Stale: boolean;
  isLatestToday: boolean;
  runStateBadge: { label: string; color: string } | null;
  // Deye cloud internals
  loggerOffline: boolean;
  gatewayOffline: boolean;
  deyeCloudAgeMs: number | null;
  ctStale: boolean;
  ctAgeMs: number | null;
  ctLatest: any | null;
  // Battery
  batDataStale: boolean;
  batDataAgeLabel: string | null;
  batVoltage: number | null;
  batCharging: boolean;
  // Grid/load direction
  gridExporting: boolean;
  gridImporting: boolean;
  // DC/AC
  dcTemp: number | null;
  acOutputKw: number | null;
  inverterCapacityKw?: number | null;
  invTempColor: string;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  isDark,
  pvKw,
  loadKw,
  gridKw,
  batPowerKw,
  batSoc,
  todayKwh,
  flowToday,
  totalPvKwh,
  invTemp,
  pvPowerDisplay,
  gridPowerDisplay,
  loadPowerDisplay,
  batteryPowerDisplay,
  acOutputPowerDisplay,
  isDataLive,
  latest,
  smartDevices,
  siteId,
  onOpenPlugs,
  inverterPhasesForFlow,
  isDeyeCloud,
  rs485Stale,
  isLatestToday,
  loggerOffline,
  gatewayOffline,
  deyeCloudAgeMs,
  ctStale,
  ctAgeMs,
  ctLatest,
  batDataStale,
  batDataAgeLabel,
  batVoltage,
  batCharging,
  gridExporting,
  gridImporting,
  dcTemp,
  acOutputKw,
  inverterCapacityKw,
  invTempColor,
}) => {
  return (
    <motion.div
      key="overview"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20 }
      }}
      transition={tabTransition}
    >
      {/* ── Deye Cloud Status Banner ── */}
      {isDeyeCloud && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 10,
            background: loggerOffline
              ? (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)')
              : (isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)'),
            border: loggerOffline ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(59,130,246,0.35)',
            fontSize: '0.8rem',
            color: loggerOffline ? '#ef4444' : '#3b82f6',
          }}
        >
          <span style={{ fontSize: '1rem' }}>☁️</span>
          <div style={{ flex: 1 }}>
            {/* Status pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                background: gatewayOffline ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                color: gatewayOffline ? '#ef4444' : '#3b82f6',
                border: `1px solid ${gatewayOffline ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: gatewayOffline ? '#ef4444' : '#3b82f6', display: 'inline-block' }} />
                {gatewayOffline ? 'Gateway offline' : 'Gateway online'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                background: loggerOffline ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                color: loggerOffline ? '#ef4444' : '#3b82f6',
                border: `1px solid ${loggerOffline ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: loggerOffline ? '#ef4444' : '#3b82f6', display: 'inline-block' }} />
                {loggerOffline ? 'Logger offline / standby' : 'Deye logger online'}
              </span>
            </div>
            {/* Context message */}
            <span style={{ opacity: 0.85 }}>
              {loggerOffline
                ? <>RS-485 monitoring unavailable. Deye Cloud data is <strong>{Math.round((deyeCloudAgeMs ?? 0) / 60000)} min old</strong> — logger may be in nighttime standby.</>
                : gatewayOffline
                  ? <>Showing values from the <strong>Deye Cloud logger</strong> (WiFi stick). RS-485 gateway is offline — CT meter phase data is frozen.</>
                  : <>Showing values from the <strong>Deye Cloud logger</strong> (WiFi stick). RS-485 gateway is online.</>
              }
            </span>
            {ctStale && (
              <span style={{ display: 'block', marginTop: 4, opacity: 0.85, color: '#f59e0b' }}>
                ⚠ CT meter data is stale ({Math.round((ctAgeMs ?? 0) / 60000)} min old) — phase breakdown may be inaccurate.
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* ── RS-485 Stale Data Banner ── */}
      {rs485Stale && !isDeyeCloud && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            fontSize: '0.8rem',
            color: '#d97706',
          }}
        >
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <div>
            <strong>RS-485 frozen</strong> — PV &amp; inverter readings are stale (holdover values).
            The Deye app shows live data via the WiFi stick which is unaffected.
            <span style={{ marginLeft: 8, opacity: 0.8 }}>Fix: restart the gateway or write reg 62–65.</span>
          </div>
        </motion.div>
      )}

      {/* ── Energy flow ── */}
      <div style={{ marginBottom: 24 }}>
        <EnergyFlowHealthRow siteId={siteId} inverterCapacityKw={inverterCapacityKw} smartDevices={smartDevices} ctReading={ctLatest} latest={latest} today={flowToday} onOpenPlugs={onOpenPlugs} />
      </div>

      {/* ── Below the flow: flat tiles in the flow's card language, one 16 px rhythm ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      <div data-overview-tiles style={TILE_GRID}>
        <KpiCard
          label="Solar PV"
          value={pvPowerDisplay.value}
          unit={pvPowerDisplay.unit}
          sub={rs485Stale && !isDeyeCloud
            ? 'RS-485 frozen — value unreliable'
            : todayKwh != null && isLatestToday
              ? `${todayKwh.toFixed(2)} kWh today${totalPvKwh != null ? ` · ${totalPvKwh.toFixed(1)} kWh total` : ''}`
              : undefined}
          dot={rs485Stale && !isDeyeCloud ? 'var(--muted-foreground)' : FLOW_COLORS.solar}
          badge={rs485Stale && !isDeyeCloud ? staleBadge('Stale') : undefined}
        />
        <KpiCard
          label="Battery"
          value={batSoc != null ? batSoc.toFixed(0) : '—'}
          unit="%"
          sub={[
            batPowerKw != null ? (Math.abs(batPowerKw) < 0.01 ? `Idle ${batteryPowerDisplay.value} ${batteryPowerDisplay.unit}` : `${batCharging ? 'Charging' : 'Discharging'} ${batteryPowerDisplay.value} ${batteryPowerDisplay.unit}`) : null,
            latest?.battery_temp_c != null ? `${Number(latest.battery_temp_c).toFixed(0)}°C` : null,
          ].filter(Boolean).join(' · ') || undefined}
          dot={FLOW_COLORS.batt}
          badge={
            batDataStale && batDataAgeLabel ? staleBadge(batDataAgeLabel)
            : batVoltage != null ? (
              <span style={{ fontSize: 13, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                {batVoltage.toFixed(1)} V
              </span>
            ) : undefined
          }
        />
        <KpiCard
          label="Load"
          value={loadPowerDisplay.value}
          unit={loadPowerDisplay.unit}
          sub={rs485Stale && !isDeyeCloud
            ? 'RS-485 frozen — value unreliable'
            : latest?.load_today_kwh != null && isLatestToday
              ? `${Number(latest.load_today_kwh).toFixed(2)} kWh today`
              : undefined}
          badge={rs485Stale && !isDeyeCloud ? staleBadge('Stale') : undefined}
        />
        <KpiCard
          label="Grid"
          value={gridPowerDisplay.value}
          unit={gridPowerDisplay.unit}
          sub={
            gridKw != null
              ? gridExporting
                ? 'Exporting to grid'
                : gridImporting
                ? 'Importing from grid'
                : 'No flow'
              : undefined
          }
          dot={gridExporting || gridImporting ? FLOW_COLORS.grid : 'var(--muted-foreground)'}
        />
        <KpiCard
          label="Temp"
          value={invTemp != null ? invTemp.toFixed(1) : '—'}
          unit="°C"
          sub={dcTemp != null ? `Heat sink · DC ${dcTemp.toFixed(1)}°C` : 'Heat sink'}
          dot={invTempColor}
        />
        {acOutputKw != null && acOutputKw > 0 && (
          <KpiCard
            label="AC Output"
            value={acOutputPowerDisplay.value}
            unit={acOutputPowerDisplay.unit}
            sub={rs485Stale && !isDeyeCloud ? 'RS-485 frozen — value unreliable' : 'Inverter output'}
            badge={rs485Stale && !isDeyeCloud ? staleBadge('Stale') : undefined}
          />
        )}
      </div>
      </div>

    </motion.div>
  );
};

export default OverviewTab;
