import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SmartDeviceNode } from './types';
import { apiService } from '../../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeType = 'solar' | 'battery' | 'grid' | 'load' | 'device';

export interface NodeData {
  type: NodeType;
  id: string;
  title: string;
  subtitle?: string;
  power_kw: number;
  status?: 'active' | 'inactive' | 'online' | 'offline';
  color: string;
  icon: React.ReactNode;
  details?: Record<string, string | number>;
  device?: SmartDeviceNode;
  current_a?: number;
  voltage_v?: number;
  energy_kwh?: number;
  timestamp?: string;
  deviceType?: string;
  circuit?: string;
}

interface NodeDetailModalProps {
  node: NodeData | null;
  onClose: () => void;
  isDark: boolean;
  siteId?: string;
}

// ─── Design tokens (360watts Design System) ───────────────────────────────────

const DS = {
  colors: {
    solarGreen: '#2FBF71',
    amber: '#E9B949',
    error: '#EF4444',
    success: '#34D399',
    warning: '#F59E0B',
    info: '#3B82F6',
    bgDark: '#0A0E1A',
    surfaceDark: 'rgba(255,255,255,0.04)',
    borderDark: 'rgba(255,255,255,0.09)',
    textPrimary: '#F1F5F9',
    textMuted: 'rgba(241,245,249,0.52)',
    textDim: 'rgba(241,245,249,0.32)',
  },
  radius: { sm: 10, md: 14, lg: 18, pill: 999 },
  spacing: { xs: 8, sm: 12, md: 16, lg: 24 },
  shadow: {
    modal: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
    glow: (color: string) => `0 0 32px ${color}28, 0 0 64px ${color}12`,
  },
};

// ─── Animation variants ───────────────────────────────────────────────────────

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 340, damping: 30 },
  },
  exit: {
    opacity: 0, scale: 0.94, y: 16,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.32, delay: i * 0.055, ease: 'easeOut' },
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPower = (kw: number): { value: string; unit: string } => {
  const abs = Math.abs(kw);
  if (abs >= 1) return { value: abs.toFixed(2), unit: 'kW' };
  return { value: (abs * 1000).toFixed(0), unit: 'W' };
};

const fmtRelTime = (ts: string): string => {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
};

const isActive = (status?: string) => status === 'active' || status === 'online';

// Field in site history response per node type
// Maps node type to a function that extracts kW from a history row.
// Backend returns watts from telemetry_5min CAGG: pv1_power_w, pv2_power_w,
// ac_output_power_w, load_power_w, grid_power_w, battery_power_w.
const HISTORY_EXTRACT: Partial<Record<NodeType, (r: Record<string, unknown>) => number | null>> = {
  solar: (r) => {
    const pv1 = Number(r.pv1_power_w ?? 0);
    const pv2 = Number(r.pv2_power_w ?? 0);
    const ac = Number(r.ac_output_power_w ?? 0);
    // Use AC output if PV strings are missing, otherwise sum PV strings
    const raw = (pv1 === 0 && pv2 === 0 && ac > 0) ? ac : (pv1 + pv2);
    return raw / 1000;
  },
  battery: (r) => r.battery_power_w != null ? Number(r.battery_power_w) / 1000 : null,
  grid:    (r) => r.grid_power_w    != null ? Number(r.grid_power_w)    / 1000 : null,
  load:    (r) => r.load_power_w    != null ? Number(r.load_power_w)    / 1000 : null,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status?: string }) {
  const active = isActive(status);
  const color = active ? DS.colors.solarGreen : status === 'inactive' ? DS.colors.textDim : DS.colors.error;
  const label = status ?? 'unknown';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: DS.radius.pill,
      background: `${color}18`, border: `1px solid ${color}40`,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
      textTransform: 'uppercase', color,
    }}>
      <motion.span
        animate={active ? { opacity: [1, 0.3, 1] } : {}}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
      />
      {label}
    </span>
  );
}

function MetricTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: DS.colors.surfaceDark,
      border: `1px solid ${DS.colors.borderDark}`,
      borderRadius: DS.radius.sm,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: DS.colors.textDim, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: accent ?? DS.colors.textPrimary, letterSpacing: '-0.01em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: DS.colors.textMuted, marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: DS.colors.textDim, marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function TrendIcon({ kw }: { kw: number }) {
  if (kw > 0.5) return <TrendingUp size={14} color={DS.colors.solarGreen} />;
  if (kw < -0.5) return <TrendingDown size={14} color={DS.colors.error} />;
  return <Minus size={14} color={DS.colors.textDim} />;
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type SparkPoint = { t: string; v: number };

export default function NodeDetailModal({ node, onClose, isDark, siteId }: NodeDetailModalProps) {
  const [sparkData, setSparkData] = useState<SparkPoint[]>([]);
  const [sparkLoading, setSparkLoading] = useState(false);

  // ESC to close
  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [node, onClose]);

  // Fetch today's history for the trend chart
  useEffect(() => {
    if (!node) { setSparkData([]); return; }
    let cancelled = false;
    setSparkLoading(true);

    const todayDate = new Date();
    const today = todayDate.toISOString().slice(0, 10);
    const tomorrow = new Date(todayDate.getTime() + 86400000).toISOString().slice(0, 10);

    const load = async () => {
      try {
        let points: SparkPoint[] = [];

        if (node.type === 'device' && node.device) {
          // Smart device: use dedicated readings endpoint
          const rows = await apiService.getSmartDeviceReadings(node.device.id, 24);
          points = rows
            .filter(r => r.power_w != null)
            .map(r => ({
              t: new Date(r.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
              v: (r.power_w ?? 0) / 1000,
            }));
        } else if (siteId && HISTORY_EXTRACT[node.type]) {
          const extract = HISTORY_EXTRACT[node.type]!;
          const rows = await apiService.getSiteHistory(siteId, { start_date: today, end_date: tomorrow, aggregate: '15min' });
          points = rows
            .map(r => ({ t: new Date(r.timestamp ?? '').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }), v: extract(r as Record<string, unknown>) }))
            .filter((p): p is { t: string; v: number } => p.v != null && !isNaN(p.v))
            .map(p => ({ ...p, v: Math.abs(p.v) }));
        }

        if (!cancelled) setSparkData(points);
      } catch {
        if (!cancelled) setSparkData([]);
      } finally {
        if (!cancelled) setSparkLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [node?.id, siteId]);

  const pwr = node ? fmtPower(node.power_kw) : { value: '0.00', unit: 'kW' };
  const active = isActive(node?.status);
  const accentColor = node?.color ?? DS.colors.solarGreen;

  // Build details entries for the grid
  const detailEntries = node?.details ? Object.entries(node.details) : [];
  const extraEntries: [string, string][] = [];
  if (node?.current_a != null) extraEntries.push(['Current', `${node.current_a.toFixed(2)} A`]);
  if (node?.voltage_v != null) extraEntries.push(['Voltage', `${node.voltage_v.toFixed(1)} V`]);
  if (node?.energy_kwh != null) extraEntries.push(['Energy Today', `${node.energy_kwh.toFixed(3)} kWh`]);
  if (node?.deviceType) extraEntries.push(['Device Type', node.deviceType.replace(/_/g, ' ')]);
  if (node?.circuit) extraEntries.push(['Circuit', node.circuit]);

  // Merge: extra readings take precedence over generic details
  const allDetails: [string, string][] = [
    ...detailEntries.map(([k, v]) => [k, String(v)] as [string, string]),
    ...extraEntries,
  ];

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(4,6,14,0.72)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 998,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* ── Modal card ── */}
            <motion.div
              key="modal"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative',
                width: 'min(94vw, 460px)',
                maxHeight: '88dvh',
                overflowY: 'auto',
                overflowX: 'hidden',
                borderRadius: DS.radius.lg,
                background: isDark
                  ? 'rgba(8,12,22,0.92)'
                  : 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: isDark
                  ? DS.shadow.modal
                  : '0 24px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
                border: isDark
                  ? `1px solid rgba(255,255,255,0.07)`
                  : `1px solid rgba(0,0,0,0.08)`,
                // Colored top accent strip
                borderTop: `3px solid ${accentColor}`,
                zIndex: 999,
                scrollbarWidth: 'none',
              }}
            >
              {/* Glow halo behind modal */}
              {active && (
                <div style={{
                  position: 'absolute', inset: -2, borderRadius: DS.radius.lg,
                  background: `radial-gradient(ellipse at 50% -10%, ${accentColor}1a 0%, transparent 60%)`,
                  pointerEvents: 'none', zIndex: -1,
                }} />
              )}

              {/* ── Header ── */}
              <motion.div
                custom={0} variants={rowVariants} initial="hidden" animate="visible"
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '18px 18px 14px',
                  borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                }}
              >
                {/* Icon + title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: DS.radius.sm,
                    background: `${accentColor}18`,
                    border: `1.5px solid ${accentColor}38`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: active ? `0 0 16px ${accentColor}28` : 'none',
                  }}>
                    {node.icon}
                  </div>
                  <div>
                    <div style={{
                      fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2,
                      color: isDark ? DS.colors.textPrimary : '#0F172A',
                    }}>
                      {node.title}
                    </div>
                    {node.subtitle && (
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: DS.colors.textDim, marginTop: 2 }}>
                        {node.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 30, height: 30, borderRadius: DS.radius.sm,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    color: DS.colors.textMuted,
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; }}
                >
                  <X size={14} />
                </button>
              </motion.div>

              <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* ── Power hero ── */}
                <motion.div
                  custom={1} variants={rowVariants} initial="hidden" animate="visible"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: DS.radius.md,
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {/* Subtle left accent bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 3, background: accentColor, borderRadius: '4px 0 0 4px',
                    opacity: active ? 1 : 0.35,
                  }} />

                  <div style={{ paddingLeft: 8 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: isDark ? DS.colors.textDim : 'rgba(15,23,42,0.38)',
                      marginBottom: 6,
                    }}>
                      Live Power
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <span style={{
                        fontSize: 30, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
                        color: isDark ? DS.colors.textPrimary : '#0F172A',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {pwr.value}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: isDark ? DS.colors.textMuted : 'rgba(15,23,42,0.52)',
                      }}>
                        {pwr.unit}
                      </span>
                    </div>
                    {node.timestamp && (
                      <div style={{ fontSize: 10, color: DS.colors.textDim, marginTop: 5 }}>
                        Updated {fmtRelTime(node.timestamp)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <StatusPill status={node.status} />
                    <TrendIcon kw={node.power_kw} />
                  </div>
                </motion.div>

                {/* ── Metrics grid ── */}
                {allDetails.length > 0 && (
                  <motion.div custom={2} variants={rowVariants} initial="hidden" animate="visible">
                    <SectionLabel>Details</SectionLabel>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                      gap: 8,
                    }}>
                      {allDetails.slice(0, 6).map(([k, v], i) => (
                        <MetricTile
                          key={k + i}
                          label={k}
                          value={v}
                          accent={k.toLowerCase().includes('power') ? accentColor : undefined}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── Sparkline chart ── */}
                <motion.div custom={3} variants={rowVariants} initial="hidden" animate="visible">
                  <SectionLabel>24h Trend</SectionLabel>
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
                    border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                    borderRadius: DS.radius.sm,
                    padding: '8px 4px 4px',
                    height: 108,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sparkLoading ? (
                      <span style={{ fontSize: 11, color: DS.colors.textDim }}>Loading…</span>
                    ) : sparkData.length === 0 ? (
                      <span style={{ fontSize: 11, color: DS.colors.textDim }}>No data for today</span>
                    ) : (
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={sparkData} margin={{ top: 4, right: 6, left: 6, bottom: 4 }}>
                        <XAxis
                          dataKey="t"
                          tick={{ fontSize: 9, fill: DS.colors.textDim, fontWeight: 600 }}
                          tickLine={false}
                          axisLine={false}
                          interval={Math.max(0, Math.floor(sparkData.length / 6) - 1)}
                        />
                        <defs>
                          <linearGradient id={`grad-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor={accentColor} stopOpacity={isDark ? 0.3 : 0.2} />
                            <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          contentStyle={{
                            background: isDark ? '#0d1117' : '#ffffff',
                            border: `1px solid ${accentColor}40`,
                            borderRadius: 8,
                            fontSize: 11,
                            color: isDark ? DS.colors.textPrimary : '#0F172A',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                          }}
                          formatter={(v: unknown) => [`${typeof v === 'number' ? v.toFixed(2) : v} kW`, 'Power']}
                          labelFormatter={(l: unknown) => `${String(l)}`}
                          cursor={{ stroke: `${accentColor}40`, strokeWidth: 1 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke={accentColor}
                          strokeWidth={2}
                          fill={`url(#grad-${node.id})`}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                </motion.div>

                {/* ── Footer meta row ── */}
                <motion.div
                  custom={4} variants={rowVariants} initial="hidden" animate="visible"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingTop: 10,
                    borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', color: DS.colors.textDim }}>
                    NODE · {node.type.toUpperCase()} · {node.id.toUpperCase()}
                  </span>
                  <button
                    onClick={onClose}
                    style={{
                      fontSize: 10, fontWeight: 700, color: accentColor,
                      background: `${accentColor}14`, border: `1px solid ${accentColor}28`,
                      borderRadius: DS.radius.sm, padding: '4px 12px',
                      cursor: 'pointer', letterSpacing: '0.04em',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}28`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}14`; }}
                  >
                    Dismiss
                  </button>
                </motion.div>

              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
