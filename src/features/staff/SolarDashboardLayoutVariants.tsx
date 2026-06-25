/**
 * Layout variants preview — Energy Flow + Hardware Health side-by-side
 * Three variants. Not used in production; for design review only.
 *
 * Preview: temporarily add <Route path="/variants" element={<SolarDashboardLayoutVariants/>}/>
 */

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:       '#08111e',
  surface:  '#0d1828',
  card:     '#111f33',
  card2:    '#152640',
  border:   '#1c2f47',
  text:     '#dde6f0',
  muted:    '#3d5470',
  dim:      '#26395a',
  emerald:  '#34d399',
  amber:    '#fbbf24',
  blue:     '#60a5fa',
  violet:   '#a78bfa',
  emeraldG: 'rgba(52,211,153,0.3)',
  amberG:   'rgba(251,191,36,0.25)',
  blueG:    'rgba(96,165,250,0.25)',
};

const SYNE  = "'Outfit', sans-serif";
const BODY  = "'DM Sans', sans-serif";
const MONO  = "'JetBrains Mono', monospace";

// ─── Arc gauge ────────────────────────────────────────────────────────────────

function xy(deg: number, cx: number, cy: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function ArcGauge({ score, color, glow, size, stroke = 7, delay = 0 }:
  { score: number; color: string; glow: string; size: number; stroke?: number; delay?: number }) {
  const cx = size / 2, cy = size / 2, r = cx - stroke / 2 - 2;
  const s = xy(225, cx, cy, r), e = xy(135, cx, cy, r);
  const path = `M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`;
  const fid = `g${size}${color.slice(1)}`;
  const mv = useMotionValue(0);
  const offset = useTransform(mv, [0, 100], [1, 0]);
  useEffect(() => { const c = animate(mv, score, { duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94], delay }); return () => c.stop(); }, [score]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <filter id={fid} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d={path} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} strokeLinecap="round"/>
      <motion.path d={path} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        pathLength={1} style={{ strokeDashoffset: offset, strokeDasharray: '1 1', filter: `url(#${fid})` }}/>
    </svg>
  );
}

function CountUp({ to, delay = 0, style }: { to: number; delay?: number; style?: React.CSSProperties }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => Math.round(v));
  const [d, setD] = useState(0);
  useEffect(() => {
    const u = rounded.on('change', v => setD(v));
    const c = animate(mv, to, { duration: 1.3, ease: [0.25, 0.46, 0.45, 0.94], delay });
    return () => { c.stop(); u(); };
  }, [to]);
  return <span style={style}>{d}</span>;
}

// ─── Energy Flow Diagram — fixed 480×240 viewBox, constrained container ───────
// The diagram is UNCHANGED in content; only the container controls its size.

function EnergyFlowDiagram() {
  const nodes = [
    { id: 'pv',  x: 72,  y: 54,  label: 'Solar PV',  sub: '3.2 kW',  color: C.amber,   icon: '☀' },
    { id: 'inv', x: 224, y: 135, label: 'Inverter',   sub: '8 kVA',   color: C.blue,    icon: '⚡' },
    { id: 'bat', x: 72,  y: 216, label: 'Battery',    sub: '82% SOC', color: C.emerald, icon: '▣' },
    { id: 'grd', x: 376, y: 54,  label: 'Grid',       sub: '0.0 kW',  color: C.muted,   icon: '⊞' },
    { id: 'ld',  x: 376, y: 216, label: 'Home',       sub: '1.8 kW',  color: C.violet,  icon: '⌂' },
  ];
  const beams = [
    { x1: 72, y1: 54,  x2: 224, y2: 135, color: C.amber,   on: true  },
    { x1: 72, y1: 216, x2: 224, y2: 135, color: C.emerald, on: true  },
    { x1: 224, y1: 135, x2: 376, y2: 216, color: C.violet, on: true  },
    { x1: 224, y1: 135, x2: 376, y2: 54,  color: C.muted,  on: false },
  ];
  return (
    // Aspect-ratio box: 480:270 → height = width × 270/480 = 56.25%
    <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}>
      <svg viewBox="0 0 448 252" preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          {beams.map((b, i) => (
            <linearGradient key={i} id={`bg${i}`}
              x1={b.x1/448} y1={b.y1/252} x2={b.x2/448} y2={b.y2/252} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={b.color} stopOpacity="0.7"/>
              <stop offset="100%" stopColor={b.color} stopOpacity="0.15"/>
            </linearGradient>
          ))}
          <filter id="fg"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <style>{`@keyframes fd{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}`}</style>
        {beams.map((b, i) => (
          <g key={i}>
            <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"/>
            {b.on && <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
              stroke={`url(#bg${i})`} strokeWidth="2" strokeDasharray="7 13"
              filter="url(#fg)" style={{ animation: 'fd 1.1s linear infinite' }}/>}
          </g>
        ))}
        {nodes.map(n => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            <circle r="26" fill={C.card2} stroke={n.color} strokeWidth="1.5" opacity="0.95"/>
            <circle r="22" fill={`${n.color}10`}/>
            <circle r="26" fill="none" stroke={n.color} strokeWidth="5" opacity="0.12" filter="url(#fg)"/>
            <text textAnchor="middle" y="5" fontSize="13" fill={n.color}>{n.icon}</text>
            <text textAnchor="middle" y="42" fontSize="8" fill={C.text} fontFamily={BODY} fontWeight="600">{n.label}</text>
            <text textAnchor="middle" y="52" fontSize="7" fill={C.muted} fontFamily={MONO}>{n.sub}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Health data ──────────────────────────────────────────────────────────────

const OVERALL = { score: 86, color: C.emerald, glow: C.emeraldG };
const COMPS = [
  { label: 'Inverter',  score: 92, color: C.emerald, glow: C.emeraldG, detail: '49°C avg', delay: 0.05 },
  { label: 'Battery',   score: 77, color: C.amber,   glow: C.amberG,   detail: '7% min SOC', delay: 0.15 },
  { label: 'PV String', score: 91, color: C.emerald, glow: C.emeraldG, detail: 'PR 91%', delay: 0.25 },
];

// ─── Shared sub-components ────────────────────────────────────────────────────

function OverallRing({ size, delay = 0 }: { size: number; delay?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <ArcGauge score={OVERALL.score} color={OVERALL.color} glow={OVERALL.glow} size={size} stroke={size > 80 ? 9 : 7} delay={delay}/>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: size * 0.1 }}>
        <CountUp to={OVERALL.score} delay={delay} style={{ fontFamily: MONO, fontSize: size * 0.22, fontWeight: 700, color: OVERALL.color, lineHeight: 1 }}/>
        <span style={{ fontFamily: BODY, fontSize: size * 0.09, color: C.muted, marginTop: 2 }}>HEALTH</span>
      </div>
    </div>
  );
}

function MiniArc({ c }: { c: typeof COMPS[0] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
        <ArcGauge score={c.score} color={c.color} glow={c.glow} size={48} stroke={5} delay={c.delay}/>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 }}>
          <CountUp to={c.score} delay={c.delay} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c.color }}/>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: C.text }}>{c.label}</div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 1 }}>{c.detail}</div>
      </div>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
      padding: '3px 8px', borderRadius: 20, background: `${C.emerald}14`, color: C.emerald,
      border: `1px solid ${C.emerald}30`, textTransform: 'uppercase' }}>
      ● {label}
    </span>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — Compact 58/42 split
// Flow diagram constrained to its natural aspect ratio on the left.
// Health panel right: overall ring + stacked mini arcs.
// ─────────────────────────────────────────────────────────────────────────────

export function VariantA() {
  return (
    <div style={{ fontFamily: BODY, background: C.bg, minHeight: '100vh', padding: '20px 24px' }}>
      <div style={{ marginBottom: 10, fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase' }}>
        A — Compact split · 58 / 42
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '58fr 42fr',
        gap: 0,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}>

        {/* LEFT: Flow diagram */}
        <div style={{ padding: '18px 20px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 800, color: C.text }}>Energy Flow</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 2 }}>LIVE · 10:32 AM</div>
            </div>
            <StatusPill label="3.2 kW generating" />
          </div>
          {/* Diagram in its own aspect-ratio box — no fixed height needed */}
          <EnergyFlowDiagram />
        </div>

        {/* RIGHT: Health */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <OverallRing size={80}/>
            <div>
              <div style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 800, color: C.text }}>Hardware</div>
              <div style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 800, color: C.text }}>Health</div>
              <div style={{ marginTop: 6 }}><StatusPill label="Excellent" /></div>
            </div>
          </div>

          <div style={{ height: 1, background: C.border }}/>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionLabel>Components · 7-day window</SectionLabel>
            {COMPS.map(c => <MiniArc key={c.label} c={c}/>)}
          </div>

          <div style={{ marginTop: 'auto', padding: '10px 12px', borderRadius: 8,
            background: `${C.amber}0e`, border: `1px solid ${C.amber}20`,
            fontFamily: BODY, fontSize: 10, color: '#fcd34d', lineHeight: 1.5 }}>
            ⚠ Battery SOC dipped to 7% — check discharge schedule
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — Unified command bar + 50/50 panels
// Thin top bar with key metrics spanning both panels.
// Flow left, health right — both same height, diagram constrained.
// ─────────────────────────────────────────────────────────────────────────────

export function VariantB() {
  const stats = [
    { label: 'Health', value: '86', unit: '%',   color: C.emerald },
    { label: 'PV',     value: '3.2', unit: 'kW', color: C.amber   },
    { label: 'Battery',value: '82',  unit: '%',  color: C.emerald },
    { label: 'Load',   value: '1.8', unit: 'kW', color: C.violet  },
  ];

  return (
    <div style={{ fontFamily: BODY, background: C.bg, minHeight: '100vh', padding: '20px 24px' }}>
      <div style={{ marginBottom: 10, fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase' }}>
        B — Unified header + 50 / 50
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>

        {/* Command bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px',
          borderBottom: `1px solid ${C.border}`,
          background: `linear-gradient(90deg, ${C.card} 0%, ${C.surface} 100%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>coim_002</span>
            <StatusPill label="Online" />
          </div>
          <div style={{ display: 'flex', gap: 22 }}>
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                  {s.value}<span style={{ fontSize: 8, marginLeft: 2 }}>{s.unit}</span>
                </div>
                <div style={{ fontFamily: BODY, fontSize: 9, color: C.muted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* Flow */}
          <div style={{ padding: '16px 18px', borderRight: `1px solid ${C.border}` }}>
            <SectionLabel>Live power flow</SectionLabel>
            <EnergyFlowDiagram />
          </div>

          {/* Health */}
          <div style={{ padding: '16px 18px' }}>
            <SectionLabel>Equipment health · 7d</SectionLabel>

            {/* Overall ring centered */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <OverallRing size={96} delay={0}/>
            </div>

            {/* 3 mini arc cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {COMPS.map(c => (
                <div key={c.label} style={{
                  textAlign: 'center', background: C.card, borderRadius: 10,
                  padding: '10px 6px', border: `1px solid ${C.border}`,
                }}>
                  <div style={{ position: 'relative', width: 52, height: 52, margin: '0 auto' }}>
                    <ArcGauge score={c.score} color={c.color} glow={c.glow} size={52} stroke={5} delay={c.delay}/>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 5 }}>
                      <CountUp to={c.score} delay={c.delay} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: c.color }}/>
                    </div>
                  </div>
                  <div style={{ fontFamily: BODY, fontSize: 10, color: C.muted, marginTop: 6 }}>{c.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginTop: 2 }}>{c.detail}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8,
              background: `${C.amber}0e`, border: `1px solid ${C.amber}1e`,
              fontFamily: BODY, fontSize: 10, color: '#fcd34d', lineHeight: 1.5 }}>
              ⚠ Battery SOC reached 7% — review discharge schedule
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT C — Health strip top + full-width flow
// 4 slim KPI cards with arcs across the top.
// Flow diagram below at full width — most space for the diagram.
// ─────────────────────────────────────────────────────────────────────────────

export function VariantC() {
  const kpis = [
    { label: 'System Health', score: OVERALL.score, color: C.emerald, glow: C.emeraldG, sub: 'Excellent', delay: 0 },
    ...COMPS.map(c => ({ ...c, sub: c.detail })),
  ];

  return (
    <div style={{ fontFamily: BODY, background: C.bg, minHeight: '100vh', padding: '20px 24px' }}>
      <div style={{ marginBottom: 10, fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: C.muted, textTransform: 'uppercase' }}>
        C — Health strip + full-width flow
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Health KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {kpis.map((k, i) => (
            <motion.div key={k.label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                position: 'relative', overflow: 'hidden',
              }}>
              {/* glow splash */}
              <div style={{ position: 'absolute', top: -20, right: -20, width: 56, height: 56,
                borderRadius: '50%', background: k.glow, filter: 'blur(18px)', pointerEvents: 'none' }}/>
              <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                <ArcGauge score={k.score} color={k.color} glow={k.glow} size={44} stroke={4} delay={k.delay}/>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 }}>
                  <CountUp to={k.score} delay={k.delay} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: k.color }}/>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: BODY, fontSize: 11, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.label}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 2 }}>{k.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Full-width flow panel */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 800, color: C.text }}>Live Energy Flow</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>☀ 3.2 kW</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.emerald }}>▣ 82%</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.violet }}>⌂ 1.8 kW</span>
            </div>
          </div>
          {/* Constrain diagram to max 520px wide, centered */}
          <div style={{ padding: '16px 40px', maxWidth: 560, margin: '0 auto' }}>
            <EnergyFlowDiagram />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────

const VARIANTS = [
  { id: 'A', label: 'A — 58/42 Split',        Component: VariantA },
  { id: 'B', label: 'B — Unified Header',      Component: VariantB },
  { id: 'C', label: 'C — Strip + Full Flow',   Component: VariantC },
];

export default function SolarDashboardLayoutVariants() {
  const [active, setActive] = useState('A');
  const { Component } = VARIANTS.find(v => v.id === active)!;

  return (
    <div style={{ background: '#050c16', minHeight: '100vh' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: '10px 24px 0', borderBottom: `1px solid ${C.border}`, background: '#07101e' }}>
        {VARIANTS.map(v => (
          <button key={v.id} onClick={() => setActive(v.id)} style={{
            padding: '7px 18px', borderRadius: '8px 8px 0 0',
            border: '1px solid', borderBottom: 'none', cursor: 'pointer',
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
            background: active === v.id ? C.surface : 'transparent',
            borderColor: active === v.id ? C.border : 'transparent',
            color: active === v.id ? C.text : C.muted,
            transition: 'all 0.15s',
          }}>
            {v.label}
          </button>
        ))}
      </div>
      <Component />
    </div>
  );
}
