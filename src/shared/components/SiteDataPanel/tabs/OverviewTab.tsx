/**
 * OverviewTab — extracted from SiteDataPanel.tsx (lines 5074–5419)
 * Renders: Deye Cloud banner, RS-485 stale banner, EnergyFlow block, KPI cards,
 *          per-phase grid/load cards, energy breakdown row, insights row.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Sun } from 'lucide-react';
import KpiCard, { IconSunKpi, IconBattery, IconLoad, IconGrid, IconThermometer } from '../components/KpiCard';
import EnergyBreakdownRow from '../components/EnergyBreakdownRow';
import InsightsRow from '../components/InsightsRow';
import { EnergyFlowHealthRow } from '../../../../features/staff/EnergyFlowHealthRow';

const iconSize = 16;

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
  inverterPhasesForFlow: any;
  isDeyeCloud: boolean;
  rs485Stale: boolean;
  isLatestToday: boolean;
  achievedPct: number | null;
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
  // Phase data
  gridPhases: { label: string; powerW: number | null; voltageV: number | null; currentA: number | null }[] | null;
  phaseDataStale: boolean;
  loadPhases: { label: string; powerW: number | null }[] | null;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  isDark,
  isTouch,
  pvKw,
  loadKw,
  gridKw,
  batPowerKw,
  batSoc,
  todayKwh,
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
  inverterPhasesForFlow,
  isDeyeCloud,
  rs485Stale,
  isLatestToday,
  achievedPct,
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
  gridPhases,
  phaseDataStale,
  loadPhases,
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
                padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                background: gatewayOffline ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                color: gatewayOffline ? '#ef4444' : '#3b82f6',
                border: `1px solid ${gatewayOffline ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: gatewayOffline ? '#ef4444' : '#3b82f6', display: 'inline-block' }} />
                {gatewayOffline ? 'Gateway offline' : 'Gateway online'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
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

      {/* ── Solar Observatory — flow + health 50/50 ── */}
      <div style={{ marginBottom: 20 }}>
        <EnergyFlowHealthRow siteId={siteId} inverterCapacityKw={inverterCapacityKw} smartDevices={smartDevices} ctReading={ctLatest} latest={latest} />
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <KpiCard
          index={0}
          label="Solar PV"
          noHover={isTouch}
          value={pvPowerDisplay.value}
          unit={pvPowerDisplay.unit}
          sub={rs485Stale && !isDeyeCloud
            ? 'RS-485 frozen — value unreliable'
            : todayKwh != null && isLatestToday
              ? `${todayKwh.toFixed(2)} kWh today${totalPvKwh != null ? ` · ${totalPvKwh.toFixed(1)} kWh total` : ''}`
              : undefined}
          accent={rs485Stale && !isDeyeCloud ? 'var(--muted-foreground)' : '#F07522'}
          icon={<IconSunKpi />}
          badge={rs485Stale && !isDeyeCloud ? (
            <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
              STALE
            </span>
          ) : undefined}
        />
        <KpiCard
          index={1}
          label="Battery"
          noHover={isTouch}
          value={batSoc != null ? batSoc.toFixed(0) : '—'}
          unit="%"
          sub={[
            batPowerKw != null ? (Math.abs(batPowerKw) < 0.01 ? `Idle ${batteryPowerDisplay.value} ${batteryPowerDisplay.unit}` : `${batCharging ? 'Charging' : 'Discharging'} ${batteryPowerDisplay.value} ${batteryPowerDisplay.unit}`) : null,
            latest?.battery_temp_c != null ? `${Number(latest.battery_temp_c).toFixed(0)}°C` : null,
          ].filter(Boolean).join(' · ') || undefined}
          accent="#00a63e"
          icon={<IconBattery />}
          badge={
            batDataStale && batDataAgeLabel ? (
              <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                {batDataAgeLabel}
              </span>
            ) : batVoltage != null ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {batVoltage.toFixed(1)} V
              </span>
            ) : undefined
          }
        />
        <KpiCard
          index={2}
          label="Load"
          noHover={isTouch}
          value={loadPowerDisplay.value}
          unit={loadPowerDisplay.unit}
          sub={rs485Stale && !isDeyeCloud
            ? 'RS-485 frozen — value unreliable'
            : latest?.load_today_kwh != null && isLatestToday
              ? `${Number(latest.load_today_kwh).toFixed(2)} kWh today`
              : undefined}
          accent={rs485Stale && !isDeyeCloud ? 'var(--muted-foreground)' : '#8b5cf6'}
          icon={<IconLoad />}
          badge={rs485Stale && !isDeyeCloud ? (
            <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
              STALE
            </span>
          ) : undefined}
        />
        <KpiCard
          index={3}
          label="Grid"
          noHover={isTouch}
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
          accent={gridExporting ? '#10b981' : gridImporting ? '#3b82f6' : 'var(--muted-foreground)'}
          icon={<IconGrid />}
        />
        <KpiCard
          index={4}
          label="Temp"
          noHover={isTouch}
          value={invTemp != null ? invTemp.toFixed(1) : '—'}
          unit="°C"
          sub={dcTemp != null ? `Heat sink · DC ${dcTemp.toFixed(1)}°C` : 'Heat sink'}
          accent={invTempColor}
          icon={<IconThermometer />}
        />
        {acOutputKw != null && acOutputKw > 0 && (
          <KpiCard
            index={5}
            label="AC Output"
            noHover={isTouch}
            value={acOutputPowerDisplay.value}
            unit={acOutputPowerDisplay.unit}
            sub={rs485Stale && !isDeyeCloud ? 'RS-485 frozen — value unreliable' : 'Inverter output'}
            accent={rs485Stale && !isDeyeCloud ? 'var(--muted-foreground)' : '#a78bfa'}
            icon={<Zap size={iconSize} />}
            badge={rs485Stale && !isDeyeCloud ? (
              <span style={{ fontSize: '0.65rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                STALE
              </span>
            ) : undefined}
          />
        )}
        {inverterCapacityKw != null && (
          <KpiCard
            index={6}
            label="Inv. Capacity"
            noHover={isTouch}
            value={inverterCapacityKw.toFixed(1)}
            unit="kW"
            sub="Rated output"
            accent="#6366f1"
            icon={<Zap size={iconSize} />}
          />
        )}
        {achievedPct != null && (
          <KpiCard
            index={7}
            label="Forecast"
            noHover={isTouch}
            value={achievedPct.toString()}
            unit="%"
            sub="Actual vs P50 so far"
            accent={achievedPct >= 90 ? '#00a63e' : achievedPct >= 70 ? '#f59e0b' : '#ef4444'}
            icon={<Sun size={iconSize} />}
          />
        )}
      </div>

      {/* ── Per-Phase Grid Cards ── */}
      {gridPhases && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Grid Phases (EB)
            </div>
            {phaseDataStale && (
              <span style={{ fontSize: '0.65rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                stale — inverter standby
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', opacity: phaseDataStale ? 0.45 : 1 }}>
            {gridPhases.map((ph, i) => {
              const exporting = !phaseDataStale && ph.powerW != null && ph.powerW <= -1;
              const importing = !phaseDataStale && ph.powerW != null && ph.powerW >= 1;
              const accent = phaseDataStale ? 'var(--muted-foreground)' : exporting ? '#10b981' : importing ? '#3b82f6' : 'var(--muted-foreground)';
              const powerLabel = phaseDataStale ? '—'
                : ph.powerW != null
                  ? `${Math.abs(ph.powerW).toFixed(0)} W ${exporting ? '↑' : importing ? '↓' : ''}`
                  : '—';
              const subParts: string[] = [];
              if (!phaseDataStale && ph.voltageV != null) subParts.push(`${ph.voltageV.toFixed(1)} V`);
              if (!phaseDataStale && ph.currentA != null) subParts.push(`${Math.abs(ph.currentA).toFixed(2)} A`);
              return (
                <KpiCard
                  key={ph.label}
                  index={i}
                  label={`Phase ${ph.label}`}
                  value={powerLabel}
                  accent={accent}
                  sub={subParts.join(' · ') || undefined}
                  icon={<IconGrid />}
                  noHover={isTouch}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Per-Phase Load Cards ── */}
      {loadPhases && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Load Phases
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {loadPhases.map((ph, i) => {
              const hasLoad = ph.powerW != null && ph.powerW > 1;
              const accent = hasLoad ? '#8b5cf6' : 'var(--muted-foreground)';
              const powerLabel = ph.powerW != null ? `${Math.abs(ph.powerW).toFixed(0)} W` : '—';
              return (
                <KpiCard
                  key={ph.label}
                  index={i}
                  label={`Phase ${ph.label}`}
                  value={powerLabel}
                  accent={accent}
                  icon={<IconLoad />}
                  noHover={isTouch}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Energy breakdown ── */}
      <EnergyBreakdownRow latest={latest} isLatestToday={isLatestToday} />

      {/* ── Insights ── */}
      <InsightsRow latest={latest} isLatestToday={isLatestToday} />

    </motion.div>
  );
};

export default OverviewTab;
