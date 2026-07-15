import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Battery, Home, Zap, Wind, Droplets, Waves, Plug, Activity, Grid, Car } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { NodeCard, SmartCard } from './DeviceCard';
import AnomalyBanner from './AnomalyBanner';
import NodeDetailModal, { NodeData } from './NodeDetailModal';
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
const NODE_R   = 85;
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

function ctActivePowerW(reading: CtMeterReading | null): number {
  if (!reading) return 0;
  const reported = reading.active_power_total;
  if (reported != null && Math.abs(reported) > 0.05) return reported;
  const phases = [reading.active_power_l1, reading.active_power_l2, reading.active_power_l3]
    .filter((v): v is number => v != null);
  if (!phases.length || phases.every(v => Math.abs(v) <= 0.05)) return reported ?? 0;
  return phases.reduce((sum, v) => sum + v, 0);
}

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
const WIDE_LAYOUT = computeLayout(362, {
  pv:   { x: 90,  y: 213 },
  hub:  { x: 350, y: 213 },
  batt: { x: 350, y: 42  },
  grid: { x: 610, y: 213 },
});

// Narrow layout — mobile (container < 480 px).
const NARROW_LAYOUT = computeLayout(350, {
  pv:   { x: 90,  y: 228 },
  hub:  { x: 350, y: 228 },
  batt: { x: 350, y: 43  },
  grid: { x: 610, y: 228 },
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

const GRID_APPLIANCES: ApplianceLabel[] = ['geyser', 'ac_unit', 'washing_machine'];
const circuitOf = (d: SmartDeviceNode): 'solar' | 'grid' =>
  d.circuit ?? (GRID_APPLIANCES.includes(d.appliance_label) ? 'grid' : 'solar');
const deviceLabel = (device: SmartDeviceNode) =>
  (device.display_name || `Device ${device.id}`).split(' — ')[0] || 'Smart device';
const isFreshReading = (timestamp?: string | null) =>
  !!timestamp && Date.now() - new Date(timestamp).getTime() <= 5 * 60 * 1000;
const freshLatest = (device: SmartDeviceNode) =>
  device.latest && isFreshReading(device.latest.timestamp) ? device.latest : null;

// ── SVG beam primitives ───────────────────────────────────────────────────────

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
        letterSpacing: '0.12em', color: 'var(--info)',
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
  compact?: boolean;
  ctTotalKw?: number;
  onCtHeaderClick?: () => void;
  inverterKw?: number;
  onInverterClick?: () => void;
  evTotalKw?: number;
  onEvClick?: () => void;
}

// Helper to convert device to comprehensive NodeData
function createDeviceNodeData(device: SmartDeviceNode, accentColor: string): NodeData {
  const latest = freshLatest(device);
  const sdKw = (latest?.power_w ?? 0) / 1000;
  const deviceName = deviceLabel(device);
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
    current_a: latest?.current_a ?? undefined,
    voltage_v: latest?.voltage_v ?? undefined,
    energy_kwh: latest?.energy_kwh ?? undefined,
    timestamp: latest?.timestamp ?? undefined,
    deviceType: device.device_type,
    circuit: device.circuit,
  };
}

function EmptyPlaceholder({ isDark, branchLabel }: { isDark: boolean; branchLabel?: string }) {
  const label = branchLabel ? `No devices on ${branchLabel}` : 'No devices reporting on this branch';
  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px dashed ${isDark ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.30)'}`,
        padding: '9px 14px',
        background: isDark ? 'rgba(15,23,42,0.15)' : 'rgba(248,250,252,0.7)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ position: 'relative', flexShrink: 0, width: 8, height: 8 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.4)',
          animation: 'emptyPulse 2.4s ease-in-out infinite',
        }} />
        <span style={{
          position: 'absolute', inset: 2, borderRadius: '50%',
          background: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.6)',
        }} />
      </span>
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 500,
        color: isDark ? 'rgba(148,163,184,0.65)' : 'rgba(100,116,139,0.8)',
        letterSpacing: '0.01em',
      }}>
        {label}
      </span>
      <style>{`
        @keyframes emptyPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-section ────────────────────────────────────────────────────────────────

function SubSection({ title, icon, accentColor, devices, isDark, onDeviceClick,
                      compact = false,
                      ctTotalKw, onCtHeaderClick,
                      inverterKw, onInverterClick,
                      evTotalKw, onEvClick }: SubSectionProps) {
  const devicesTotalKw = devices.reduce((s, d) => s + (freshLatest(d)?.power_w ?? 0), 0) / 1000;
  const hasCtTotal = ctTotalKw != null;
  const hasInverter = inverterKw != null;
  const hasEvCard = evTotalKw != null;
  const hasContent = hasCtTotal || hasInverter || hasEvCard || devices.length > 0;

  // Header power: CT/Inverter/EV is authoritative if present; otherwise device sum
  const headerKw = hasCtTotal ? ctTotalKw : hasInverter ? inverterKw : hasEvCard ? evTotalKw : (devices.length > 0 ? devicesTotalKw : null);
  const headerFmt = headerKw != null ? fmtPower(headerKw) : null;

  // ── Item card helper ──────────────────────────────────────────────────────
  const ItemCard = ({ label, valueFmt, chevron, onClick: oc }: {
    label: string; valueFmt: string; chevron: string; onClick?: () => void;
  }) => (
    <div
      onClick={oc}
      role={oc ? 'button' : undefined}
      style={{
        cursor: oc ? 'pointer' : 'default',
        background: isDark ? `${accentColor}0d` : `${accentColor}09`,
        border: `1px solid ${isDark ? `${accentColor}28` : `${accentColor}30`}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: compact ? 7 : 8,
        padding: compact ? '7px 8px 7px 10px' : '9px 10px 9px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        transition: 'background 0.14s',
        minHeight: compact ? 44 : 52,
      }}
      onMouseEnter={e => { if (oc) (e.currentTarget as HTMLElement).style.background = isDark ? `${accentColor}18` : `${accentColor}16`; }}
      onMouseLeave={e => { if (oc) (e.currentTarget as HTMLElement).style.background = isDark ? `${accentColor}0d` : `${accentColor}09`; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: compact ? 7.5 : 8, fontWeight: 800, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: accentColor, marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</div>
        <div style={{
          fontSize: compact ? 15 : 19, fontWeight: 900,
          color: 'var(--foreground)',
          letterSpacing: '-0.03em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>{valueFmt}</div>
      </div>
      {oc && <div style={{
        fontSize: compact ? 9 : 10, fontWeight: 600,
        color: isDark ? `${accentColor}80` : `${accentColor}90`,
        flexShrink: 0, letterSpacing: '0.02em',
      }}>{chevron}</div>}
    </div>
  );

  return (
    <div style={{
      borderRadius: compact ? 10 : 12,
      border: `1.5px solid ${isDark ? `${accentColor}30` : `${accentColor}38`}`,
      background: isDark
        ? `linear-gradient(160deg, ${accentColor}12 0%, ${accentColor}06 100%)`
        : `linear-gradient(160deg, ${accentColor}10 0%, ${accentColor}04 100%)`,
      boxShadow: `0 0 18px ${accentColor}0a, 0 2px 8px rgba(0,0,0,0.1)`,
      flex: '1 1 0', minWidth: 0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Header strip ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: compact ? '7px 9px 6px' : '9px 11px 8px',
        borderBottom: `1px solid ${isDark ? `${accentColor}1c` : `${accentColor}24`}`,
        background: isDark ? `${accentColor}0a` : `${accentColor}07`,
      }}>
        <div style={{
          width: compact ? 16 : 18, height: compact ? 16 : 18, borderRadius: 4,
          background: `${accentColor}22`, border: `1.5px solid ${accentColor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{icon}</div>
        <span style={{
          fontSize: compact ? 8.5 : 9, fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: isDark ? `${accentColor}e0` : accentColor,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</span>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: compact ? 5 : 7, padding: compact ? '7px 7px 8px' : '9px 9px 10px' }}>

        {/* Grid load with CT total */}
        {hasCtTotal && (
          <ItemCard
            label="Energy Meter · Grid"
            valueFmt={(() => { const f = fmtPower(ctTotalKw!); return `${f.valueStr} ${f.unit}`; })()}
            chevron="3-Phase ›"
            onClick={onCtHeaderClick}
          />
        )}

        {/* Solar load with Inverter total */}
        {hasInverter && (
          <ItemCard
            label="Inverter · AC Output"
            valueFmt={(() => { const f = fmtPower(inverterKw!); return `${f.valueStr} ${f.unit}`; })()}
            chevron="Detail ›"
            onClick={onInverterClick}
          />
        )}

        {/* EV charger summary card */}
        {hasEvCard && (
          <ItemCard
            label="EV Charger"
            valueFmt={(() => { const f = fmtPower(evTotalKw!); return `${f.valueStr} ${f.unit}`; })()}
            chevron={evTotalKw! > 0 ? 'Charging ›' : 'Idle ›'}
            onClick={onEvClick}
          />
        )}

        {/* Smart device cards */}
        {devices.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 6 : 8 }}>
            {devices.map(device => {
              const latest = freshLatest(device);
              const sdKw = (latest?.power_w ?? 0) / 1000;
              const sdFmt = fmtPower(sdKw);
              const sdActive = device.is_active && sdKw > 0.001;
              const deviceName = deviceLabel(device);
              const deviceColor = sdActive ? accentColor : isDark ? '#cbd5e1' : 'var(--text-dim)';
              return (
                <SmartCard
                  key={device.id} label={deviceName}
                  icon={applIcon(device.appliance_label, deviceColor)}
                  valueStr={sdFmt.valueStr} unit={sdFmt.unit}
                  active={sdActive} isAnomalous={device.is_active && device.latest === null}
                  isDark={isDark} accentColor={accentColor} compact={compact}
                  onClick={() => onDeviceClick(device)}
                />
              );
            })}
          </div>
        )}

        {!hasContent && <EmptyPlaceholder isDark={isDark} branchLabel={title} />}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EnergyFlowBlock({ pvKw, loadKw, gridKw, battKw, battSoc, smartDevices = [], siteId, inverterPhases }: EnergyFlowBlockProps) {
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
      setNodeScale(Math.min(1, Math.max(0.65, w / 480)));
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
      if (cancelled) return;
      // Discard readings older than 15 minutes — device is offline
      if (data?.timestamp) {
        const ageMs = Date.now() - new Date(data.timestamp).getTime();
        if (ageMs > 15 * 60 * 1000) { setCtReading(null); return; }
      }
      setCtReading(data);
    };
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [siteId]);

  const nonGridDevices  = smartDevices.filter(d => d.appliance_label !== 'grid');
  const evLoads         = nonGridDevices.filter(d => d.appliance_label === 'ev_charger');
  const solarLoads      = nonGridDevices.filter(d => d.appliance_label !== 'ev_charger' && circuitOf(d) === 'solar');
  const gridLoads       = nonGridDevices.filter(d => d.appliance_label !== 'ev_charger' && circuitOf(d) === 'grid');
  const evLoadPowerKw  = evLoads.reduce((s, d) => s + ((freshLatest(d)?.power_w ?? 0) / 1000), 0);
  const gridLoadPowerKw = gridLoads.reduce((s, d) => s + ((freshLatest(d)?.power_w ?? 0) / 1000), 0);
  const evLoadActive   = evLoadPowerKw  > 0;
  const gridLoadActive = gridLoadPowerKw > 0;

  const pv   = pvKw   ?? 0;
  const load = loadKw ?? 0;
  const grid = gridKw ?? 0;
  const batt = battKw ?? 0;

  const isExporting   = grid < 0;
  const isImporting   = grid > 0;
  const isCharging    = batt < 0;
  const isDischarging = batt > 0;
  const pvActive      = pv   > 0;
  const loadActive    = load > 0;
  const gridActive    = Math.abs(grid) > 0;
  const battActive    = Math.abs(batt) > 0;
  const battPresent   = battActive || (battSoc ?? 0) > 0;
  const gridColor     = isExporting ? '#34d399' : '#60a5fa';

  const pvIntensity   = pvActive   ? Math.min(1, pv   / 10) : 0;
  const gridIntensity = gridActive ? Math.min(1, Math.abs(grid) / 10) : 0;
  const battIntensity = battActive ? Math.min(1, Math.abs(batt) / 10) : 0;
  const loadIntensity = loadActive ? Math.min(1, load / 10) : 0;
  const compactFlow = containerWidth < 480;
  const branchStrokeWidth = compactFlow ? 2.2 : 2.5;
  const branchTrackWidth = compactFlow ? 6 : 10;
  const branchDash = compactFlow ? 8 : 10;
  const branchGap = compactFlow ? 8 : 10;
  const branchDur = compactFlow ? 2.1 : 2.4;
  const branchMidY = compactFlow ? 13 : 15;
  const branchEndY = compactFlow ? 24 : 31;

  const pvFmt   = fmtPower(pv);
  const battFmt = fmtPower(batt);

  const gridFmt = fmtPower(grid);

  const anomalous = nonGridDevices.filter(d => d.is_active && d.latest === null).map(deviceLabel);
  const bgColor   = 'var(--card)';

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
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDark ? '#cbd5e1' : 'var(--text-dim)' }}>
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
                  icon={<Sun size={22} color={pvActive ? '#f59e0b' : 'var(--muted-foreground)'} />}
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
                  icon={<Battery size={22} color={battPresent ? '#0ea5e9' : 'var(--muted-foreground)'} />}
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
                  icon={<Zap size={22} color={gridActive ? gridColor : 'var(--muted-foreground)'} />}
                  valueStr={gridFmt.valueStr} unit={gridFmt.unit}
                  color={gridColor} active={gridActive}
                  subLabel={isExporting ? '↑ Selling' : isImporting ? '↓ Buying' : undefined}
                  isDark={isDark} />
              </div>
            </At>
          </div>
        </div>
      </div>

      {/* Total Load + EV node (if present) + Y-connector + Sub-loads */}
      <div style={{ padding: '0 18px 0', marginTop: 0 }}>
        {(() => {
          const ctGridKw = Math.abs(ctActivePowerW(ctReading)) / 1000;
          const totalLoadKw = load + ctGridKw;
          const totalLoadFmt = fmtPower(totalLoadKw);
          const totalLoadActive = totalLoadKw > 0;
          return (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: `${-(1 - nodeScale) * 93}px` }}>
              <div style={{ display: 'inline-block', width: 108, transform: `scale(${nodeScale})`, transformOrigin: 'top center', cursor: 'pointer' }} onClick={() => handleNodeClick({
                type: 'load',
                id: 'load',
                title: 'Total Load',
                power_kw: totalLoadKw,
                status: totalLoadActive ? 'active' : 'inactive',
                color: '#f87171',
                icon: <Home size={24} color="#f87171" />,
                loadSplit: {
                  solarKw: load,
                  gridKw: ctGridKw,
                  evKw: evLoadPowerKw > 0 ? evLoadPowerKw : undefined,
                },
                evDevice: evLoads[0] ?? undefined,
                ctReading: ctReading ?? undefined,
                inverterPhases: inverterPhases ?? undefined,
              })}>
                <NodeCard label="Total Load"
                  icon={<Home size={22} color={totalLoadActive ? '#f87171' : 'var(--muted-foreground)'} />}
                  valueStr={totalLoadFmt.valueStr} unit={totalLoadFmt.unit}
                  color="#f87171" active={totalLoadActive} isDark={isDark} />
              </div>
            </div>
          );
        })()}

        {/* Y-connector — 3 branches when EV present, 2 branches otherwise */}
        {(() => {
          const ctGridKw = Math.abs(ctActivePowerW(ctReading)) / 1000;
          const solarBranchActive = load > 0;
          const gridBranchActive  = gridLoadActive || ctGridKw > 0;
          const evBranchActive    = evLoadActive;
          const hasEv             = evLoads.length > 0;
          const stemActive = solarBranchActive || gridBranchActive || evBranchActive;
          const solarX = hasEv ? 25  : 50;
          const gridX  = hasEv ? 175 : 150;
          return (
            <svg width="100%" height={branchEndY} viewBox={`0 0 200 ${branchEndY}`}
              style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
              <style>{`
                @keyframes flow-f87171{from{stroke-dashoffset:0}to{stroke-dashoffset:-${branchDash + branchGap}}}
                @keyframes flow-f59e0b{from{stroke-dashoffset:0}to{stroke-dashoffset:-${branchDash + branchGap}}}
                @keyframes flow-60a5fa{from{stroke-dashoffset:0}to{stroke-dashoffset:-${branchDash + branchGap}}}
                @keyframes flow-34d399{from{stroke-dashoffset:0}to{stroke-dashoffset:-${branchDash + branchGap}}}
              `}</style>
              {/* Stem */}
              <line x1="100" y1="0" x2="100" y2={branchMidY} stroke="#f87171" strokeWidth={branchTrackWidth} strokeLinecap="round" strokeOpacity={compactFlow ? 0.08 : 0.06} />
              {stemActive && (
                <line x1="100" y1="0" x2="100" y2={branchMidY} stroke="#f87171" strokeWidth={branchStrokeWidth} strokeLinecap="round"
                  strokeDasharray={`${branchDash} ${branchGap}`} style={{ animation: `flow-f87171 ${branchDur}s linear infinite` }} />
              )}
              {/* Solar branch (amber, left) */}
              <line x1="100" y1={branchMidY} x2={solarX} y2={branchMidY} stroke="#f59e0b" strokeWidth={branchTrackWidth} strokeLinecap="round" strokeOpacity={compactFlow ? 0.08 : 0.06} />
              {solarBranchActive && <line x1="100" y1={branchMidY} x2={solarX} y2={branchMidY} stroke="#f59e0b" strokeWidth={branchStrokeWidth} strokeLinecap="round" strokeDasharray={`${branchDash} ${branchGap}`} style={{ animation: `flow-f59e0b ${branchDur}s linear infinite` }} />}
              <line x1={solarX} y1={branchMidY} x2={solarX} y2={branchEndY} stroke="#f59e0b" strokeWidth={compactFlow ? 3 : 5} strokeLinecap="round" strokeOpacity={compactFlow ? 0.08 : 0.06} />
              {solarBranchActive && <line x1={solarX} y1={branchMidY} x2={solarX} y2={branchEndY} stroke="#f59e0b" strokeWidth={compactFlow ? 1.15 : 1.5} strokeLinecap="round" strokeDasharray={`${branchDash} ${branchGap}`} style={{ animation: `flow-f59e0b ${branchDur}s linear infinite` }} />}
              {/* EV branch (green, center) — only when EV device exists */}
              {hasEv && <>
                <line x1="100" y1={branchMidY} x2="100" y2={branchEndY} stroke="#34d399" strokeWidth={compactFlow ? 3 : 5} strokeLinecap="round" strokeOpacity={compactFlow ? 0.08 : 0.06} />
                {evBranchActive && <line x1="100" y1={branchMidY} x2="100" y2={branchEndY} stroke="#34d399" strokeWidth={compactFlow ? 1.15 : 1.5} strokeLinecap="round" strokeDasharray={`${branchDash} ${branchGap}`} style={{ animation: `flow-34d399 ${branchDur}s linear infinite` }} />}
              </>}
              {/* Grid branch (blue, right) */}
              <line x1="100" y1={branchMidY} x2={gridX} y2={branchMidY} stroke="#60a5fa" strokeWidth={branchTrackWidth} strokeLinecap="round" strokeOpacity={compactFlow ? 0.08 : 0.06} />
              {gridBranchActive && <line x1="100" y1={branchMidY} x2={gridX} y2={branchMidY} stroke="#60a5fa" strokeWidth={branchStrokeWidth} strokeLinecap="round" strokeDasharray={`${branchDash} ${branchGap}`} style={{ animation: `flow-60a5fa ${branchDur}s linear infinite` }} />}
              <line x1={gridX} y1={branchMidY} x2={gridX} y2={branchEndY} stroke="#60a5fa" strokeWidth={compactFlow ? 3 : 5} strokeLinecap="round" strokeOpacity={compactFlow ? 0.08 : 0.06} />
              {gridBranchActive && <line x1={gridX} y1={branchMidY} x2={gridX} y2={branchEndY} stroke="#60a5fa" strokeWidth={compactFlow ? 1.15 : 1.5} strokeLinecap="round" strokeDasharray={`${branchDash} ${branchGap}`} style={{ animation: `flow-60a5fa ${branchDur}s linear infinite` }} />}
            </svg>
          );
        })()}

        {/* Sub-load row: Solar SubSection | EV NodeCard | Grid SubSection */}
        <div style={{ display: 'flex', gap: compactFlow ? 8 : 10, alignItems: 'stretch', paddingBottom: 14, marginTop: 0 }}>
          <SubSection
            title="Solar Load" icon={<Sun size={11} color="#f59e0b" />}
            accentColor="#f59e0b" devices={solarLoads} isDark={isDark}
            compact={compactFlow}
            onDeviceClick={(device) => handleNodeClick(createDeviceNodeData(device, '#f59e0b'))}
            inverterKw={load > 0 ? load : undefined}
            onInverterClick={() => handleNodeClick({
              type: 'solar',
              id: 'inverter-load',
              title: 'Inverter · Solar Load',
              subtitle: 'AC Output',
              power_kw: load,
              status: load > 0 ? 'active' : 'inactive',
              color: '#f59e0b',
              icon: <Sun size={24} color="#f59e0b" />,
              details: {
                'Solar Load': `${fmtPower(load).valueStr} ${fmtPower(load).unit}`,
                'PV Generation': `${fmtPower(pv).valueStr} ${fmtPower(pv).unit}`,
                'Self-consumption': pv > 0 ? `${Math.min(100, Math.round((load / pv) * 100))}%` : '—',
                'Status': load > 0 ? 'Active' : 'Idle',
              },
              inverterPhases: inverterPhases ?? undefined,
            })}
          />

          {evLoads.length > 0 && (
            <SubSection
              title="EV Charging" icon={<Car size={11} color="#34d399" />}
              accentColor="#34d399" devices={[]} isDark={isDark}
              compact={compactFlow}
              onDeviceClick={(device) => handleNodeClick(createDeviceNodeData(device, '#34d399'))}
              evTotalKw={evLoadPowerKw}
              onEvClick={() => evLoads[0] && handleNodeClick({
                type: 'device',
                id: String(evLoads[0].id),
                title: evLoads[0].display_name ?? 'EV Charger',
                subtitle: evLoadActive ? 'Charging' : evLoads[0].latest?.switch_on ? 'Plugged in' : 'Idle',
                power_kw: evLoadPowerKw,
                status: evLoadActive ? 'active' : 'inactive',
                color: '#34d399',
                icon: <Car size={24} color="#34d399" />,
                details: {
                  'Charging Power': `${fmtPower(evLoadPowerKw).valueStr} ${fmtPower(evLoadPowerKw).unit}`,
                  'Voltage': evLoads[0].latest?.voltage_v != null ? `${evLoads[0].latest.voltage_v.toFixed(0)} V` : '—',
                  'Status': evLoadActive ? 'Charging' : evLoads[0].latest?.switch_on ? 'Plugged in' : 'Idle',
                },
                device: evLoads[0],
              })}
            />
          )}

          <SubSection
            title="Grid Load" icon={<Grid size={11} color="#60a5fa" />}
            accentColor="#60a5fa" devices={gridLoads} isDark={isDark}
            compact={compactFlow}
            onDeviceClick={(device) => handleNodeClick(createDeviceNodeData(device, '#60a5fa'))}
            ctTotalKw={ctReading ? Math.abs(ctActivePowerW(ctReading)) / 1000 : undefined}
            onCtHeaderClick={() => ctReading && handleNodeClick({
              type: 'ctmeter',
              id: 'ctmeter',
              title: 'Grid Load · Energy Meter',
              subtitle: '3-Phase Measurement',
              power_kw: Math.abs(ctActivePowerW(ctReading)) / 1000,
              status: (Math.abs(ctActivePowerW(ctReading)) / 1000) > 0 ? 'active' : 'inactive',
              color: '#60a5fa',
              icon: <Activity size={24} color="#60a5fa" />,
              details: {
                'Active Power': `${Math.abs(ctActivePowerW(ctReading)).toFixed(1)} W`,
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
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{statusText}</span>
        <span style={{ fontSize: 9.5, color: isDark ? '#cbd5e1' : 'var(--border-strong)', fontVariantNumeric: 'tabular-nums' }}>
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
