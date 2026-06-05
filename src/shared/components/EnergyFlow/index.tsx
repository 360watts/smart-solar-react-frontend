import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Battery, Home, Zap, Wind, Droplets, Waves, Plug, Activity, Grid } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { NodeCard, SmartCard } from './DeviceCard';
import DeviceDetailPanel from './DeviceDetailPanel';
import AnomalyBanner from './AnomalyBanner';
import { EnergyFlowBlockProps, SmartDeviceNode, ApplianceLabel } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Layout:
//   TOP SVG:  PV (left) — Hub/Inverter (center) — Battery (upper-right)
//                                                — Grid    (lower-right)
//   HUB MASK: opaque circle in SVG covers track lines behind the hub node
//   BELOW:    Total Load NodeCard (centered) → Y-connector → Solar Load | Non Solar Load
//
// Fixed aspect-ratio box (paddingBottom trick): SVG viewBox coordinates and
// CSS percentage positions are mathematically identical — no ResizeObserver.
// ─────────────────────────────────────────────────────────────────────────────

const VW = 700;
const VH = 200;
const ASPECT_PAD = `${(VH / VW) * 100}%`;  // 28.57%

// Node centers in SVG coordinate space
const N = {
  pv:   { x: 90,  y: 100 },
  hub:  { x: 350, y: 100 },
  batt: { x: 590, y: 55  },
  grid: { x: 590, y: 145 },
} as const;

// Hub SVG radius to trim — paths stop this many units from hub center
const HUB_R = 38;   // hub circle radius in SVG units at ~580px display width

// ── Path helpers ──────────────────────────────────────────────────────────────

// Point at distance `trim` before (x2, y2) along the (x1→x2) line
function trimEnd(x1: number, y1: number, x2: number, y2: number, trim: number) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const t = Math.max(0, (dist - trim) / dist);
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

// Point at distance `trim` after (x1, y1) along the (x1→x2) line
function trimStart(x1: number, y1: number, x2: number, y2: number, trim: number) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const t = Math.min(1, trim / dist);
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

// S-curve bezier — adapts to dominant axis
const bez = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = x1 + dx * 0.5;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  const my = y1 + dy * 0.5;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
};

// Build trimmed path: trim both near-hub end and source-node start
function hubPath(
  sx: number, sy: number,
  direction: 'toHub' | 'fromHub',
  srcTrim = 52,   // trim source end (inside node card area)
  hubTrim = HUB_R
) {
  if (direction === 'toHub') {
    const s = trimStart(sx, sy, N.hub.x, N.hub.y, srcTrim);
    const e = trimEnd(sx, sy, N.hub.x, N.hub.y, hubTrim);
    return bez(s.x, s.y, e.x, e.y);
  } else {
    const s = trimStart(N.hub.x, N.hub.y, sx, sy, hubTrim);
    const e = trimEnd(N.hub.x, N.hub.y, sx, sy, srcTrim);
    return bez(s.x, s.y, e.x, e.y);
  }
}

// NODE_R: NodeCard half-width in SVG units at ~580px display width.
// Card DOM width=108px → half=54px → 54*(700/580)≈65 SVG units.
// Cards sit at zIndex:2 so the buried portion is hidden; trim ensures
// paths visually start/end exactly at the card border.
const NODE_R = 65;

// Pre-compute all paths — trim both ends so lines span card-border → hub-border.
const P = {
  pvToHub:   hubPath(N.pv.x,   N.pv.y,   'toHub',   NODE_R),
  battToHub: hubPath(N.batt.x, N.batt.y, 'toHub',   NODE_R),
  hubToBatt: hubPath(N.batt.x, N.batt.y, 'fromHub', NODE_R),
  gridToHub: hubPath(N.grid.x, N.grid.y, 'toHub',   NODE_R),
  hubToGrid: hubPath(N.grid.x, N.grid.y, 'fromHub', NODE_R),
  // Straight down: hub bottom edge → SVG bottom (card top sits exactly at SVG bottom with marginTop=0)
  hubToLoad: `M ${N.hub.x} ${N.hub.y + HUB_R} L ${N.hub.x} ${VH}`,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtPower = (kw: number) =>
  Math.abs(kw) >= 1
    ? { valueStr: Math.abs(kw).toFixed(2), unit: 'kW' }
    : { valueStr: (Math.abs(kw) * 1000).toFixed(0), unit: 'W' };

const applIcon = (label: ApplianceLabel, color: string, size = 15) => {
  const p = { size, color };
  switch (label) {
    case 'ev_charger':      return <Zap {...p} />;
    case 'geyser':          return <Droplets {...p} />;
    case 'ac_unit':         return <Wind {...p} />;
    case 'water_pump':      return <Droplets {...p} />;
    case 'washing_machine': return <Waves {...p} />;
    default:                return <Plug {...p} />;
  }
};

const GRID_APPLIANCES: ApplianceLabel[] = ['ev_charger', 'geyser', 'ac_unit', 'washing_machine'];
const circuitOf = (d: SmartDeviceNode): 'solar' | 'grid' =>
  d.circuit ?? (GRID_APPLIANCES.includes(d.appliance_label) ? 'grid' : 'solar');

// ── SVG primitives ────────────────────────────────────────────────────────────

function Track({ d, color }: { d: string; color: string }) {
  return (
    <path d={d} stroke={color} strokeWidth={2} strokeOpacity={0.35}
      fill="none" strokeLinecap="round" />
  );
}

// Beam: flowing dashes via strokeDashoffset animation.
// Uses ABSOLUTE SVG-unit dash values (no pathLength normalisation) so the
// pattern is always visible regardless of path length or display width.
// dash=20 SVG units, gap=14 SVG units → clear at any viewport size.
// DASH=18, GAP=64 → period=82. pvToHub path ≈166 units → 166/82 ≈ 2 dashes.
const DASH = 18, GAP = 64, PERIOD = DASH + GAP;

function Beam({
  d, stroke, active, speed = 1.6, intensity = 1,
}: { d: string; stroke: string; active?: boolean; uid?: string; speed?: number; intensity?: number }) {
  if (!active) return null;
  // Intensity adjusts glow strength and opacity based on power flow (0–1)
  const baseOpacity = Math.min(1, 0.12 + intensity * 0.15);  // Increased base
  const midOpacity = Math.min(1, 0.25 + intensity * 0.25);   // Increased mid
  const speedAdjust = speed * (0.8 + intensity * 0.4);

  return (
    <g>
      {/* Wide glow halo — soft outer envelope */}
      <path d={d} stroke={stroke} strokeWidth={12} strokeOpacity={baseOpacity}
        fill="none" strokeLinecap="round" />
      {/* Mid-range glow — body glow */}
      <path d={d} stroke={stroke} strokeWidth={8} strokeOpacity={midOpacity}
        fill="none" strokeLinecap="round" />
      {/* Core animated beam — CSS keyframe drives stroke-dashoffset */}
      <path
        className="ef-beam"
        d={d}
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${DASH} ${GAP}`}
        strokeDashoffset={0}
        filter="url(#efglow)"
        style={{ '--ef-duration': `${(1.6 / speedAdjust).toFixed(3)}s` } as React.CSSProperties}
      />
    </g>
  );
}

function At({ cx, cy, children }: { cx: number; cy: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute',
      left: `${(cx / VW) * 100}%`,
      top: `${(cy / VH) * 100}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: 2,
    }}>
      {children}
    </div>
  );
}

function HubNode({ isDark }: { isDark: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <motion.div
        animate={{
          boxShadow: [
            '0 0 16px rgba(99,102,241,0.28), 0 0 32px rgba(99,102,241,0.12)',
            '0 0 32px rgba(99,102,241,0.65), 0 0 56px rgba(99,102,241,0.25)',
            '0 0 16px rgba(99,102,241,0.28), 0 0 32px rgba(99,102,241,0.12)',
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 35% 35%, rgba(99,102,241,0.5) 0%, #0d1117 100%)'
            : 'radial-gradient(circle at 35% 35%, rgba(99,102,241,0.24) 0%, #f8f9ff 100%)',
          border: `2.5px solid ${isDark ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.38)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.div
          animate={{ opacity: [0.15, 0.45, 0.15], scale: [1, 1.28, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: -12, borderRadius: '50%',
            border: '1.5px solid rgba(99,102,241,0.28)', pointerEvents: 'none',
          }}
        />
        <Activity size={26} color="#818cf8" />
      </motion.div>
      <span style={{
        fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: isDark ? '#6366f1' : '#4f46e5',
      }}>
        Inverter
      </span>
    </div>
  );
}

// Sub-load section — equal height via flex column stretch
function SubSection({
  title, icon, accentColor, devices, isDark, onDeviceClick,
  fallbackKw, fallbackLabel,
}: {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  devices: SmartDeviceNode[];
  isDark: boolean;
  onDeviceClick: (d: SmartDeviceNode) => void;
  fallbackKw?: number;
  fallbackLabel?: string;
}) {
  const hasFallbackPower = (fallbackKw ?? 0) > 0.01;
  return (
    <div style={{
      borderRadius: 12,
      border: `1.5px solid ${isDark ? `${accentColor}34` : `${accentColor}38`}`,
      background: isDark
        ? `linear-gradient(135deg, ${accentColor}14 0%, ${accentColor}07 100%)`
        : `linear-gradient(135deg, ${accentColor}13 0%, ${accentColor}06 100%)`,
      boxShadow: `0 0 20px ${accentColor}08, 0 2px 8px rgba(0,0,0,0.08)`,
      padding: '10px 12px 12px',
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column',
      transition: 'all 0.25s ease-in-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5,
          background: `${accentColor}22`,
          border: `1.5px solid ${accentColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: isDark ? `${accentColor}dd` : accentColor,
        }}>
          {title}
        </span>
        {devices.length > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: 9.5, fontWeight: 700,
            color: isDark ? '#475569' : '#94a3b8',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {(() => {
              const total = devices.reduce((s, d) => s + (d.latest?.power_w ?? 0), 0);
              const fmt = fmtPower(total / 1000);
              return `${fmt.valueStr} ${fmt.unit}`;
            })()}
          </span>
        )}
      </div>

      {/* Content — flex-grow so both columns equal height */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {devices.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3, padding: '6px 0',
          }}>
            {fallbackKw !== undefined && (
              <span style={{
                fontSize: 20, fontWeight: 800, lineHeight: 1,
                color: hasFallbackPower ? accentColor : isDark ? '#334155' : '#94a3b8',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}>
                {(() => { const f = fmtPower(fallbackKw ?? 0); return `${f.valueStr}`; })()}
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75, marginLeft: 3 }}>
                  {(() => { const f = fmtPower(fallbackKw ?? 0); return f.unit; })()}
                </span>
              </span>
            )}
            <span style={{
              fontSize: 8.5, color: isDark ? '#475569' : '#94a3b8',
              letterSpacing: '0.04em', textAlign: 'center',
            }}>
              {fallbackLabel ?? 'No devices registered'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {devices.map(device => {
              const sdKw = (device.latest?.power_w ?? 0) / 1000;
              const sdFmt = fmtPower(sdKw);
              const sdActive = device.is_active && sdKw > 0.001;
              return (
                <SmartCard
                  key={device.id}
                  label={device.display_name}
                  icon={applIcon(device.appliance_label, sdActive ? accentColor : isDark ? '#1e293b' : '#e2e8f0')}
                  valueStr={sdFmt.valueStr}
                  unit={sdFmt.unit}
                  active={sdActive}
                  isAnomalous={device.is_active && device.latest === null}
                  isDark={isDark}
                  accentColor={accentColor}
                  onClick={() => onDeviceClick(device)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EnergyFlowBlock({
  pvKw, loadKw, gridKw, battKw, battSoc, smartDevices = [],
}: EnergyFlowBlockProps) {
  const { isDark } = useTheme();
  const uidRef = useRef('');
  if (!uidRef.current) uidRef.current = `efb-${Math.random().toString(36).slice(2, 8)}`;

  const [selectedDevice, setSelectedDevice] = useState<SmartDeviceNode | null>(null);
  const [readings] = useState<{ timestamp: string; power_w: number | null }[]>([]);
  const [readingsLoading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Derived state ────────────────────────────────────────────────────────
  const nonGridDevices  = smartDevices.filter(d => d.appliance_label !== 'grid');
  const solarLoads      = nonGridDevices.filter(d => circuitOf(d) === 'solar');
  const gridLoads       = nonGridDevices.filter(d => circuitOf(d) === 'grid');

  // Calculate power for each load type
  const solarLoadPowerKw = solarLoads.reduce((sum, d) => sum + ((d.latest?.power_w ?? 0) / 1000), 0);
  const gridLoadPowerKw  = gridLoads.reduce((sum, d) => sum + ((d.latest?.power_w ?? 0) / 1000), 0);
  const solarLoadActive = solarLoadPowerKw > 0.01;
  const gridLoadActive  = gridLoadPowerKw > 0.01;

  const pv   = pvKw   ?? 0;
  const load = loadKw ?? 0;
  const grid = gridKw ?? 0;
  const batt = battKw ?? 0;

  const isExporting   = grid < -0.01;
  const isImporting   = grid >  0.01;
  const isCharging    = batt < -0.01;
  const isDischarging = batt >  0.01;
  const pvActive      = pv   >  0.01;
  const loadActive    = load >  0.01;
  const gridActive    = Math.abs(grid) > 0.01;
  const battActive    = Math.abs(batt) > 0.01;
  const battPresent   = battActive || (battSoc ?? 0) > 0;
  const gridColor     = isExporting ? '#34d399' : '#60a5fa';

  const pvToHubActive   = pvActive;
  const hubToLoadActive = loadActive;
  const hubToGridActive = isExporting;
  const hubToBattActive = isCharging;

  const pvIntensity   = pvActive   ? Math.min(1, pv   / 10) : 0;
  const gridIntensity = gridActive ? Math.min(1, Math.abs(grid) / 10) : 0;
  const battIntensity = battActive ? Math.min(1, Math.abs(batt) / 10) : 0;
  const loadIntensity = loadActive ? Math.min(1, load / 10) : 0;

  const pvFmt   = fmtPower(pv);
  const battFmt = fmtPower(batt);
  const loadFmt = fmtPower(load);
  const gridFmt = fmtPower(grid);

  const anomalous = nonGridDevices
    .filter(d => d.is_active && d.latest === null)
    .map(d => d.display_name);

  // Background color for hub mask circle (must match container bg)
  const bgColor = isDark ? '#06090f' : '#ffffff';

  let statusText = 'System idle';
  if (pvActive && isExporting)       statusText = 'Solar surplus — exporting to grid';
  else if (pvActive && isImporting)  statusText = 'Solar + grid powering loads';
  else if (pvActive)                 statusText = 'Running on solar';
  else if (isImporting)              statusText = 'Grid supplying load';
  else if (isDischarging)            statusText = 'Battery discharging';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      style={{
        marginBottom: 16,
        borderRadius: 16,
        background: bgColor,
        border: `1px solid ${isDark ? 'rgba(99,102,241,0.14)' : '#e2e8f2'}`,
        boxShadow: isDark
          ? '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)'
          : '0 2px 20px rgba(0,0,0,0.07)',
        overflow: 'visible',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px 0',
      }}>
        <span style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: isDark ? '#4b5563' : '#9ca3af',
        }}>
          Energy Flow
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}
          />
          <span style={{
            fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#22c55e',
          }}>
            Live
          </span>
        </div>
      </div>

      {/* ── Anomaly banner ── */}
      {!bannerDismissed && anomalous.length > 0 && (
        <div style={{ padding: '8px 18px 0' }}>
          <AnomalyBanner
            anomalousDevices={anomalous}
            onDeviceClick={name => {
              const d = nonGridDevices.find(x => x.display_name === name);
              if (d) setSelectedDevice(d);
            }}
            onDismiss={() => setBannerDismissed(true)}
            isDark={isDark}
          />
        </div>
      )}

      {/* ── Diagram (fixed aspect-ratio box) ── */}
      <div style={{ padding: '10px 18px 0' }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingBottom: ASPECT_PAD,
          minWidth: 320,
        }}>
          <div style={{ position: 'absolute', inset: 0 }}>

            {/* SVG overlay — beams and tracks */}
            <svg
              viewBox={`0 0 ${VW} ${VH}`}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                overflow: 'visible',
              }}
            >
              <defs>
                {/* Multi-layer glow for dramatic beam effect */}
                <filter id="efglow" x="-150%" y="-150%" width="400%" height="400%">
                  <feGaussianBlur stdDeviation="2.8" result="blur1" />
                  <feGaussianBlur stdDeviation="6.2" result="blur2" />
                  <feGaussianBlur stdDeviation="10" result="blur3" />
                  <feMerge>
                    <feMergeNode in="blur3" opacity="0.35" />
                    <feMergeNode in="blur2" opacity="0.55" />
                    <feMergeNode in="blur1" opacity="0.75" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <pattern id="efgrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1"
                    fill={isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)'} />
                </pattern>
              </defs>

              {/* Dot grid */}
              <rect width={VW} height={VH} fill="url(#efgrid)" />

              {/* ── Track lines (resting, colored) ── */}
              <Track d={P.pvToHub}   color="#f59e0b" />
              <Track d={P.battToHub} color="#0ea5e9" />
              <Track d={P.hubToBatt} color="#0ea5e9" />
              <Track d={P.gridToHub} color={gridColor} />
              <Track d={P.hubToGrid} color="#34d399" />
              <Track d={P.hubToLoad} color="#f87171" />

              {/* ── Hub mask: opaque circle hides tracks at hub center ── */}
              <circle cx={N.hub.x} cy={N.hub.y} r={HUB_R} fill={bgColor} />

              {/* ── Animated beams (smart routing based on actual power flow) ── */}
              {/* Solar → Hub: intensity based on PV generation */}
              <Beam key="pv" d={P.pvToHub}   stroke="#f59e0b" active={pvToHubActive}              uid="pv"   speed={1.8} intensity={pvIntensity} />
              {/* Battery → Hub: intensity based on battery discharge */}
              <Beam key="bd" d={P.battToHub} stroke="#0ea5e9" active={battActive && isDischarging} uid="bd"   speed={1.7} intensity={battIntensity} />
              {/* Hub → Battery: intensity based on charge rate */}
              <Beam key="bc" d={P.hubToBatt} stroke="#0ea5e9" active={hubToBattActive}            uid="bc"   speed={1.4} intensity={battIntensity} />
              {/* Grid → Hub: intensity based on import */}
              <Beam key="gi" d={P.gridToHub} stroke="#60a5fa" active={gridActive && isImporting}   uid="gi"   speed={1.6} intensity={gridIntensity} />
              {/* Hub → Grid: intensity based on export (green) or import (blue) */}
              <Beam key="ge" d={P.hubToGrid} stroke="#34d399" active={hubToGridActive}            uid="ge"   speed={1.6} intensity={gridIntensity} />
              {/* Hub → Load: intensity based on total load */}
              <Beam key="ld" d={P.hubToLoad} stroke="#f87171" active={hubToLoadActive}            uid="ld"   speed={1.5} intensity={loadIntensity} />

            </svg>

            {/* ── Node cards ── */}

            <At cx={N.pv.x} cy={N.pv.y}>
              <NodeCard
                label="Solar PV"
                icon={<Sun size={22} color={pvActive ? '#f59e0b' : isDark ? '#1e293b' : '#e2e8f0'} />}
                valueStr={pvFmt.valueStr} unit={pvFmt.unit}
                color="#f59e0b" active={pvActive} isDark={isDark}
              />
            </At>

            <At cx={N.hub.x} cy={N.hub.y}>
              <HubNode isDark={isDark} />
            </At>

            <At cx={N.batt.x} cy={N.batt.y}>
              <NodeCard
                label="Battery"
                icon={<Battery size={22} color={battPresent ? '#0ea5e9' : isDark ? '#1e293b' : '#e2e8f0'} />}
                valueStr={battFmt.valueStr} unit={battFmt.unit}
                color="#0ea5e9" active={battPresent}
                subLabel={(battSoc ?? 0) > 0
                  ? `${Math.round(battSoc ?? 0)}%${isCharging ? ' ↑' : isDischarging ? ' ↓' : ''}`
                  : undefined}
                isDark={isDark}
              />
            </At>

            <At cx={N.grid.x} cy={N.grid.y}>
              <NodeCard
                label="Grid"
                icon={<Zap size={22} color={gridActive ? gridColor : isDark ? '#1e293b' : '#e2e8f0'} />}
                valueStr={gridFmt.valueStr} unit={gridFmt.unit}
                color={gridColor} active={gridActive}
                subLabel={isExporting ? '↑ Selling' : isImporting ? '↓ Buying' : undefined}
                isDark={isDark}
              />
            </At>

          </div>
        </div>
      </div>

      {/* ── Total Load node + Y-connector + Sub-load columns ── */}
      <div style={{ padding: '0 18px 0', marginTop: -10 }}>

        {/* Total Load NodeCard — centered, pulled up into diagram bottom */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
          <NodeCard
            label="Total Load"
            icon={<Home size={22} color={loadActive ? '#f87171' : isDark ? '#1e293b' : '#e2e8f0'} />}
            valueStr={loadFmt.valueStr} unit={loadFmt.unit}
            color="#f87171" active={loadActive} isDark={isDark}
          />
        </div>

        {/* Y-connector: Total Load → Solar Load | Non Solar Load */}
        <svg width="100%" height="44" viewBox="0 0 200 44"
          style={{ display: 'block', overflow: 'visible' }}
          preserveAspectRatio="none">
          <defs>
            <filter id="yc-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.8" result="b" />
              <feMerge>
                <feMergeNode in="b" opacity="0.4" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Resting tracks — subtle background guide */}
          <line x1="100" y1="0"  x2="100" y2="22" stroke="#f87171" strokeWidth="1.5" strokeOpacity={0.25} />
          <line x1="50"  y1="22" x2="150" y2="22" stroke="#f87171" strokeWidth="1.2" strokeOpacity={0.18} />
          <line x1="50"  y1="22" x2="50"  y2="44" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity={0.25} />
          <line x1="150" y1="22" x2="150" y2="44" stroke="#60a5fa" strokeWidth="1.5" strokeOpacity={0.25} />

          {loadActive && (
            <>
              {/* Center vertical glow — intensity-responsive */}
              <line x1="100" y1="0" x2="100" y2="22"
                stroke="#f87171" strokeWidth="4.5" strokeLinecap="round"
                opacity={0.12 + loadIntensity * 0.08} />
              {/* Center vertical animated beam — speed responsive to load */}
              <motion.line x1="100" y1="0" x2="100" y2="22"
                stroke="#f87171" strokeWidth={2.5 + loadIntensity * 0.8} strokeLinecap="round"
                strokeDasharray="5 4"
                filter="url(#yc-glow)"
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -9 * 1200 }}
                transition={{ duration: 0.45 * 1200 * (0.6 + loadIntensity * 0.4), ease: 'linear' }}
              />
              {/* Left branch (Solar Load) glow */}
              {solarLoadActive && (
                <line x1="50" y1="22" x2="50" y2="44"
                  stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round"
                  opacity={0.12 + (solarLoadPowerKw / (Math.max(solarLoadPowerKw, gridLoadPowerKw) || 1)) * 0.12} />
              )}
              {/* Left branch (Solar Load) animated beam — intensity-responsive */}
              {solarLoadActive && (
                <motion.line x1="50" y1="22" x2="50" y2="44"
                  stroke="#f59e0b" strokeWidth={2.5 + (solarLoadPowerKw / 10) * 0.8} strokeLinecap="round"
                  strokeDasharray="5 4"
                  filter="url(#yc-glow)"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -9 * 1200 }}
                  transition={{ duration: 0.45 * 1200 * (0.6 + Math.min(1, solarLoadPowerKw / 10) * 0.4), ease: 'linear' }}
                />
              )}
              {/* Right branch (Grid Load) glow */}
              {gridLoadActive && (
                <line x1="150" y1="22" x2="150" y2="44"
                  stroke="#60a5fa" strokeWidth="4.5" strokeLinecap="round"
                  opacity={0.12 + (gridLoadPowerKw / (Math.max(solarLoadPowerKw, gridLoadPowerKw) || 1)) * 0.12} />
              )}
              {/* Right branch (Grid Load) animated beam — intensity-responsive */}
              {gridLoadActive && (
                <motion.line x1="150" y1="22" x2="150" y2="44"
                  stroke="#60a5fa" strokeWidth={2.5 + (gridLoadPowerKw / 10) * 0.8} strokeLinecap="round"
                  strokeDasharray="5 4"
                  filter="url(#yc-glow)"
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: -9 * 1200 }}
                  transition={{ duration: 0.45 * 1200 * (0.6 + Math.min(1, gridLoadPowerKw / 10) * 0.4), ease: 'linear' }}
                />
              )}
            </>
          )}
        </svg>

        {/* Sub-load columns — equal height via alignItems: stretch */}
        <div style={{
          display: 'flex', gap: 10,
          alignItems: 'stretch',
          paddingBottom: 14,
        }}>
          <SubSection
            title="Solar Load"
            icon={<Sun size={11} color="#f59e0b" />}
            accentColor="#f59e0b"
            devices={solarLoads}
            isDark={isDark}
            onDeviceClick={setSelectedDevice}
            fallbackKw={pv}
            fallbackLabel="Solar Generation"
          />
          <SubSection
            title="Non Solar Load"
            icon={<Grid size={11} color="#60a5fa" />}
            accentColor="#60a5fa"
            devices={gridLoads}
            isDark={isDark}
            onDeviceClick={setSelectedDevice}
            fallbackKw={Math.abs(grid)}
            fallbackLabel={isImporting ? 'Grid Import' : isExporting ? 'Grid Export' : 'Grid'}
          />
        </div>
      </div>

      {/* ── Status row ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 18px 12px',
        borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.07)' : '#f1f5f9'}`,
      }}>
        <span style={{ fontSize: 10, color: isDark ? '#374151' : '#9ca3af' }}>{statusText}</span>
        <span style={{
          fontSize: 9.5, color: isDark ? '#1f2937' : '#d1d5db',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>


      {/* ── Detail panel ── */}
      <DeviceDetailPanel
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        isDark={isDark}
        readings={readings}
        readingsLoading={readingsLoading}
      />
    </motion.div>
  );
}
