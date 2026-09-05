import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { Sun, Battery, Home, Zap, Wind, Droplets, Waves, Plug, Activity, Grid, Car, Refrigerator } from 'lucide-react';
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

// Cross topology: Inverter hub at centre, Battery above, Solar left, Grid right, Load below.
const VW  = 700;
const HUB_R    = 38;
// NodeCard's real, fixed CSS size (see DeviceCard.tsx) — unlike the SVG diagram,
// which scales uniformly with container width, this card does NOT scale with it,
// so a trim in fixed viewBox units can only line up with the card's actual edge
// at one specific container width. NODE_R/BATT_TRIM below are computed live from
// these CSS px constants and the current render's actual scale instead of being
// guessed viewBox-unit constants — that mismatch (a static guess vs. a card whose
// on-screen size doesn't track it) was why lines missed the card border after
// every layout tweak: gap on one side, running under the card on the other.
const CARD_HALF_W_PX = 56;   // half of NodeCard's 108px width + a couple px breathing room
const CARD_HALF_H_PX = 62;   // half of NodeCard's ~120–130px rendered height (with/without sub-label)

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

// Quadratic-bezier beam, pulled from the customer portal's EnergyFlowDiagram
// (its Hub node literally says "matches staff HubNode" — same design lineage,
// this was the one piece of polish worth pulling back). Bows perpendicular to
// the (untrimmed) node→hub direction; the XOR sign rule makes opposite arms of
// the cross bow the same way and adjacent arms bow oppositely, so the whole
// diagram reads as one balanced pinwheel instead of four independent curves.
function bez(x1: number, y1: number, x2: number, y2: number, origX1: number, origY1: number, origX2: number, origY2: number, k = 26) {
  const dx = origX2 - origX1, dy = origY2 - origY1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const sign = (origX1 < origX2) !== (origY1 < origY2) ? -1 : 1;
  const cpx = mx + k * sign * (dy / dist);
  const cpy = my - k * sign * (dx / dist);
  // True quadratic-bezier midpoint at t=0.5 — where the FlowLabel pill sits,
  // matching the customer portal's BeamLabel placement.
  const mid = { x: 0.25 * x1 + 0.5 * cpx + 0.25 * x2, y: 0.25 * y1 + 0.5 * cpy + 0.25 * y2 };
  return { path: `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`, mid, cp: { x: cpx, y: cpy } };
}

// Sankey-ish weighted width: stroke-width scales with magnitude instead of
// every connector drawing at the same fixed weight (Iteration C).
const widthForKw = (kw: number) => Math.min(12, Math.max(2, Math.abs(kw) * 1.6));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Smoothly tweens an SVG element's stroke-width via GSAP when `width` changes,
// instead of it snapping between renders. No-ops under prefers-reduced-motion.
function useTweenedStrokeWidth(ref: React.RefObject<SVGElement>, width: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.setAttribute('stroke-width', String(width));
      return;
    }
    const tween = gsap.to(el, { attr: { 'stroke-width': width }, duration: 0.6, ease: 'power2.out' });
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);
}

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
  // Curve shape is always derived from the same canonical (external node → hub)
  // orientation, regardless of direction — toHub/fromHub are the same physical
  // line, just drawn (and dash-animated) in opposite directions. Computing the
  // bow from swapped orig points per direction (the previous version) flips the
  // control point to the opposite side of the chord, producing two separate
  // mirror-image arcs instead of one shared curve — that was the actual bug
  // behind Battery/Grid Tie showing a lens-shaped double line.
  const near = trimStart(sx, sy, hub.x, hub.y, srcTrim); // trimmed point near the external node
  const far  = trimEnd(sx, sy, hub.x, hub.y, hubTrim);   // trimmed point near the hub
  const shared = bez(near.x, near.y, far.x, far.y, sx, sy, hub.x, hub.y);
  if (direction === 'toHub') return { path: shared.path, mid: shared.mid };
  return { path: `M ${far.x} ${far.y} Q ${shared.cp.x} ${shared.cp.y} ${near.x} ${near.y}`, mid: shared.mid };
}

type NodePos = { x: number; y: number };
type DiamondNodes = { pv: NodePos; hub: NodePos; batt: NodePos; grid: NodePos; load: NodePos };

function computeLayout(vh: number, nodes: DiamondNodes) {
  return {
    VH: vh,
    N: nodes,
    ASPECT_PAD: `${(vh / VW) * 100}%`,
  };
}

// Paths depend on the live container width (see CARD_HALF_W_PX/CARD_HALF_H_PX
// comment above), so they're computed per-render, not baked into the static
// layout constants.
function computePaths(nodes: DiamondNodes, containerWidthPx: number) {
  const { pv, hub, batt, grid, load } = nodes;
  const scale = containerWidthPx / VW; // CSS px per viewBox unit at the current render width
  // Diamond arrangement (matches the customer portal's node layout): all four
  // arms approach the hub at the same shallow diagonal angle, unlike the old
  // axis-aligned cross where PV/Grid were purely horizontal and Battery/Load
  // were purely vertical — so one shared trim now applies to all four instead
  // of a horizontal-half-width one and a vertical-half-height one.
  const trim = ((CARD_HALF_W_PX + CARD_HALF_H_PX) / 2) / scale;
  return {
    pvToHub:   hubPath(pv.x,   pv.y,   'toHub',   hub, trim),
    battToHub: hubPath(batt.x, batt.y, 'toHub',   hub, trim),
    hubToBatt: hubPath(batt.x, batt.y, 'fromHub', hub, trim),
    gridToHub: hubPath(grid.x, grid.y, 'toHub',   hub, trim),
    hubToGrid: hubPath(grid.x, grid.y, 'fromHub', hub, trim),
    hubToLoad: hubPath(load.x, load.y, 'fromHub', hub, trim),
  };
}

// Diamond layout (matches the customer portal's EnergyFlowDiagram: Solar
// top-left, Battery top-right, Home/Load bottom-left, Grid bottom-right, hub
// dead center) — not their exact aspect ratio, though: at their proportions
// this would render ~400 viewBox units tall, right back into the "forces page
// scroll on a full-width host" problem the flatter cross layout was built to
// fix. Same diamond arrangement, compressed to fit a shorter box instead.
const WIDE_LAYOUT = computeLayout(300, {
  pv:   { x: 120, y: 70  },
  batt: { x: 580, y: 70  },
  hub:  { x: 350, y: 150 },
  load: { x: 120, y: 230 },
  grid: { x: 580, y: 230 },
});

// Narrow layout — mobile (container < 480 px).
const NARROW_LAYOUT = computeLayout(300, {
  pv:   { x: 120, y: 75  },
  batt: { x: 580, y: 75  },
  hub:  { x: 350, y: 155 },
  load: { x: 120, y: 235 },
  grid: { x: 580, y: 235 },
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
    case 'fridge':          return <Refrigerator {...p} />;
    default:                return <Plug {...p} />;
  }
};

const GRID_APPLIANCES: ApplianceLabel[] = ['geyser', 'ac_unit', 'washing_machine', 'fridge'];

// Mirrors the backend's smart_device_offline incident threshold
// (LOCAL_POLLER_OFFLINE_FAILURE_THRESHOLD, default 3) — a `local`-mode
// device can hold is_online=true (Tuya's cloud still sees its WiFi chip)
// while being genuinely unreachable on the site LAN, so a run of failed
// local polls is the more trustworthy "actually off" signal here.
const LOCAL_POLLER_OFFLINE_FAILURES = 3;
const isDeviceOffline = (d: SmartDeviceNode): boolean =>
  d.is_online === false || (d.poller_consecutive_failures ?? 0) >= LOCAL_POLLER_OFFLINE_FAILURES;
const circuitOf = (d: SmartDeviceNode): 'solar' | 'grid' => {
  if (d.circuit === 'inverter_backup') return 'solar';
  if (d.circuit === 'grid_direct' || d.circuit === 'ev_line') return 'grid';
  return GRID_APPLIANCES.includes(d.appliance_label) ? 'grid' : 'solar';
};
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
function Beam({ d, color, active, speed = 1.6, intensity = 0.5, width }: {
  d: string; color: string; active: boolean; glowId?: string; speed?: number; intensity?: number; width?: number;
}) {
  const lineRef = useRef<SVGPathElement>(null);
  useTweenedStrokeWidth(lineRef, width ?? 2.5);
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
      {/* Flowing dashed line — width carries magnitude (Sankey-ish), tweened via GSAP */}
      <path
        ref={lineRef}
        d={d}
        stroke={color}
        strokeWidth={width ?? 2.5}
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
        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--info)',
      }}>Inverter</span>
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
  // Takes priority over the power-based active/inactive read: an offline
  // device shouldn't show as "inactive" (implies it's just idle) when it's
  // actually disconnected. See isDeviceOffline's doc comment for why this
  // isn't just is_online — Tuya's cloud flag can lag a real LAN outage.
  const offline = isDeviceOffline(device);

  return {
    type: 'device',
    id: `device-${device.id}`,
    title: deviceName,
    subtitle: offline ? 'Offline' : 'Smart Device',
    power_kw: sdKw,
    status: offline ? 'offline' : (sdActive ? 'active' : 'inactive'),
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
          fontSize: compact ? 9.5 : 10, fontWeight: 700, letterSpacing: '0.05em',
          textTransform: 'uppercase', color: accentColor, marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</div>
        <div style={{
          fontSize: compact ? 16 : 20, fontWeight: 900,
          color: 'var(--foreground)',
          letterSpacing: '-0.03em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>{valueFmt}</div>
      </div>
      {oc && <div style={{
        fontSize: compact ? 10 : 11, fontWeight: 600,
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
          fontSize: compact ? 10 : 10.5, fontWeight: 700, letterSpacing: '0.06em',
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
            valueFmt={(() => { const f = fmtPower(ctTotalKw!); return `${ctTotalKw! < 0 ? '-' : ''}${f.valueStr} ${f.unit}`; })()}
            chevron="3-Phase ›"
            onClick={onCtHeaderClick}
          />
        )}

        {/* Same reading as the Backup Load card above — labeled as a cross-reference,
            not a second independent measurement, so it doesn't read as two numbers
            that happen to coincide. */}
        {hasInverter && (
          <ItemCard
            label="↑ Same as Backup Load"
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
              const offline = isDeviceOffline(device);
              const latest = freshLatest(device);
              const sdKw = (latest?.power_w ?? 0) / 1000;
              const sdFmt = fmtPower(sdKw);
              const sdActive = !offline && device.is_active && sdKw > 0.001;
              const deviceName = deviceLabel(device);
              const deviceColor = sdActive ? accentColor : isDark ? '#cbd5e1' : 'var(--text-dim)';
              return (
                <SmartCard
                  key={device.id} label={deviceName}
                  icon={applIcon(device.appliance_label, deviceColor)}
                  // A disconnected device's last-known wattage is exactly
                  // the kind of stale/untrustworthy reading fixed earlier —
                  // show "Offline" instead of a number that may no longer
                  // reflect reality.
                  valueStr={offline ? 'Offline' : sdFmt.valueStr} unit={offline ? '' : sdFmt.unit}
                  active={sdActive} isAnomalous={offline || (device.is_active && device.latest === null)}
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
export default function EnergyFlowBlock({ pvKw, loadKw, gridKw, battKw, battSoc, smartDevices = [], siteId, inverterPhases, ctReading: externalCtReading }: EnergyFlowBlockProps) {
  const { isDark } = useTheme();
  const uidRef = useRef('');
  if (!uidRef.current) uidRef.current = `efb-${Math.random().toString(36).slice(2, 8)}`;

  // Track container width to switch between wide and narrow layouts and to
  // scale node cards, the Backup Load card, and SubSection proportionally.
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

  const { VH, N, ASPECT_PAD } = containerWidth < 480 ? NARROW_LAYOUT : WIDE_LAYOUT;
  // Recomputed every render off the live container width — see computePaths' doc
  // comment for why a static, precomputed set of paths can't stay correct here.
  const P = computePaths(N, containerWidth);

  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Discard readings older than 15 minutes — device is offline. Applied to both
  // the self-fetch path below and any externally-provided ctReading, so a stale
  // reading never displays regardless of who fetched it.
  const freshOrNull = (data: CtMeterReading | null | undefined): CtMeterReading | null => {
    if (!data) return null;
    if (data.timestamp) {
      const ageMs = Date.now() - new Date(data.timestamp).getTime();
      if (ageMs > 15 * 60 * 1000) return null;
    }
    return data;
  };

  const [ctReading, setCtReading] = useState<CtMeterReading | null>(freshOrNull(externalCtReading) ?? null);

  useEffect(() => {
    // If ctReading provided by parent (e.g., from SiteDataPanel), skip independent polling
    if (externalCtReading !== undefined) {
      setCtReading(freshOrNull(externalCtReading));
      return;
    }
    if (!siteId) return;
    let cancelled = false;
    const fetch = async () => {
      if (document.hidden) return;
      const data = await apiService.getLatestEnergyMeter(siteId);
      if (cancelled) return;
      setCtReading(freshOrNull(data));
    };
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [siteId, externalCtReading]);

  const ctGridKw  = Math.abs(ctActivePowerW(ctReading)) / 1000;
  const ctReversed = (ctReading?.active_power_total ?? 0) < 0;

  const nonGridDevices  = smartDevices.filter(d => d.appliance_label !== 'grid');
  const evLoads         = nonGridDevices.filter(d => d.appliance_label === 'ev_charger');
  const solarLoads      = nonGridDevices.filter(d => d.appliance_label !== 'ev_charger' && circuitOf(d) === 'solar');
  const gridLoads       = nonGridDevices.filter(d => d.appliance_label !== 'ev_charger' && circuitOf(d) === 'grid');
  const evLoadPowerKw  = evLoads.reduce((s, d) => s + ((freshLatest(d)?.power_w ?? 0) / 1000), 0);
  const evLoadActive   = evLoadPowerKw  > 0;

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
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: isDark ? '#cbd5e1' : 'var(--text-dim)' }}>
          Energy Flow
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <motion.div
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#22c55e' }}>Live</span>
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

      {/* Diagram — capped and centered so a full-width host (now that Health has
          its own tab) doesn't stretch the fixed-aspect-ratio cross diagram tall
          enough to force page scroll. Cap sits above the nodeScale saturation
          point (480px) so card sizing is unaffected. */}
      <div ref={diagramRef} style={{ padding: '10px 18px 0', maxWidth: 800, margin: '0 auto' }}>
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

              {/* Static idle tracks — Beam renders nothing at all when a flow is 0,
                  so without these the connector to Hub just disappears whenever
                  PV/Battery/Grid/Load is momentarily idle, reading as a broken
                  link rather than "nothing flowing right now". Always drawn,
                  dim; the animated Beam on top is what actually shows magnitude.
                  Reuses the exact same (trimmed, curved) path as the active beam
                  for each connector — one source of truth for idle vs. active,
                  instead of a second hand-drawn straight line that can drift out
                  of sync with it. */}
              <path d={P.pvToHub.path}   stroke="#f59e0b" strokeWidth={6} strokeOpacity={0.22} strokeLinecap="round" fill="none" />
              <path d={P.battToHub.path} stroke="#0ea5e9" strokeWidth={6} strokeOpacity={0.22} strokeLinecap="round" fill="none" />
              <path d={P.gridToHub.path} stroke="#60a5fa" strokeWidth={6} strokeOpacity={0.22} strokeLinecap="round" fill="none" />
              <path d={P.hubToLoad.path} stroke="#f87171" strokeWidth={6} strokeOpacity={0.22} strokeLinecap="round" fill="none" />

              {/* Animated beam pulses — glowId scoped per instance to avoid SVG filter collision */}
              <Beam d={P.pvToHub.path}   color="#f59e0b" active={pvActive}                   glowId={`efglow-${uidRef.current}`} intensity={pvIntensity} width={widthForKw(pv)} />
              <Beam d={P.battToHub.path} color="#0ea5e9" active={battActive && isDischarging} glowId={`efglow-${uidRef.current}`} intensity={battIntensity} width={widthForKw(batt)} />
              <Beam d={P.hubToBatt.path} color="#0ea5e9" active={isCharging}                  glowId={`efglow-${uidRef.current}`} intensity={battIntensity} width={widthForKw(batt)} />
              <Beam d={P.gridToHub.path} color="#60a5fa" active={gridActive && isImporting}   glowId={`efglow-${uidRef.current}`} intensity={gridIntensity} width={widthForKw(grid)} />
              <Beam d={P.hubToGrid.path} color="#34d399" active={isExporting}                 glowId={`efglow-${uidRef.current}`} intensity={gridIntensity} width={widthForKw(grid)} />
              <Beam d={P.hubToLoad.path} color="#f87171" active={loadActive}                  glowId={`efglow-${uidRef.current}`} intensity={loadIntensity} width={widthForKw(load)} />
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
                  color="#f59e0b" active={pvActive} isDark={isDark}
                  arcPct={pv / 6} />
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
                  isDark={isDark} arcPct={(battSoc ?? 0) / 100} />
              </div>
            </At>
            <At cx={N.grid.x} cy={N.grid.y} scale={nodeScale} vw={VW} vh={VH}>
              <div onClick={() => handleNodeClick({
                type: 'grid',
                id: 'grid',
                title: 'Grid Tie (Inverter)',
                subtitle: isExporting ? 'Exporting' : isImporting ? 'Importing' : 'Idle',
                power_kw: Math.abs(grid),
                status: gridActive ? 'active' : 'inactive',
                color: gridColor,
                icon: <Zap size={24} color={gridColor} />,
                details: {
                  'Power Flow': `${gridFmt.valueStr} ${gridFmt.unit}`,
                  'Direction': isExporting ? 'Export ↑' : isImporting ? 'Import ↓' : 'Idle',
                  'Mode': isExporting ? 'Selling' : isImporting ? 'Buying' : 'Idle',
                  'Meter': "Inverter's own built-in grid CT",
                },
              })} style={{ cursor: 'pointer' }}>
                <NodeCard label="Grid Tie"
                  icon={<Zap size={22} color={gridActive ? gridColor : 'var(--muted-foreground)'} />}
                  valueStr={gridFmt.valueStr} unit={gridFmt.unit}
                  color={gridColor} active={gridActive}
                  subLabel={isExporting ? '↑ Selling' : isImporting ? '↓ Buying' : undefined}
                  isDark={isDark} arcPct={Math.abs(grid) / 5} />
              </div>
            </At>
            <At cx={N.load.x} cy={N.load.y} scale={nodeScale} vw={VW} vh={VH}>
              <div onClick={() => handleNodeClick({
                type: 'load',
                id: 'load',
                title: 'Backup Load',
                subtitle: 'via inverter',
                power_kw: load,
                status: loadActive ? 'active' : 'inactive',
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
              })} style={{ cursor: 'pointer' }}>
                <NodeCard label="Backup Load"
                  icon={<Home size={22} color={loadActive ? '#f87171' : 'var(--muted-foreground)'} />}
                  valueStr={fmtPower(load).valueStr} unit={fmtPower(load).unit}
                  color="#f87171" active={loadActive} isDark={isDark}
                  isAnomalous={ctReversed} subLabel={ctReversed ? 'CT reversed?' : undefined}
                  arcPct={load / 6} />
              </div>
            </At>
          </div>
        </div>
      </div>

      {/* Y-connector group labels (Backup→Solar, Grid→EV/Grid-Direct). Backup Load's
          own card now lives up in the diamond diagram as the 4th node (matching the
          customer portal's layout), so this section only holds the group labels +
          sub-load row + Site Total below it. */}
      <div style={{ padding: '0 18px 0', marginTop: 0 }}>
        {/* Two independent groups, not one shared stem — Backup Load is the only
            one actually sourced from the inverter (matches the hubToLoad beam
            above it); EV + Grid-Direct both bypass the inverter, so they're
            grouped under "Grid" instead. Plain flexbox with the SAME flex
            ratios as the card row below, instead of a hand-scaled SVG: alignment
            comes from one shared layout algorithm, not coordinate math that has
            to be kept in sync with it by hand (that mismatch was the actual bug
            behind three straight rounds of "still not connecting" reports). */}
        {(() => {
          const hasEv = evLoads.length > 0;
          return (
            <div style={{ display: 'flex', gap: compactFlow ? 8 : 10, padding: '10px 0 2px' }}>
              <div style={{
                flex: '1 1 0', textAlign: 'center', color: '#f87171',
                fontSize: compactFlow ? 9.5 : 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', paddingTop: 6,
                borderTop: '2px solid #f8717166',
              }}>
                ↓ Inverter
              </div>
              <div style={{
                flex: hasEv ? '2 1 0' : '1 1 0', textAlign: 'center', color: '#f472b6',
                fontSize: compactFlow ? 9.5 : 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', paddingTop: 6,
                borderTop: '2px solid #f472b666',
              }}>
                ↓ Grid
              </div>
            </div>
          );
        })()}
      </div>

      {/* Sub-load row: Solar SubSection | EV NodeCard | Grid SubSection — full
          width, not capped like the diagram/connectors above. These cards list
          individual devices and benefit from the horizontal room a full-width
          host actually gives; their height doesn't grow with width the way the
          fixed-aspect-ratio diagram does, so there's no scroll risk in letting
          them stretch. */}
      <div style={{ padding: '0 18px 0' }}>
        <div style={{ display: 'flex', gap: compactFlow ? 8 : 10, alignItems: 'stretch', paddingBottom: 14, marginTop: 0 }}>
          <SubSection
            // Same reading as the "Backup Load" card above, not a second number —
            // shares its name and color so that's obvious, and only shows the
            // header line (no duplicate big stat) if there are no individual
            // inverter-backup smart devices to break it down further.
            title="Backup Load" icon={<Home size={11} color="#f87171" />}
            accentColor="#f87171" devices={solarLoads} isDark={isDark}
            compact={compactFlow}
            onDeviceClick={(device) => handleNodeClick(createDeviceNodeData(device, '#f87171'))}
            inverterKw={load > 0 ? load : undefined}
            onInverterClick={() => handleNodeClick({
              type: 'solar',
              id: 'inverter-load',
              title: 'Backup Load',
              subtitle: 'Inverter AC Output — same reading as above',
              power_kw: load,
              status: load > 0 ? 'active' : 'inactive',
              color: '#f87171',
              icon: <Home size={24} color="#f87171" />,
              details: {
                'Backup Load': `${fmtPower(load).valueStr} ${fmtPower(load).unit}`,
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
                subtitle: isDeviceOffline(evLoads[0]) ? 'Offline' : evLoadActive ? 'Charging' : evLoads[0].latest?.switch_on ? 'Plugged in' : 'Idle',
                power_kw: evLoadPowerKw,
                status: isDeviceOffline(evLoads[0]) ? 'offline' : evLoadActive ? 'active' : 'inactive',
                color: '#34d399',
                icon: <Car size={24} color="#34d399" />,
                details: {
                  'Charging Power': `${fmtPower(evLoadPowerKw).valueStr} ${fmtPower(evLoadPowerKw).unit}`,
                  'Voltage': evLoads[0].latest?.voltage_v != null ? `${evLoads[0].latest.voltage_v.toFixed(0)} V` : '—',
                  'Status': isDeviceOffline(evLoads[0]) ? 'Offline' : evLoadActive ? 'Charging' : evLoads[0].latest?.switch_on ? 'Plugged in' : 'Idle',
                },
                device: evLoads[0],
              })}
            />
          )}

          <SubSection
            title="Grid Direct" icon={<Grid size={11} color="#f472b6" />}
            accentColor="#f472b6" devices={gridLoads} isDark={isDark}
            compact={compactFlow}
            onDeviceClick={(device) => handleNodeClick(createDeviceNodeData(device, '#f472b6'))}
            ctTotalKw={ctReading ? ctActivePowerW(ctReading) / 1000 : undefined}
            onCtHeaderClick={() => ctReading && handleNodeClick({
              type: 'ctmeter',
              id: 'ctmeter',
              title: 'Grid Direct · Energy Meter',
              subtitle: '3-Phase Measurement',
              // Signed, unlike every other node type's power_kw here — this is
              // the meter's own headline number and should show its real
              // direction (see F-051), not just feed a magnitude/active check.
              power_kw: ctActivePowerW(ctReading) / 1000,
              status: (Math.abs(ctActivePowerW(ctReading)) / 1000) > 0 ? 'active' : 'inactive',
              color: '#f472b6',
              icon: <Activity size={24} color="#f472b6" />,
              details: {
                'Active Power': `${ctActivePowerW(ctReading).toFixed(1)} W`,
                'Apparent Power': `${Math.abs(ctReading.apparent_power_total ?? 0).toFixed(1)} VA`,
                'Power Factor': (ctReading.power_factor_total ?? 0).toFixed(3),
                'Meter': 'Separate submeter on the grid-direct circuit',
              },
              ctReading,
            })}
          />
        </div>

        {/* Site Total — a computed sum, not a drawn beam. Backup Load, Grid-Direct,
            and EV are three genuinely independent circuits; this readout is the
            only place their total is claimed, and it says so instead of implying
            a shared physical path. */}
        {(() => {
          const siteTotalKw = load + ctGridKw + evLoadPowerKw;
          const siteTotalFmt = fmtPower(siteTotalKw);
          return (
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6,
              padding: '2px 0 14px', fontSize: compactFlow ? 11.5 : 12.5,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace", flexWrap: 'wrap',
            }}>
              <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>Site Total</span>
              <span style={{ color: 'var(--foreground)', fontWeight: 800 }}>{siteTotalFmt.valueStr} {siteTotalFmt.unit}</span>
              <span style={{ color: 'var(--text-dim)' }}>=</span>
              <span style={{ color: '#f87171' }}>Backup {fmtPower(load).valueStr}</span>
              <span style={{ color: 'var(--text-dim)' }}>+</span>
              <span style={{ color: '#f472b6' }}>Grid-Direct {fmtPower(ctGridKw).valueStr}</span>
              {evLoadPowerKw > 0 && <>
                <span style={{ color: 'var(--text-dim)' }}>+</span>
                <span style={{ color: '#34d399' }}>EV {fmtPower(evLoadPowerKw).valueStr}</span>
              </>}
            </div>
          );
        })()}
      </div>

      {/* Status row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 18px 12px', borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.07)' : '#f1f5f9'}`,
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{statusText}</span>
        <span style={{ fontSize: 10.5, color: isDark ? '#cbd5e1' : 'var(--border-strong)', fontVariantNumeric: 'tabular-nums' }}>
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
