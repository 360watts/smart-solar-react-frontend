import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { apiService } from '../../services/api';
import type { HardwareHealthData, ComponentHealth } from '../../services/api';

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:        '#0c1220',
  surface:   '#111827',
  card:      '#141d2e',
  cardHover: '#182035',
  border:    '#1e293b',
  borderFaint: 'rgba(255,255,255,0.05)',
  textPrimary: '#f1f5f9',
  textSecondary: '#7eb3d8',
  textMono:  '#a8c8e8',
  status: {
    0: { color: '#34d399', glow: 'rgba(52,211,153,0.4)',   pillBg: 'rgba(52,211,153,0.1)',  pillText: '#6ee7b7', label: 'Excellent'       },
    1: { color: '#fbbf24', glow: 'rgba(251,191,36,0.35)',  pillBg: 'rgba(251,191,36,0.1)',  pillText: '#fcd34d', label: 'Needs Attention' },
    2: { color: '#f87171', glow: 'rgba(248,113,113,0.35)', pillBg: 'rgba(248,113,113,0.1)', pillText: '#fca5a5', label: 'Critical'        },
  } as Record<number, { color: string; glow: string; pillBg: string; pillText: string; label: string }>,
} as const;

const FONT_DISPLAY = "'Outfit', 'Outfit', sans-serif";
const FONT_BODY    = "'DM Sans', sans-serif";
const FONT_MONO    = "'JetBrains Mono', 'Fira Code', monospace";

// ─── Arc gauge helpers ────────────────────────────────────────────────────────

// Converts compass degrees (0=N, CW) to SVG x,y coordinates
function compassToXY(deg: number, cx: number, cy: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// 270° arc: gap at 6 o'clock. Start=225° (SW), End=135° (SE), sweep CW 270°.
function arcPath(cx: number, cy: number, r: number) {
  const start = compassToXY(225, cx, cy, r);
  const end   = compassToXY(135, cx, cy, r);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
}

// ─── Animated Arc Gauge ───────────────────────────────────────────────────────

interface ArcProps { score: number; status: 0|1|2; size: number; strokeWidth?: number; delay?: number; }

function ArcGauge({ score, status, size, strokeWidth = 8, delay = 0 }: ArcProps) {
  const s = T.status[status];
  const cx = size / 2, cy = size / 2;
  const r  = cx - strokeWidth / 2 - 2;
  const path = arcPath(cx, cy, r);
  const filterId = `hw-glow-${size}-${status}`;

  const progress = useMotionValue(0);
  const dashOffset = useTransform(progress, [0, 100], [1, 0]);

  useEffect(() => {
    const ctrl = animate(progress, score, {
      duration: 1.6,
      ease: [0.25, 0.46, 0.45, 0.94],
      delay,
    });
    return () => ctrl.stop();
  }, [score]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <defs>
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <path d={path} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* Filled arc (animated) */}
      <motion.path
        d={path}
        fill="none"
        stroke={s.color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength={1}
        style={{ pathOffset: 0, strokeDashoffset: dashOffset, strokeDasharray: '1 1', filter: `url(#${filterId})` }}
      />
    </svg>
  );
}

// ─── Animated score counter ───────────────────────────────────────────────────

function CountUp({ to, delay = 0, style }: { to: number; delay?: number; style?: React.CSSProperties }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const unsub = rounded.on('change', v => setDisplay(v));
    const ctrl = animate(mv, to, { duration: 1.5, ease: [0.25, 0.46, 0.45, 0.94], delay });
    return () => { ctrl.stop(); unsub(); };
  }, [to]);

  return <span style={style}>{display}</span>;
}

// ─── Overall score banner ─────────────────────────────────────────────────────

function OverallBanner({ data }: { data: HardwareHealthData }) {
  const s = T.status[data.overall_status];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 24,
      padding: '20px 24px',
      background: `linear-gradient(135deg, ${T.card} 0%, rgba(20,29,46,0.6) 100%)`,
      borderBottom: `1px solid ${T.border}`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle grid texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      }} />

      {/* Arc gauge */}
      <div style={{ position: 'relative', flexShrink: 0, width: 120, height: 120 }}>
        <ArcGauge score={data.overall_score} status={data.overall_status} size={120} strokeWidth={10} delay={0.1} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2,
          paddingBottom: 12, // visual center of the 270° arc
        }}>
          <CountUp
            to={data.overall_score}
            delay={0.15}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 30,
              fontWeight: 700,
              color: s.color,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textShadow: `0 0 20px ${s.glow}`,
            }}
          />
          <span style={{ fontFamily: FONT_BODY, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.textSecondary }}>
            SCORE
          </span>
        </div>
      </div>

      {/* Label block */}
      <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{
            fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 800,
            letterSpacing: '-0.01em', color: T.textPrimary,
          }}>
            Hardware Health
          </span>
          <span style={{
            fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600,
            padding: '3px 10px', borderRadius: 20,
            background: s.pillBg, color: s.pillText,
            border: `1px solid ${s.color}30`,
            letterSpacing: '0.03em',
          }}>
            {s.label}
          </span>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>
          Inverter 35% · Battery 35% · PV String 30%
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.textSecondary, marginTop: 6, letterSpacing: '0.04em' }}>
          Updated {new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · 7-day window
        </div>
      </div>

      {/* Weight breakdown mini bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {[
          { label: 'INV', score: data.inverter.health_score,    status: data.inverter.status,    w: '35%' },
          { label: 'BAT', score: data.battery.health_score,     status: data.battery.status,     w: '35%' },
          { label: 'PV',  score: data.solar_panel.health_score, status: data.solar_panel.status, w: '30%' },
        ].map(({ label, score, status }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.textSecondary, width: 22, textAlign: 'right', letterSpacing: '0.05em' }}>{label}</span>
            <div style={{ width: 72, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                style={{ height: '100%', borderRadius: 2, background: T.status[status].color }}
              />
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.status[status].pillText, width: 22 }}>{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Component icons (SVG) ────────────────────────────────────────────────────

function IconInverter({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function IconBattery({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
      <line x1="22" y1="11" x2="22" y2="13" />
      <line x1="6" y1="11" x2="6" y2="13" />
      <line x1="10" y1="11" x2="10" y2="13" />
    </svg>
  );
}
function IconSolar({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

const COMPONENT_ICONS: Record<string, (color: string) => React.ReactNode> = {
  inverter: (c) => <IconInverter color={c} />,
  battery:  (c) => <IconBattery color={c} />,
  solar:    (c) => <IconSolar color={c} />,
};

// ─── Component card ───────────────────────────────────────────────────────────

function ComponentCard({ label, data, delay = 0 }: { label: string; data: ComponentHealth; delay?: number }) {
  const s = T.status[data.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay }}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow accent in top-right corner */}
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80,
        borderRadius: '50%', background: s.glow, filter: 'blur(24px)', pointerEvents: 'none',
      }} />

      {/* Header: icon + label + arc */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Icon + title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: `${s.color}15`,
              border: `1px solid ${s.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {(COMPONENT_ICONS[data.type] ?? COMPONENT_ICONS['solar'])(s.color)}
            </div>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.01em' }}>
              {label}
            </span>
          </div>
          {/* Status pill */}
          <span style={{
            alignSelf: 'flex-start',
            fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600,
            padding: '2px 8px', borderRadius: 12,
            background: s.pillBg, color: s.pillText,
            border: `1px solid ${s.color}20`,
            letterSpacing: '0.04em',
          }}>
            {s.label}
          </span>
        </div>

        {/* Mini arc + score */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <ArcGauge score={data.health_score} status={data.status} size={72} strokeWidth={6} delay={delay + 0.1} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', paddingBottom: 8,
          }}>
            <CountUp
              to={data.health_score}
              delay={delay + 0.15}
              style={{
                fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700,
                color: s.color, letterSpacing: '-0.02em',
                textShadow: `0 0 12px ${s.glow}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: T.border }} />

      {/* Detail rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {Object.entries(data.details).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textSecondary, flexShrink: 0 }}>{key}</span>
            <span style={{
              fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600,
              color: T.textMono,
              letterSpacing: '0.02em',
              textAlign: 'right',
            }}>
              {val}
            </span>
          </div>
        ))}
        {data.age && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: T.textSecondary }}>Age</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.textMono, letterSpacing: '0.02em' }}>{data.age}</span>
          </div>
        )}
      </div>

      {/* Alert bar */}
      {data.alert && (
        <div style={{
          marginTop: 2,
          padding: '8px 10px',
          borderRadius: 8,
          background: `${s.color}0d`,
          border: `1px solid ${s.color}20`,
          fontFamily: FONT_BODY, fontSize: 11, color: s.pillText, lineHeight: 1.5,
        }}>
          <span style={{ marginRight: 5 }}>⚠</span>{data.alert}
        </div>
      )}
    </motion.div>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function SkeletonPulse({ style }: { style?: React.CSSProperties }) {
  return (
    <motion.div
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      style={{ borderRadius: 6, background: 'rgba(255,255,255,0.06)', ...style }}
    />
  );
}

function SkeletonPanel() {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 16, alignItems: 'center' }}>
        <SkeletonPulse style={{ width: 120, height: 120, borderRadius: '50%' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonPulse style={{ width: '55%', height: 18 }} />
          <SkeletonPulse style={{ width: '35%', height: 12 }} />
          <SkeletonPulse style={{ width: '40%', height: 12 }} />
        </div>
      </div>
      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[0, 1, 2].map(i => <SkeletonPulse key={i} style={{ height: 180 }} />)}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

// ─── Compact layout (for EnergyFlowHealthRow right column) ───────────────────

function CompactHealth({ data }: { data: HardwareHealthData }) {
  const overall = T.status[data.overall_status];
  const comps = [
    { label: 'Inverter',  d: data.inverter    },
    { label: 'Battery',   d: data.battery     },
    { label: 'PV String', d: data.solar_panel },
  ];
  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

      {/* Overall */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <ArcGauge score={data.overall_score} status={data.overall_status} size={80} strokeWidth={7} delay={0}/>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 8 }}>
            <CountUp to={data.overall_score} style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 700, color: overall.color, textShadow: `0 0 14px ${overall.glow}` }}/>
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 800, color: T.textPrimary, letterSpacing: '-0.01em' }}>Hardware Health</div>
          <div style={{
            display: 'inline-block', marginTop: 6,
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 8px', borderRadius: 20,
            background: overall.pillBg, color: overall.pillText,
            border: `1px solid ${overall.color}30`, textTransform: 'uppercase',
          }}>● {overall.label}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.textSecondary, marginTop: 6 }}>
            {new Date(data.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Component rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comps.map(({ label, d }, i) => {
          const s = T.status[d.status];
          return (
            <motion.div key={label}
              initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
                <ArcGauge score={d.health_score} status={d.status} size={48} strokeWidth={5} delay={0.1 + i * 0.1}/>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 }}>
                  <CountUp to={d.health_score} delay={0.1 + i * 0.1} style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: s.color }}/>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{label}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {Object.values(d.details)[0] ?? s.label}
                </div>
              </div>
              <span style={{
                fontFamily: FONT_MONO, fontSize: 8, padding: '2px 6px', borderRadius: 10,
                background: s.pillBg, color: s.pillText, border: `1px solid ${s.color}25`, flexShrink: 0,
              }}>{s.label}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Alert (if any) */}
      {[data.inverter, data.battery, data.solar_panel].find(c => c.alert) && (
        <div style={{
          marginTop: 'auto', padding: '8px 10px', borderRadius: 8,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)',
          fontFamily: FONT_BODY, fontSize: 10, color: '#fcd34d', lineHeight: 1.5,
        }}>
          ⚠ {[data.inverter, data.battery, data.solar_panel].find(c => c.alert)!.alert}
        </div>
      )}
    </div>
  );
}

// ─── Main panel (full standalone card) ───────────────────────────────────────

export function HardwareHealthPanel({ siteId, compact = false }: { siteId: string; compact?: boolean }) {
  const [data, setData] = useState<HardwareHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    apiService.getSiteHardwareHealth(siteId)
      .then(setData)
      .catch(() => setError('Could not load hardware health data'))
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <SkeletonPanel />;

  if (error || !data) {
    return (
      <div style={{
        background: compact ? 'transparent' : T.surface,
        border: compact ? 'none' : `1px solid ${T.border}`,
        borderRadius: compact ? 0 : 16,
        padding: '20px 24px', fontFamily: FONT_BODY, fontSize: 13, color: T.textSecondary,
      }}>
        {error ?? 'No health data available'}
      </div>
    );
  }

  if (compact) return <CompactHealth data={data} />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header banner with overall score */}
      <OverallBanner data={data} />

      {/* Component cards */}
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        <ComponentCard label="Inverter"  data={data.inverter}     delay={0.15} />
        <ComponentCard label="Battery"   data={data.battery}      delay={0.25} />
        <ComponentCard label="PV String" data={data.solar_panel}  delay={0.35} />
      </div>

      {/* Maintenance recommendations */}
      {data.maintenance_tips.length > 0 && (
        <div style={{
          margin: '0 16px 16px',
          padding: '12px 16px',
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
        }}>
          <div style={{
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 600,
            color: T.textSecondary, letterSpacing: '0.12em',
            textTransform: 'uppercase', marginBottom: 10,
          }}>
            Maintenance
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.maintenance_tips.map((tip, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.35 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
              >
                <span style={{ fontSize: 14, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>{tip.icon}</span>
                <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: T.textSecondary, flex: 1, lineHeight: 1.5 }}>
                  {tip.description}
                </span>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 9, color: T.textSecondary,
                  flexShrink: 0, marginTop: 2, letterSpacing: '0.05em',
                  padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${T.border}`,
                }}>
                  {tip.frequency}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
