/**
 * SolarObservatoryPanel — "Solar Observatory" hardware health panel
 * Glassmorphism command bar + bezel ring gauge + instrument tiles
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import type { HardwareHealthData, ComponentHealth } from '../../services/api';
import EnergyFlowBlock from '../../shared/components/EnergyFlow';
import ComponentDetailModalPremium from './ComponentDetailModalPremium';

// ─── Observatory design tokens ────────────────────────────────────────────────

const B_DARK = {
  canvas:  '#060b14',
  glass:   'rgba(6,11,20,0.85)',
  tile:    '#071020',
  border:  'rgba(255,255,255,0.07)',
  borderC: 'rgba(0,212,255,0.18)',

  value:   '#f0f8ff',
  label:   '#c4e0f8',
  dim:     '#9dc4e4',

  cyan:    '#00d4ff',
  cyanG:   'rgba(0,212,255,0.4)',
  cyanD:   'rgba(0,212,255,0.15)',

  mint:    '#10ffcb',  mintG:  'rgba(16,255,203,0.35)',
  amber:   '#fbbf24',  amberG: 'rgba(251,191,36,0.3)',
  red:     '#f87171',  redG:   'rgba(248,113,113,0.3)',

  invColor: '#60a5fa',  invG: 'rgba(96,165,250,0.3)',
  batColor: '#fbbf24',  batG: 'rgba(251,191,36,0.3)',
  pvColor:  '#10ffcb',  pvG:  'rgba(16,255,203,0.3)',
};

const B_LIGHT = {
  canvas:  '#f9fafb',
  glass:   'rgba(249,250,251,0.80)',
  tile:    '#ffffff',
  border:  'rgba(0,0,0,0.08)',
  borderC: 'rgba(59,130,246,0.20)',

  value:   '#0f172a',
  label:   '#374151',
  dim:     '#64748b',

  cyan:    '#0284c7',
  cyanG:   'rgba(2,132,199,0.15)',
  cyanD:   'rgba(2,132,199,0.08)',

  mint:    '#059669',  mintG:  'rgba(5,150,105,0.12)',
  amber:   '#d97706',  amberG: 'rgba(217,119,6,0.12)',
  red:     '#dc2626',  redG:   'rgba(220,38,38,0.12)',

  invColor: '#2563eb',  invG: 'rgba(37,99,235,0.12)',
  batColor: '#ca8a04',  batG: 'rgba(202,138,4,0.12)',
  pvColor:  '#059669',  pvG:  'rgba(5,150,105,0.12)',
};

const mkB = (isDark: boolean) => isDark ? B_DARK : B_LIGHT;

const SYNE = "'Outfit','Outfit',sans-serif";
const BODY = "'DM Sans',sans-serif";
const MONO = "'JetBrains Mono','Fira Code',monospace";

function bLabel(s: 0|1|2) { return ['EXCELLENT','NEEDS ATTN','CRITICAL'][s]; }

// ─── Live telemetry hook ──────────────────────────────────────────────────────

interface LiveValues {
  pvKw: number|null; loadKw: number|null;
  gridKw: number|null; battKw: number|null; battSoc: number|null;
}

function useLiveTelemetry(siteId: string) {
  const [values, setValues] = useState<LiveValues>({ pvKw:null, loadKw:null, gridKw:null, battKw:null, battSoc:null });
  const [age, setAge] = useState<string|null>(null);
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const go = async () => {
      try {
        const rows = await apiService.getSiteTelemetry(siteId, { days:1, aggregate:'none' });
        if (cancelled || !rows?.length) return;
        const r = rows[rows.length - 1];
        const pv = (Number(r.pv1_power_w??0)+Number(r.pv2_power_w??0)+Number(r.pv3_power_w??0)+Number(r.pv4_power_w??0))/1000;
        setValues({
          pvKw:    pv || null,
          loadKw:  r.load_power_w        != null ? Number(r.load_power_w)    / 1000 : null,
          gridKw:  r.grid_power_w        != null ? Number(r.grid_power_w)    / 1000 : null,
          battKw:  r.battery_power_w     != null ? Number(r.battery_power_w) / 1000 : null,
          battSoc: r.battery_soc_percent != null ? Number(r.battery_soc_percent)    : null,
        });
        if (r.timestamp) setAge(new Date(r.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }));
      } catch { /* silent */ }
    };
    go();
    const iv = setInterval(go, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [siteId]);
  return { values, age };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function cxy(deg: number, cx: number, cy: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function CountUp({ to, delay=0, style }: { to:number; delay?:number; style?:React.CSSProperties }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => Math.round(v));
  const [d, setD] = useState(0);
  useEffect(() => {
    const u = rounded.on('change', v => setD(v));
    const c = animate(mv, to, { duration:1.3, ease:[0.25,0.46,0.45,0.94], delay });
    return () => { c.stop(); u(); };
  }, [to]);
  return <span style={style}>{d}</span>;
}

function PulseDot({ color }: { color:string }) {
  return (
    <div style={{ position:'relative', width:8, height:8 }}>
      <motion.div
        animate={{ scale:[1,1.8,1], opacity:[1,0,1] }}
        transition={{ duration:2, repeat:Infinity, ease:'easeInOut' }}
        style={{ position:'absolute', inset:0, borderRadius:'50%', background:color, opacity:0.4 }}
      />
      <div style={{ position:'absolute', inset:1, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}` }}/>
    </div>
  );
}

// ─── Tick-mark bezel ring ─────────────────────────────────────────────────────

function TickRing({ cx, cy, r, count=36, B }: { cx:number; cy:number; r:number; count?:number; B:ReturnType<typeof mkB> }) {
  return (
    <g>
      {Array.from({ length:count }).map((_, i) => {
        const isMajor = i % 9 === 0;
        const isMed   = i % 3 === 0;
        const angle   = (i / count) * 360 - 90;
        const rad     = angle * Math.PI / 180;
        const len     = isMajor ? 9 : isMed ? 5 : 3;
        const w       = isMajor ? 1.5 : isMed ? 0.9 : 0.6;
        const opacity = isMajor ? 0.6 : isMed ? 0.3 : 0.15;
        const x1 = cx + (r - len) * Math.cos(rad), y1 = cy + (r - len) * Math.sin(rad);
        const x2 = cx + r * Math.cos(rad),          y2 = cy + r * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={B.cyan} strokeWidth={w} opacity={opacity} strokeLinecap="round"/>;
      })}
    </g>
  );
}

// ─── Observatory main ring ────────────────────────────────────────────────────

function ObservatoryRing({ score, size, B }: { score:number; size:number; B:ReturnType<typeof mkB> }) {
  const cx = size/2, cy = size/2;
  const tickR  = cx - 3;
  const bezelR = cx - 14;
  const arcR   = cx - 22;
  const stroke = 9;
  const s = cxy(225, cx, cy, arcR), e = cxy(135, cx, cy, arcR);
  const arcPath = `M ${s.x} ${s.y} A ${arcR} ${arcR} 0 1 1 ${e.x} ${e.y}`;
  const uid = useRef(`obs-${Math.random().toString(36).slice(2,7)}`).current;
  const mv = useMotionValue(0), offset = useTransform(mv, [0,100], [1,0]);
  useEffect(() => {
    const c = animate(mv, score, { duration:2.0, ease:[0.16,1,0.3,1], delay:0.2 });
    return () => c.stop();
  }, [score]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:'visible', display:'block' }}>
      <defs>
        <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b1"/>
          <feGaussianBlur stdDeviation="8" result="b2"/>
          <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={B.cyan} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={B.cyan} stopOpacity="1"/>
        </linearGradient>
        <radialGradient id={`${uid}-ambient`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={B.cyan} stopOpacity="0.06"/>
          <stop offset="100%" stopColor={B.cyan} stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={cx-2} fill={`url(#${uid}-ambient)`}/>
      <TickRing cx={cx} cy={cy} r={tickR} B={B}/>
      <circle cx={cx} cy={cy} r={bezelR} fill="none" stroke={B.borderC} strokeWidth="1" opacity="0.5"/>
      <circle cx={cx} cy={cy} r={arcR+stroke/2+3} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.75"/>
      <path d={arcPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeLinecap="round"/>
      <motion.path d={arcPath} fill="none" stroke={`url(#${uid}-grad)`} strokeWidth={stroke} strokeLinecap="round"
        pathLength={1} style={{ strokeDashoffset:offset, strokeDasharray:'1 1', filter:`url(#${uid}-glow)` }}/>
    </svg>
  );
}

function ObservatoryRingWithCount({ score, status, size, B }: { score:number; status:0|1|2; size:number; B:ReturnType<typeof mkB> }) {
  const sc = status===0 ? B.mint : status===1 ? B.amber : B.red;
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <ObservatoryRing score={score} size={size} B={B}/>
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        paddingBottom: size * 0.08,
      }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:1 }}>
          <CountUp to={score} delay={0.2} style={{
            fontFamily:SYNE, fontSize:24, fontWeight:900, color:B.cyan, lineHeight:1,
            letterSpacing:'-0.04em',
            textShadow:`0 0 12px ${B.cyanG}, 0 0 32px ${B.cyanD}`,
          }}/>
        </div>
        <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:B.label,
          letterSpacing:'0.14em', marginTop:8, textTransform:'uppercase' as const }}>HEALTH</span>
        <div style={{
          marginTop:size*0.05, padding:'2px 8px', borderRadius:20,
          background:`${sc}12`, border:`1px solid ${sc}30`,
          fontFamily:MONO, fontSize:size*0.055, fontWeight:700,
          letterSpacing:'0.08em', color:sc, textTransform:'uppercase' as const, whiteSpace:'nowrap',
        }}>{bLabel(status)}</div>
      </div>
    </div>
  );
}

// ─── Mini arc for instrument tiles ───────────────────────────────────────────

function MiniArc({ score, color, size }: { score:number; color:string; size:number }) {
  const cx = size/2, cy = size/2, r = cx - 4;
  const s = cxy(225, cx, cy, r), e = cxy(135, cx, cy, r);
  const path = `M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`;
  const uid = useRef(`ma-${Math.random().toString(36).slice(2,7)}`).current;
  const mv = useMotionValue(0), offset = useTransform(mv, [0,100], [1,0]);
  useEffect(() => {
    const c = animate(mv, score, { duration:1.6, ease:[0.16,1,0.3,1], delay:0.3 });
    return () => c.stop();
  }, [score]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:'visible', display:'block' }}>
      <defs>
        <filter id={uid} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d={path} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" strokeLinecap="round"/>
      <motion.path d={path} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        pathLength={1} style={{ strokeDashoffset:offset, strokeDasharray:'1 1', filter:`url(#${uid})` }}/>
    </svg>
  );
}

// ─── Component detail modal (REDESIGNED - uses ComponentDetailModalPremium) ───

// ─── Instrument tile ──────────────────────────────────────────────────────────

const COMP_META = [
  { key:'inverter' as const,    icon:'⚡', label:'Inverter'  },
  { key:'battery' as const,     icon:'▣',  label:'Battery'   },
  { key:'solar_panel' as const, icon:'☀',  label:'PV String' },
];

function InstrumentTile({ comp, data, delay, B }: {
  comp: typeof COMP_META[number]; data: ComponentHealth; delay: number; B:ReturnType<typeof mkB>;
}) {
  const sc = data.status===0 ? B.mint : data.status===1 ? B.amber : B.red;
  const color = comp.key==='inverter' ? B.invColor : comp.key==='battery' ? B.batColor : B.pvColor;
  const glow = comp.key==='inverter' ? B.invG : comp.key==='battery' ? B.batG : B.pvG;
  const [open, setOpen] = useState(false);
  const detailEntries = Object.entries(data.details).slice(0, 2);

  return (
    <>
      <motion.div
        initial={{ opacity:0, y:14, scale:0.96 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ delay, duration:0.5, type:'spring', stiffness:280, damping:26 }}
        whileHover={{ scale:1.03, transition:{ duration:0.15 } }}
        onClick={() => setOpen(true)}
        style={{
          flex:1, background:B.tile, borderRadius:14, overflow:'hidden',
          border:`1px solid ${B.border}`, position:'relative', cursor:'pointer',
          boxShadow:`inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.5)`,
        }}>

        <div style={{ height:3, background:`linear-gradient(90deg,${color}cc,${color}44)`,
          boxShadow:`0 2px 12px ${glow}` }}/>

        <div style={{ position:'absolute', top:12, right:12 }}><PulseDot color={sc}/></div>

        <div style={{
          position:'absolute', top:-20, left:'50%', transform:'translateX(-50%)',
          width:80, height:40, borderRadius:'50%',
          background:glow, filter:'blur(20px)', pointerEvents:'none', opacity:0.5,
        }}/>

        <div style={{ padding:'12px 14px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:10 }}>
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background:`${color}14`, border:`1px solid ${color}25`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
            }}>{comp.icon}</div>
            <div style={{ fontFamily:MONO, fontSize:9, fontWeight:700, color:B.label,
              letterSpacing:'0.12em', textTransform:'uppercase' as const }}>{comp.label}</div>
          </div>

          <div style={{ position:'relative', width:88, height:88, margin:'6px auto 10px' }}>
            <MiniArc score={data.health_score} color={color} size={88}/>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
              justifyContent:'center', paddingBottom:8 }}>
              <CountUp to={data.health_score} delay={delay+0.1} style={{
                fontFamily:MONO, fontSize:20, fontWeight:800, color:color,
              }}/>
            </div>
          </div>

          <div style={{ height:'1px', background:`${color}15`, margin:'6px 0' }}/>

          {detailEntries.map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:5 }}>
              <span style={{ fontFamily:MONO, fontSize:8, color:B.dim, letterSpacing:'0.06em',
                textTransform:'uppercase' as const, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k}</span>
              <span style={{ fontFamily:MONO, fontSize:9, fontWeight:700, color:B.label, marginLeft:8, flexShrink:0 }}>{v}</span>
            </div>
          ))}

          <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:5,
              padding:'3px 8px', borderRadius:20,
              background:`${sc}10`, border:`1px solid ${sc}28`,
              fontFamily:MONO, fontSize:8, fontWeight:700, color:sc,
              letterSpacing:'0.08em', textTransform:'uppercase' as const,
            }}>
              <span style={{ width:4, height:4, borderRadius:'50%', background:sc, flexShrink:0, boxShadow:`0 0 4px ${sc}` }}/>
              {bLabel(data.status)}
            </div>
            <span style={{ fontFamily:MONO, fontSize:8, color:B.dim }}>tap for details →</span>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {open && <ComponentDetailModalPremium component={{...comp, color, glow}} data={data} onClose={() => setOpen(false)}/>}
      </AnimatePresence>
    </>
  );
}

// ─── Scanline animation ───────────────────────────────────────────────────────

function ScanLine({ B }: { B:ReturnType<typeof mkB> }) {
  return (
    <>
      <style>{`
        @keyframes b-scan {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(250%); opacity: 0; }
        }
      `}</style>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', borderRadius:'inherit' }}>
        <div style={{
          position:'absolute', top:0, bottom:0, left:0, width:'35%',
          background:`linear-gradient(90deg,transparent,${B.cyanD},transparent)`,
          animation:'b-scan 4s ease-in-out infinite', animationDelay:'2s',
        }}/>
      </div>
    </>
  );
}

// ─── Observatory health right panel ──────────────────────────────────────────

function HealthPane({ healthData, healthLoading, B }: { healthData: HardwareHealthData|null; healthLoading: boolean; B:ReturnType<typeof mkB> }) {
  if (healthLoading) return <Skeleton B={B}/>;
  if (!healthData) return (
    <div style={{ padding:32, fontFamily:BODY, fontSize:13, color:B.dim,
      background:B.canvas, textAlign:'center' }}>
      Health data unavailable
    </div>
  );

  const alert = [healthData.inverter, healthData.battery, healthData.solar_panel].find(c => c.alert);

  return (
    <div style={{
      background:B.canvas,
      backgroundImage:`
        radial-gradient(ellipse 60% 40% at 50% 20%, rgba(0,212,255,0.04) 0%, transparent 70%),
        linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)
      `,
      backgroundSize:'auto, 32px 32px, 32px 32px',
    }}>
      <div style={{
        padding:'12px 20px 8px', borderBottom:`1px solid ${B.border}`,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:'0.14em',
          textTransform:'uppercase' as const, color:B.dim }}>Equipment Health · 7-day</div>
        <div style={{ display:'flex', alignItems:'center', gap:5,
          fontFamily:MONO, fontSize:8, color:B.cyan, letterSpacing:'0.08em' }}>
          <PulseDot color={B.cyan}/>
          MONITORING
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'22px 16px 16px' }}>
        <motion.div
          initial={{ opacity:0, scale:0.85 }}
          animate={{ opacity:1, scale:1 }}
          transition={{ duration:0.7, ease:[0.16,1,0.3,1] }}>
          <ObservatoryRingWithCount
            score={healthData.overall_score}
            status={healthData.overall_status}
            size={160}
            B={B}
          />
        </motion.div>
      </div>

      <div style={{ display:'flex', gap:10, padding:'0 16px 16px' }}>
        {COMP_META.map((c, i) => {
          const data = c.key==='inverter' ? healthData.inverter
                     : c.key==='battery'  ? healthData.battery
                     : healthData.solar_panel;
          return <InstrumentTile key={c.key} comp={c} data={data} delay={0.15 + i*0.1} B={B}/>;
        })}
      </div>

      {alert && (
        <motion.div
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.55 }}
          style={{
            margin:'0 16px 16px', padding:'9px 14px', borderRadius:8,
            background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.2)',
            borderLeft:`3px solid ${B.amber}`,
            display:'flex', alignItems:'flex-start', gap:8,
          }}>
          <span style={{ fontSize:12, flexShrink:0, marginTop:1 }}>⚠</span>
          <span style={{ fontFamily:BODY, fontSize:11, color:'#fcd34d', lineHeight:1.55 }}>{alert.alert}</span>
        </motion.div>
      )}

      {healthData.maintenance_tips.length > 0 && (
        <div style={{ margin:'0 16px 18px', padding:'12px 14px', borderRadius:10,
          background:'rgba(255,255,255,0.02)', border:`1px solid ${B.border}` }}>
          <div style={{ fontFamily:MONO, fontSize:8, letterSpacing:'0.12em',
            textTransform:'uppercase' as const, color:B.dim, marginBottom:10 }}>Maintenance</div>
          {healthData.maintenance_tips.map((tip, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginTop: i>0 ? 8 : 0 }}>
              <span style={{ fontSize:13, flexShrink:0 }}>{tip.icon}</span>
              <span style={{ fontFamily:BODY, fontSize:11, color:B.label, flex:1, lineHeight:1.5 }}>{tip.description}</span>
              <span style={{ fontFamily:MONO, fontSize:8, color:B.dim, flexShrink:0, alignSelf:'center' }}>{tip.frequency}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ B }: { B:ReturnType<typeof mkB> }) {
  const pulse = { animate:{ opacity:[0.04,0.1,0.04] }, transition:{ duration:2, repeat:Infinity } };
  return (
    <div style={{ padding:20, display:'flex', flexDirection:'column', gap:16, background:B.canvas }}>
      <div style={{ display:'flex', justifyContent:'center' }}>
        <motion.div {...pulse} style={{ width:160, height:160, borderRadius:'50%', background:B.cyan }}/>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {[0,1,2].map(i => <motion.div key={i} {...pulse} style={{ flex:1, height:200, borderRadius:14, background:B.cyan }}/>)}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props { siteId: string; inverterCapacityKw?: number|null; smartDevices?: any[]; }

export function EnergyFlowHealthRow({ siteId, smartDevices = [] }: Props) {
  const { isDark } = useTheme();
  const B = mkB(isDark);
  const { values, age } = useLiveTelemetry(siteId);
  const [healthData, setHealthData] = useState<HardwareHealthData|null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setHealthLoading(true);
    apiService.getSiteHardwareHealth(siteId)
      .then(d => { setHealthData(d); setHealthLoading(false); })
      .catch(() => setHealthLoading(false));
  }, [siteId]);

  const fmtKw  = (v:number|null) => v != null ? `${Math.abs(v).toFixed(1)}` : '—';
  const fmtPct = (v:number|null) => v != null ? `${Math.round(v)}` : '—';

  const stats = [
    { label:'Health',  v: healthData ? `${healthData.overall_score}%` : '—', unit:'',   color:B.cyan    },
    { label:'Solar',   v: fmtKw(values.pvKw),                                unit:'kW', color:B.pvColor },
    { label:'Battery', v: fmtPct(values.battSoc),                            unit:'%',  color:B.batColor },
    { label:'Load',    v: fmtKw(values.loadKw),                              unit:'kW', color:'#a78bfa' },
  ];

  return (
    <motion.div
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.35, ease:[0.25,0.46,0.45,0.94] }}>

      <div style={{
        borderRadius:16, overflow:'hidden',
        boxShadow:`0 0 0 1px ${B.borderC}, 0 24px 64px rgba(0,0,0,0.7), 0 0 80px rgba(0,212,255,0.04)`,
      }}>

        {/* Glassmorphism command bar */}
        <div style={{
          position:'relative', overflow:'hidden',
          background:B.glass,
          backdropFilter:'blur(20px) saturate(160%)',
          WebkitBackdropFilter:'blur(20px) saturate(160%)',
          borderBottom:`1px solid ${B.borderC}`,
          padding:'11px 20px',
        }}>
          <ScanLine B={B}/>
          <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontFamily:SYNE, fontSize:14, fontWeight:800, color:B.value,
                letterSpacing:'-0.02em', textShadow:`0 0 20px rgba(232,244,255,0.2)` }}>{siteId}</span>
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 8px',
                borderRadius:20, background:`rgba(0,212,255,0.1)`, border:`1px solid ${B.borderC}` }}>
                <PulseDot color={B.cyan}/>
                <span style={{ fontFamily:MONO, fontSize:8, color:B.cyan, letterSpacing:'0.1em', fontWeight:700 }}>LIVE</span>
                {age && <span style={{ fontFamily:MONO, fontSize:8, color:B.dim }}>· {age}</span>}
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {stats.map(s => (
                <div key={s.label} style={{
                  padding:'5px 12px', borderRadius:8,
                  background:`${s.color}0e`, border:`1px solid ${s.color}25`,
                  textAlign:'center', minWidth:52,
                }}>
                  <div style={{ fontFamily:MONO, fontSize:13, fontWeight:700, color:s.color, lineHeight:1 }}>
                    {s.v}<span style={{ fontSize:8, opacity:0.7, marginLeft:1 }}>{s.unit}</span>
                  </div>
                  <div style={{ fontFamily:BODY, fontSize:8, color:B.dim, marginTop:2, letterSpacing:'0.04em' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Two-panel body: energy flow left | health observatory right */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>

          {/* Left — live energy flow */}
          <div style={{
            background:B.canvas,
            backgroundImage:`
              linear-gradient(rgba(0,212,255,0.022) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,212,255,0.022) 1px, transparent 1px)
            `,
            backgroundSize:'32px 32px',
            borderRight:`1px solid ${B.borderC}`,
            display:'flex', flexDirection:'column',
          }}>
            <div style={{ padding:'10px 16px 0', fontFamily:MONO, fontSize:9,
              letterSpacing:'0.12em', textTransform:'uppercase' as const, color:B.dim }}>
              LIVE POWER FLOW
            </div>
            <div style={{ flex:1, padding:'0 4px 4px', minWidth:0 }}>
              <EnergyFlowBlock
                pvKw={values.pvKw} loadKw={values.loadKw}
                gridKw={values.gridKw} battKw={values.battKw}
                battSoc={values.battSoc} siteId={siteId}
                smartDevices={smartDevices}
              />
            </div>
          </div>

          {/* Right — observatory health */}
          <HealthPane healthData={healthData} healthLoading={healthLoading} B={B}/>

        </div> {/* end two-panel grid */}
      </div>
    </motion.div>
  );
}
