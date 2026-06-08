import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Battery, Home, Zap, Wind, Droplets, Waves, Plug, Activity, Grid, Car } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { NodeCard, SmartCard } from './DeviceCard';
import AnomalyBanner from './AnomalyBanner';
import NodeDetailModal, { NodeData, NodeType } from './NodeDetailModal';
import { EnergyFlowBlockProps, SmartDeviceNode, ApplianceLabel } from './types';
import { apiService, CtMeterReading } from '../../../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Beam animation: motion.linearGradient sweeps a narrow light window along
// each path in SVG userSpaceOnUse coordinates. All gradient defs live in the
// top-level SVG <defs> so they are in scope before any path references them.
// ─────────────────────────────────────────────────────────────────────────────

// Cross topology: Gateway hub at centre, Battery above, Solar left, Grid right, Load below.
const VW  = 700;
const HUB_R    = 38;
const NODE_R   = 65;
const BATT_TRIM = 36;

function trimEnd(x1: number, y1: number, x2: number, y2: number, trim: number) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const t = Math.max(0, (dist - trim) / dist);
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

function trimStart(x1: number, y1: number, x2: number, y2: number, trim: number) {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const t = Math.min(1, trim / dist);
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

const bez = (x1: number, y1: number, x2: number, y2: number) =>
  `M ${x1} ${y1} L ${x2} ${y2}`;

function hubPath(
  sx: number, sy: number,
  direction: 'toHub' | 'fromHub',
  hub: { x: number; y: number },
  srcTrim = 52,
  hubTrim = HUB_R,
) {
  if (direction === 'toHub') {
    const s = trimStart(sx, sy, hub.x, hub.y, srcTrim);
    const e = trimEnd(sx, sy, hub.x, hub.y, hubTrim);
    return bez(s.x, s.y, e.x, e.y);
  }
  const s = trimStart(hub.x, hub.y, sx, sy, hubTrim);
  const e = trimEnd(hub.x, hub.y, sx, sy, srcTrim);
  return bez(s.x, s.y, e.x, e.y);
}

type NodePos = { x: number; y: number };

function computeLayout(vh: number, nodes: { pv: NodePos; hub: NodePos; batt: NodePos; grid: NodePos }) {
  const { pv, hub, batt, grid } = nodes;
  return {
    VH: vh,
    N: nodes,
    ASPECT_PAD: `${(vh / VW) * 100}%`,
    P: {
      pvToHub:   hubPath(pv.x,   pv.y,   'toHub',   hub, NODE_R),
      battToHub: hubPath(batt.x, batt.y, 'toHub',   hub, BATT_TRIM),
      hubToBatt: hubPath(batt.x, batt.y, 'fromHub', hub, BATT_TRIM),
      gridToHub: hubPath(grid.x, grid.y, 'toHub',   hub, NODE_R),
      hubToGrid: hubPath(grid.x, grid.y, 'fromHub', hub, NODE_R),
      hubToLoad: `M ${hub.x} ${hub.y + HUB_R} L ${hub.x} ${vh}`,
    },
  };
}

// Wide layout — desktop / tablet (container ≥ 480 px)
const WIDE_LAYOUT = computeLayout(240, {
  pv:   { x: 90,  y: 125 },
  hub:  { x: 350, y: 125 },
  batt: { x: 350, y: 32  },
  grid: { x: 610, y: 125 },
});

// Narrow layout — mobile (container < 480 px).
// Taller viewBox (320 vs 240) and battery repositioned to y=80 so the node
// card clears the container top even at the reduced mobile scale.
const NARROW_LAYOUT = computeLayout(320, {
  pv:   { x: 90,  y: 200 },
  hub:  { x: 350, y: 200 },
  batt: { x: 350, y: 45  },
  grid: { x: 610, y: 200 },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtPower = (kw: number) =>
  Math.abs(kw) >= 1
    ? { valueStr: Math.abs(kw).toFixed(2), unit: 'kW' }
    : { valueStr: (Math.abs(kw) * 1000).toFixed(0), unit: 'W' };

const applIcon = (label: ApplianceLabel, color: string, size = 15) => {
  const p = { size, color };
  switch (label) {
    case 'ev_charger':      return <Car {...p} />;
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

// ── SVG beam primitives ───────────────────────────────────────────────────────

// Track: always-visible dim guide line
function Track({ d, color }: { d: string; color: string }) {
  return <path d={d} stroke={color} strokeWidth={2} strokeOpacity={0.22} fill="none" strokeLinecap="round" />;
}

// Flowing dashed-line beam — no particles, no blinking.
// Animates stroke-dashoffset directly (avoids Framer Motion pathLength/Chrome bug)
// by using a CSS animation string injected once per unique color.
function Beam({ d, color, active, speed = 1.6, intensity = 0.5 }: {
  d: string; color: string; active: boolean; glowId?: string; speed?: number; intensity?: number;
}) {
  if (!active) return null;
  const glowOpacity = Math.min(0.18, 0.07 + intensity * 0.11);
  // Dash pattern: visible dash length, gap length (total = 20px)
  const dash = 10;
  const gap  = 10;
  const dur  = (speed * (1.2 + intensity * 0.3) * 1.5).toFixed(2); // slower than before
  const animId = `flow-${color.replace('#', '')}`;
  return (
    <g>
      {/* Inject keyframe once per color via a <style> node */}
      <style>{`@keyframes ${animId}{from{stroke-dashoffset:0}to{stroke-dashoffset:-${dash + gap}}}`}</style>
      {/* Soft outer glow */}
      <path d={d} stroke={color} strokeWidth={12} strokeOpacity={glowOpacity} fill="none" strokeLinecap="round" />
      {/* Flowing dashed line */}
      <path
        d={d}
        stroke={color}
        strokeWidth={2.5}
        strokeOpacity={0.85}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ animation: `${animId} ${dur}s linear infinite` }}
      />
    </g>
  );
}

function At({ cx, cy, scale = 1, vw, vh, children }: {
  cx: number; cy: number; scale?: number; vw: number; vh: number; children: React.ReactNode;
}) {
  // Outer div is 0×0 positioned at the node coordinate — zero DOM footprint.
  // Inner div centers content around that anchor and scales it visually.
  // Keeping centering and scaling in separate transforms avoids the
  // zoom+translate(%) ambiguity where % resolution differs across browsers.
  return (
    <div style={{
      position: 'absolute',
      left: `${(cx / vw) * 100}%`,
      top: `${(cy / vh) * 100}%`,
      width: 0,
      height: 0,
      overflow: 'visible',
      zIndex: 2,
    }}>
      <div style={{
        display: 'inline-block',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
      }}>
        {children}
      </div>
    </div>
  );
}

function HubNode({ isDark }: { isDark: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <motion.div
        animate={{ boxShadow: [
          '0 0 16px rgba(99,102,241,0.28), 0 0 32px rgba(99,102,241,0.12)',
          '0 0 32px rgba(99,102,241,0.65), 0 0 56px rgba(99,102,241,0.25)',
          '0 0 16px rgba(99,102,241,0.28), 0 0 32px rgba(99,102,241,0.12)',
        ]}}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 64, height: 64, borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 35% 35%, rgba(99,102,241,0.5) 0%, #0d1117 100%)'
            : 'radial-gradient(circle at 35% 35%, rgba(99,102,241,0.24) 0%, #f8f9ff 100%)',
          border: `2.5px solid ${isDark ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.38)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 1,
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
        <Activity size={22} color="#818cf8" />
      </motion.div>
      <span style={{
        fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: isDark ? '#6366f1' : '#4f46e5',
      }}>Gateway</span>
    </div>
  );
}

interface SubSectionProps {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  devices: SmartDeviceNode[];
  isDark: boolean;
  onDeviceClick: (d: SmartDeviceNode) => void;
  emptyTitle: string;
  emptyDesc: string;
  ctTotalKw?: number;
  onCtHeaderClick?: () => void;
}

// Helper to convert device to comprehensive NodeData
function createDeviceNodeData(device: SmartDeviceNode, accentColor: string): NodeData {
  const sdKw = (device.latest?.power_w ?? 0) / 1000;
  const deviceName = device.display_name.split(' — ')[0];
  const sdActive = device.is_active && sdKw > 0.001;

  return {
    type: 'device',
    id: `device-${device.id}`,
    title: deviceName,
    subtitle: 'Smart Device',
    power_kw: sdKw,
    status: sdActive ? 'active' : 'inactive',
    color: accentColor,
    icon: applIcon(device.appliance_label, accentColor),
    device,
    // Comprehensive data
    current_a: device.latest?.current_a ?? undefined,
    voltage_v: device.latest?.voltage_v ?? undefined,
    energy_kwh: device.latest?.energy_kwh ?? undefined,
    timestamp: device.latest?.timestamp ?? undefined,
    deviceType: device.device_type,
    circuit: device.circuit,
  };
}

// ── Empty state placeholder ────────────────────────────────────────────────────

function EmptyPlaceholder({ title, desc, accent, isDark }: {
  title: string; desc: string; accent: string; isDark: boolean;
}) {
  return (
    <div style={{
      border: `1.5px dashed ${accent}38`,
      borderRadius: 8,
      padding: '12px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      textAlign: 'center',
    }}>
      <Plug size={14} color={`${accent}70`} />
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color: isDark ? `${accent}cc` : accent }}>
        {title}
      </div>
      <div style={{ fontSize: 8, color: isDark ? 'rgba(148,163,184,0.65)' : '#94a3b8', lineHeight: 1.5, maxWidth: 160 }}>
        {desc}
      </div>
    </div>
  );
}

// ── Sub-section ────────────────────────────────────────────────────────────────

function SubSection({ title, icon, accentColor, devices, isDark, onDeviceClick,
                      emptyTitle, emptyDesc, ctTotalKw, onCtHeaderClick }: SubSectionProps) {
  const devicesTotalKw = devices.reduce((s, d) => s + (d.latest?.power_w ?? 0), 0) / 1000;
  const hasCtTotal = ctTotalKw != null;

  // Header power: CT meter is authoritative for grid load; device sum for solar load
  const headerKw = hasCtTotal ? ctTotalKw : (devices.length > 0 ? devicesTotalKw : null);
  const headerFmt = headerKw != null ? fmtPower(headerKw) : null;

  return (
    <div style={{
      borderRadius: 12,
      border: `1.5px solid ${isDark ? `${accentColor}34` : `${accentColor}38`}`,
      background: isDark
        ? `linear-gradient(135deg, ${accentColor}14 0%, ${accentColor}07 100%)`
        : `linear-gradient(135deg, ${accentColor}13 0%, ${accentColor}06 100%)`,
      boxShadow: `0 0 20px ${accentColor}08, 0 2px 8px rgba(0,0,0,0.08)`,
      padding: '10px 12px 12px', flex: '1 1 180px', minWidth: 0,
      display: 'flex', flexDirection: 'column', transition: 'all 0.25s ease-in-out',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5, background: `${accentColor}22`,
          border: `1.5px solid ${accentColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{icon}</div>
        <span style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: isDark ? `${accentColor}dd` : accentColor,
        }}>{title}</span>
        {headerFmt && (
          <span
            onClick={hasCtTotal && onCtHeaderClick ? onCtHeaderClick : undefined}
            style={{
              marginLeft: 'auto', fontSize: 9.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: isDark ? '#cbd5e1' : '#64748b',
              cursor: hasCtTotal && onCtHeaderClick ? 'pointer' : 'default',
              display: 'flex', alignItems: 'baseline', gap: 3,
            }}
          >
            {headerFmt.valueStr} {headerFmt.unit}
            {hasCtTotal && (
              <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: accentColor, opacity: 0.8 }}>
                CT
              </span>
            )}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Grid load with CT total but no smart devices */}
        {devices.length === 0 && hasCtTotal && (
          <>
            <div
              onClick={onCtHeaderClick}
              style={{
                cursor: 'pointer',
                background: isDark ? `${accentColor}12` : `${accentColor}0e`,
                border: `1px solid ${accentColor}30`,
                borderRadius: 8, padding: '9px 11px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? `${accentColor}20` : `${accentColor}18`)}
              onMouseLeave={e => (e.currentTarget.style.background = isDark ? `${accentColor}12` : `${accentColor}0e`)}
            >
              <div>
                <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: accentColor, marginBottom: 2 }}>
                  CT Meter · Total Load
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {(() => { const f = fmtPower(ctTotalKw!); return `${f.valueStr} ${f.unit}`; })()}
                </div>
              </div>
              <div style={{ fontSize: 7.5, color: isDark ? 'rgba(148,163,184,0.5)' : '#94a3b8' }}>
                3-Phase ›
              </div>
            </div>
            <EmptyPlaceholder title={emptyTitle} desc={emptyDesc} accent={accentColor} isDark={isDark} />
          </>
        )}

        {/* No devices, no CT — pure placeholder */}
        {devices.length === 0 && !hasCtTotal && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyPlaceholder title={emptyTitle} desc={emptyDesc} accent={accentColor} isDark={isDark} />
          </div>
        )}

        {/* Smart device cards */}
        {devices.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {devices.map(device => {
              const sdKw = (device.latest?.power_w ?? 0) / 1000;
              const sdFmt = fmtPower(sdKw);
              const sdActive = device.is_active && sdKw > 0.001;
              const deviceName = device.display_name.split(' — ')[0];
              const deviceColor = sdActive ? accentColor : isDark ? '#cbd5e1' : '#9ca3af';
              return (
                <SmartCard
                  key={device.id} label={deviceName}
                  icon={applIcon(device.appliance_label, deviceColor)}
                  valueStr={sdFmt.valueStr} unit={sdFmt.unit}
                  active={sdActive} isAnomalous={device.is_active && device.latest === null}
                  isDark={isDark} accentColor={accentColor}
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
export default function EnergyFlowBlock({ pvKw, loadKw, gridKw, battKw, battSoc, smartDevices = [], siteId }: EnergyFlowBlockProps) {
  const { isDark } = useTheme();
  const uidRef = useRef('');
  if (!uidRef.current) uidRef.current = `efb-${Math.random().toString(36).slice(2, 8)}`;

  // Track container width to switch between wide and narrow layouts and to
  // scale node cards, the Total Load card, and SubSection proportionally.
  const diagramRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [nodeScale, setNodeScale] = useState(1);
  useEffect(() => {
    const el = diagramRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setContainerWidth(w);
      // Narrower divisor on mobile so nodes shrink enough to clear edges
      setNodeScale(Math.min(1, Math.max(0.55, w / 540)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { VH, N, P, ASPECT_PAD } = containerWidth < 480 ? NARROW_LAYOUT : WIDE_LAYOUT;

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [ctReading, setCtReading] = useState<CtMeterReading | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const fetch = async () => {
      const data = await apiService.getLatestEnergyMeter(siteId);
      if (!cancelled) setCtReading(data);
    };
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [siteId]);

  const nonGridDevices  = smartDevices.filter(d => d.appliance_label !== 'grid');
  const solarLoads      = nonGridDevices.filter(d => circuitOf(d) === 'solar');
  const gridLoads       = nonGridDevices.filter(d => circuitOf(d) === 'grid');
  const solarLoadPowerKw = solarLoads.reduce((s, d) => s + ((d.latest?.power_w ?? 0) / 1000), 0);
  const gridLoadPowerKw  = gridLoads.reduce((s, d) => s + ((d.latest?.power_w ?? 0) / 1000), 0);
  const solarLoadActive  = solarLoadPowerKw > 0.01;
  const gridLoadActive   = gridLoadPowerKw  > 0.01;

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

  const pvIntensity   = pvActive   ? Math.min(1, pv   / 10) : 0;
  const gridIntensity = gridActive ? Math.min(1, Math.abs(grid) / 10) : 0;
  const battIntensity = battActive ? Math.min(1, Math.abs(batt) / 10) : 0;
  const loadIntensity = loadActive ? Math.min(1, load / 10) : 0;

  const pvFmt   = fmtPower(pv);
  const battFmt = fmtPower(batt);
  const loadFmt = fmtPower(load);
  const gridFmt = fmtPower(grid);

  const anomalous = nonGridDevices.filter(d => d.is_active && d.latest === null).map(d => d.display_name);
  const bgColor   = isDark ? '#06090f' : '#ffffff';

  const handleNodeClick = (nodeData: NodeData) => {
    setSelectedNode(nodeData);
  };

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
        marginBottom: 16, borderRadius: 16, background: bgColor,
        border: `1px solid ${isDark ? 'rgba(99,102,241,0.14)' : '#e2e8f2'}`,
        boxShadow: isDark
          ? '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)'
          : '0 2px 20px rgba(0,0,0,0.07)',
        overflow: 'visible',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 0' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDark ? '#cbd5e1' : '#9ca3af' }}>
          Energy Flow
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}
          />
          <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#22c55e' }}>Live</span>
        </div>
      </div>

      {/* Anomaly banner */}
      {!bannerDismissed && anomalous.length > 0 && (
        <div style={{ padding: '8px 18px 0' }}>
          <AnomalyBanner
            anomalousDevices={anomalous}
            onDeviceClick={name => {
              const d = nonGridDevices.find(x => x.display_name === name);
              if (d) handleNodeClick(createDeviceNodeData(d, '#a78bfa'));
            }}
            onDismiss={() => setBannerDismissed(true)}
            isDark={isDark}
          />
        </div>
      )}

      {/* Diagram */}
      <div ref={diagramRef} style={{ padding: '10px 18px 0' }}>
        <div style={{ position: 'relative', width: '100%', paddingBottom: ASPECT_PAD }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <svg
              viewBox={`0 0 ${VW} ${VH}`}

              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                {/* Unique IDs per instance prevent filter collision when multiple EnergyFlow components coexist */}
                <filter id={`efglow-${uidRef.current}`} x="-150%" y="-150%" width="400%" height="400%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b1" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b2" />
                  <feMerge>
                    <feMergeNode in="b2" />
                    <feMergeNode in="b1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <pattern id={`efgrid-${uidRef.current}`} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill={isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)'} />
                </pattern>
              </defs>

              {/* Dot grid background */}
              <rect width={VW} height={VH} fill={`url(#efgrid-${uidRef.current})`} />


              {/* Hub mask */}
              <circle cx={N.hub.x} cy={N.hub.y} r={HUB_R} fill={bgColor} />

              {/* Animated beam pulses — glowId scoped per instance to avoid SVG filter collision */}
              <Beam d={P.pvToHub}   color="#f59e0b" active={pvActive}                   glowId={`efglow-${uidRef.current}`} intensity={pvIntensity} />
              <Beam d={P.battToHub} color="#0ea5e9" active={battActive && isDischarging} glowId={`efglow-${uidRef.current}`} intensity={battIntensity} />
              <Beam d={P.hubToBatt} color="#0ea5e9" active={isCharging}                  glowId={`efglow-${uidRef.current}`} intensity={battIntensity} />
              <Beam d={P.gridToHub} color="#60a5fa" active={gridActive && isImporting}   glowId={`efglow-${uidRef.current}`} intensity={gridIntensity} />
              <Beam d={P.hubToGrid} color="#34d399" active={isExporting}                 glowId={`efglow-${uidRef.current}`} intensity={gridIntensity} />
              <Beam d={P.hubToLoad} color="#f87171" active={loadActive}                  glowId={`efglow-${uidRef.current}`} intensity={loadIntensity} />
            </svg>

            {/* Node cards */}
            <At cx={N.pv.x} cy={N.pv.y} scale={nodeScale} vw={VW} vh={VH}>
              <div onClick={() => handleNodeClick({
                type: 'solar',
                id: 'solar',
                title: 'Solar PV',
                power_kw: pv,
                status: pvActive ? 'active' : 'inactive',
                color: '#f59e0b',
                icon: <Sun size={24} color="#f59e0b" />,
                details: {
                  'Generation': `${pvFmt.valueStr} ${pvFmt.unit}`,
                  'Status': pvActive ? 'Active' : 'Idle',
                },
              })} style={{ cursor: 'pointer' }}>
                <NodeCard label="Solar PV"
                  icon={<Sun size={22} color={pvActive ? '#f59e0b' : isDark ? '#cbd5e1' : '#cbd5e1'} />}
                  valueStr={pvFmt.valueStr} unit={pvFmt.unit}
                  color="#f59e0b" active={pvActive} isDark={isDark} />
              </div>
            </At>
            <At cx={N.hub.x} cy={N.hub.y} scale={nodeScale} vw={VW} vh={VH}><HubNode isDark={isDark} /></At>
            <At cx={N.batt.x} cy={N.batt.y} scale={nodeScale} vw={VW} vh={VH}>
              <div onClick={() => handleNodeClick({
                type: 'battery',
                id: 'battery',
                title: 'Battery',
                subtitle: isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle',
                power_kw: Math.abs(batt),
                status: battPresent ? 'active' : 'inactive',
                color: '#0ea5e9',
                icon: <Battery size={24} color="#0ea5e9" />,
                details: {
                  'Power Flow': `${battFmt.valueStr} ${battFmt.unit}`,
                  'Mode': isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle',
                  'State of Charge': `${Math.round(battSoc ?? 0)}%`,
                },
              })} style={{ cursor: 'pointer' }}>
                <NodeCard label="Battery"
                  icon={<Battery size={22} color={battPresent ? '#0ea5e9' : isDark ? '#cbd5e1' : '#cbd5e1'} />}
                  valueStr={battFmt.valueStr} unit={battFmt.unit}
                  color="#0ea5e9" active={battPresent}
                  subLabel={(battSoc ?? 0) > 0 ? `${Math.round(battSoc ?? 0)}%${isCharging ? ' ↑' : isDischarging ? ' ↓' : ''}` : undefined}
                  isDark={isDark} />
              </div>
            </At>
            <At cx={N.grid.x} cy={N.grid.y} scale={nodeScale} vw={VW} vh={VH}>
              <div onClick={() => handleNodeClick({
                type: 'grid',
                id: 'grid',
                title: 'Grid',
                subtitle: isExporting ? 'Exporting' : isImporting ? 'Importing' : 'Idle',
                power_kw: Math.abs(grid),
                status: gridActive ? 'active' : 'inactive',
                color: gridColor,
                icon: <Zap size={24} color={gridColor} />,
                details: {
                  'Power Flow': `${gridFmt.valueStr} ${gridFmt.unit}`,
                  'Direction': isExporting ? 'Export ↑' : isImporting ? 'Import ↓' : 'Idle',
                  'Mode': isExporting ? 'Selling' : isImporting ? 'Buying' : 'Idle',
                },
              })} style={{ cursor: 'pointer' }}>
                <NodeCard label="Grid"
                  icon={<Zap size={22} color={gridActive ? gridColor : isDark ? '#cbd5e1' : '#cbd5e1'} />}
                  valueStr={gridFmt.valueStr} unit={gridFmt.unit}
                  color={gridColor} active={gridActive}
                  subLabel={isExporting ? '↑ Selling' : isImporting ? '↓ Buying' : undefined}
                  isDark={isDark} />
              </div>
            </At>
          </div>
        </div>
      </div>

      {/* Total Load + Y-connector + Sub-loads */}
      <div style={{ padding: '0 18px 0', marginTop: -10 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
          <div style={{ display: 'inline-block', transform: `scale(${nodeScale})`, transformOrigin: 'top center', cursor: 'pointer' }} onClick={() => handleNodeClick({
            type: 'load',
            id: 'load',
            title: 'Total Load',
            power_kw: load,
            status: loadActive ? 'active' : 'inactive',
            color: '#f87171',
            icon: <Home size={24} color="#f87171" />,
            loadSplit: {
              solarKw: load,
              gridKw: ctReading ? Math.abs(ctReading.active_power_total ?? 0) / 1000 : 0,
            },
          })}>
            <NodeCard label="Total Load"
              icon={<Home size={22} color={loadActive ? '#f87171' : isDark ? '#cbd5e1' : '#cbd5e1'} />}
              valueStr={loadFmt.valueStr} unit={loadFmt.unit}
              color="#f87171" active={loadActive} isDark={isDark} />
          </div>
        </div>

        {/* Y-connector SVG — each branch animates only when that subsection has active power */}
        {(() => {
          const ctGridKw = ctReading ? Math.abs(ctReading.active_power_total ?? 0) / 1000 : 0;
          const solarBranchActive = solarLoadActive && solarLoads.length > 0;
          const gridBranchActive  = gridLoads.length > 0 ? gridLoadActive : ctGridKw > 0.01;
          const stemActive = solarBranchActive || gridBranchActive;
          return (
            <svg width="100%" height="44" viewBox="0 0 200 44"
              style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
              <style>{`
                @keyframes flow-f87171{from{stroke-dashoffset:0}to{stroke-dashoffset:-20}}
                @keyframes flow-f59e0b{from{stroke-dashoffset:0}to{stroke-dashoffset:-20}}
                @keyframes flow-60a5fa{from{stroke-dashoffset:0}to{stroke-dashoffset:-20}}
              `}</style>
              {/* Vertical stem from Total Load down to junction — always draw track, animate if any branch active */}
              <line x1="100" y1="0" x2="100" y2="22" stroke="#f87171" strokeWidth="10" strokeLinecap="round" strokeOpacity={0.06} />
              {stemActive && (
                <line x1="100" y1="0" x2="100" y2="22" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray="10 10" style={{ animation: 'flow-f87171 2.4s linear infinite' }} />
              )}
              {/* Solar Load branch (amber) */}
              <line x1="100" y1="22" x2="50" y2="22" stroke="#f59e0b" strokeWidth="10" strokeLinecap="round" strokeOpacity={0.06} />
              {solarBranchActive && (
                <line x1="100" y1="22" x2="50" y2="22" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray="10 10" style={{ animation: 'flow-f59e0b 2.4s linear infinite' }} />
              )}
              <line x1="50" y1="22" x2="50" y2="44" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" strokeOpacity={0.06} />
              {solarBranchActive && (
                <line x1="50" y1="22" x2="50" y2="44" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"
                  strokeDasharray="10 10" style={{ animation: 'flow-f59e0b 2.4s linear infinite' }} />
              )}
              {/* Grid Load branch (blue) */}
              <line x1="100" y1="22" x2="150" y2="22" stroke="#60a5fa" strokeWidth="10" strokeLinecap="round" strokeOpacity={0.06} />
              {gridBranchActive && (
                <line x1="100" y1="22" x2="150" y2="22" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"
                  strokeDasharray="10 10" style={{ animation: 'flow-60a5fa 2.4s linear infinite' }} />
              )}
              <line x1="150" y1="22" x2="150" y2="44" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" strokeOpacity={0.06} />
              {gridBranchActive && (
                <line x1="150" y1="22" x2="150" y2="44" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"
                  strokeDasharray="10 10" style={{ animation: 'flow-60a5fa 2.4s linear infinite' }} />
              )}
            </svg>
          );
        })()}

        <div style={{ display: 'flex', gap: 13, alignItems: 'stretch', paddingBottom: 14, flexWrap: 'wrap', transform: `scale(${nodeScale})`, transformOrigin: 'top center' }}>
          <SubSection
            title="Solar Load" icon={<Sun size={11} color="#f59e0b" />}
            accentColor="#f59e0b" devices={solarLoads} isDark={isDark}
            onDeviceClick={(device) => handleNodeClick(createDeviceNodeData(device, '#f59e0b'))}
            emptyTitle="No Solar Devices"
            emptyDesc="Assign smart plugs to the solar circuit to monitor individual loads"
          />
          <SubSection
            title="Grid Load" icon={<Grid size={11} color="#60a5fa" />}
            accentColor="#60a5fa" devices={gridLoads} isDark={isDark}
            onDeviceClick={(device) => handleNodeClick(createDeviceNodeData(device, '#60a5fa'))}
            emptyTitle="No Grid Devices"
            emptyDesc="Assign smart plugs to the grid circuit to monitor individual loads"
            ctTotalKw={ctReading ? Math.abs(ctReading.active_power_total ?? 0) / 1000 : undefined}
            onCtHeaderClick={() => ctReading && handleNodeClick({
              type: 'ctmeter',
              id: 'ctmeter',
              title: 'Grid Load · CT Meter',
              subtitle: '3-Phase Measurement',
              power_kw: Math.abs(ctReading.active_power_total ?? 0) / 1000,
              status: (Math.abs(ctReading.active_power_total ?? 0) / 1000) > 0.01 ? 'active' : 'inactive',
              color: '#60a5fa',
              icon: <Activity size={24} color="#60a5fa" />,
              details: {
                'Active Power': `${Math.abs(ctReading.active_power_total ?? 0).toFixed(1)} W`,
                'Apparent Power': `${Math.abs(ctReading.apparent_power_total ?? 0).toFixed(1)} VA`,
                'Power Factor': (ctReading.power_factor_total ?? 0).toFixed(3),
              },
              ctReading,
            })}
          />
        </div>
      </div>

      {/* Status row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 18px 12px', borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.07)' : '#f1f5f9'}`,
      }}>
        <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#9ca3af' }}>{statusText}</span>
        <span style={{ fontSize: 9.5, color: isDark ? '#cbd5e1' : '#d1d5db', fontVariantNumeric: 'tabular-nums' }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <NodeDetailModal
        node={selectedNode} onClose={() => setSelectedNode(null)}
        isDark={isDark} siteId={siteId}
      />
    </motion.div>
  );
}
