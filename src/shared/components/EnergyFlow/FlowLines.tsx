import React, { useEffect, useState } from 'react';
import { Anchors, flowPaths, lineWidth } from './flowModel';

// Only three hues: amber solar, green battery, blue grid (buying and selling alike). Every load line is neutral grey.
export const FLOW_COLORS = { solar: '#f5b942', batt: '#3FB9B2', grid: '#5b8def', load: '#94a3b8' };
const COLORS = { ...FLOW_COLORS, idle: '#6b7684' };

export interface FlowKw {
  solar: number; gridIn: number; gridOut: number; battIn: number; battOut: number;
  loads: number[]; // Backup, [EV,] Grid direct (kW drawn); two entries when there is no EV plug
}
type Paths = ReturnType<typeof flowPaths>;

const Marker: React.FC<{ id: string; color: string }> = ({ id, color }) => (
  <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M0 1 L9 5 L0 9Z" fill={color} />
  </marker>
);

function Line({ flow, d, kw, color, id }: { flow: string; d: string; kw: number; color: string; id: string }) {
  const on = kw > 0.001;
  const w = lineWidth(kw);
  const c = on ? color : COLORS.idle;
  return (
    <g>
      <path data-track data-flow={flow} d={d} fill="none" stroke={c} strokeOpacity={on ? 0.18 : 0.35} strokeWidth={on ? w + 2 : 2} strokeLinecap="round" />
      {on && (
        <path data-flow={flow} data-anim="1" d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round"
          strokeDasharray="2 13" style={{ animation: 'efFlow 1.4s linear infinite' }} />
      )}
      <path d={d} fill="none" stroke="none" markerEnd={`url(#${id})`} />
    </g>
  );
}

export function LineSet({ paths, kw }: { paths: Paths; kw: FlowKw }) {
  return (
    <>
      <defs>
        <Marker id="efa-solar" color={COLORS.solar} /><Marker id="efa-batt" color={COLORS.batt} />
        <Marker id="efa-grid" color={COLORS.grid} /><Marker id="efa-load" color={COLORS.load} />
        <Marker id="efa-idle" color={COLORS.idle} />
        <style>{`@keyframes efFlow{to{stroke-dashoffset:-30}} @media (prefers-reduced-motion: reduce){[data-anim]{animation:none!important}}`}</style>
      </defs>
      <Line flow="solar" d={paths.solar} kw={kw.solar} color={COLORS.solar} id="efa-solar" />
      <Line flow="battIn" d={paths.battIn} kw={kw.battIn} color={COLORS.batt} id="efa-batt" />
      <Line flow="battOut" d={paths.battOut} kw={kw.battOut} color={COLORS.batt} id="efa-batt" />
      <Line flow="gridIn" d={paths.gridIn} kw={kw.gridIn} color={COLORS.grid} id="efa-grid" />
      <Line flow="gridOut" d={paths.gridOut} kw={kw.gridOut} color={COLORS.grid} id="efa-grid" />
      {paths.loads.map((d, i) => <Line key={i} flow={`load${i}`} d={d} kw={kw.loads[i] ?? 0} color={COLORS.load} id="efa-load" />)}
    </>
  );
}

interface Props {
  container: React.RefObject<HTMLElement>;
  solar: React.RefObject<HTMLElement>; batt: React.RefObject<HTMLElement>; grid: React.RefObject<HTMLElement>;
  ring: React.RefObject<HTMLElement>;
  loads: React.RefObject<HTMLElement>[];
  kw: FlowKw;
}

export default function FlowLines({ container, solar, batt, grid, ring, loads, kw }: Props) {
  const [anchors, setAnchors] = useState<Anchors | null>(null);
  // A passive effect, not a layout effect: this component renders before the boxes it measures, and React
  // attaches a parent's and later siblings' refs after an earlier child's layout effect has run.
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const o = root.getBoundingClientRect();
      const rel = (el: HTMLElement | null, edge: 'top' | 'bottom') => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left - o.left + r.width / 2, y: (edge === 'top' ? r.top : r.bottom) - o.top };
      };
      const rr = ring.current?.getBoundingClientRect();
      const s = rel(solar.current, 'bottom'), b = rel(batt.current, 'bottom'), g = rel(grid.current, 'bottom');
      const l = loads.map(x => rel(x.current, 'top'));
      if (!rr || !s || !b || !g || l.some(x => !x)) return;
      setAnchors({
        solar: s, batt: b, grid: g,
        ring: { cx: rr.left - o.left + rr.width / 2, cy: rr.top - o.top + rr.height / 2, r: rr.width / 2 },
        loads: l as Anchors['loads'],
      });
    };
    measure();
    // Watch the panel and every anchored box: when the container query flips the layout (or the ring's
    // clamp() size changes) a card can move or resize while the panel keeps its width.
    const ro = new ResizeObserver(measure);
    [root, ring.current, solar.current, batt.current, grid.current, ...loads.map(x => x.current)]
      .forEach(el => { if (el) ro.observe(el); });
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!anchors) return null;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
      <LineSet paths={flowPaths(anchors)} kw={kw} />
    </svg>
  );
}
