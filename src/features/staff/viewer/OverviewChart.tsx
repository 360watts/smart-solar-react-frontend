import React, { useMemo, useRef, useState } from 'react';
import { colorsFor, DETAIL_MS, duration, hexCode, nearestIndex, niceTicks, segments, val, type ChartReading, type Series } from './deviceChart';

// One time axis for the plot, the reporting lane and the codes lane (spec §5.3).
const X0 = 60, X1 = 988, Y0 = 14, Y1 = 206, W = X1 - X0;
const LANE_Y = 222, CODE_Y = 255;
const clockFmt = (ms: number, withDay: boolean) =>
  new Date(ms).toLocaleString('en-IN', withDay ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false } : { hour: '2-digit', minute: '2-digit', hour12: false });
const secFmt = (ms: number) => new Date(ms).toLocaleTimeString('en-IN', { hour12: false });
const dp = (u: string) => (u === 'Hz' || u === '' ? 2 : u === 'V' || u === '°C' || u === 'A' ? 1 : 0);
const num = (v: number, unit: string) => v.toLocaleString('en-IN', { maximumFractionDigits: dp(unit) });

export default function OverviewChart({ data, reading }: { data: Series; reading: ChartReading }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const start = Date.parse(data.range_start), end = Date.parse(data.range_end), span = end - start || 1;
  const agg = data.detail !== 'every';
  const colors = useMemo(() => colorsFor(reading.names), [reading.names]);
  const X = (t: number) => X0 + ((t - start) / span) * W;

  const pts = useMemo(() => data.series.filter(p => reading.keys.some(k => val(p, k) !== undefined)), [data.series, reading.keys]);
  const scale = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) for (const k of reading.keys) {
      const v = val(p, k); if (v === undefined) continue;
      lo = Math.min(lo, val(p, `${k}__min`) ?? v); hi = Math.max(hi, val(p, `${k}__max`) ?? v);
    }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    if (reading.id === 'soc') { lo = 0; hi = 100; }
    return niceTicks(lo, hi, reading.zero);
  }, [pts, reading]);
  const Y = (v: number) => Y1 - ((v - scale.a) / (scale.b - scale.a)) * (Y1 - Y0);
  const maxGap = agg ? DETAIL_MS[data.detail] * 1.5 : Math.max(6000, (data.median_gap_s ?? 2) * 3000);
  const dec = scale.step >= 1 ? 0 : (String(scale.step).split('.')[1] ?? '').length;

  const ts = useMemo(() => pts.map(p => Date.parse(p.t)), [pts]);
  const idx = hover ?? pts.length - 1;
  const hp = pts[Math.min(idx, pts.length - 1)];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !pts.length) return;
    const t = start + (((e.clientX - box.left) / box.width) * 1000 - X0) / W * span;
    setHover(nearestIndex(ts, t));
  };

  // Drawn once per data/scale change; hovering only moves the crosshair, dots and readout.
  const lines = useMemo(() => (
    <>
        {reading.keys.map((k, i) => segments(pts, k, maxGap).map((seg, j) => (
          <g key={`${k}-${j}`}>
            {agg && val(seg[0], `${k}__min`) !== undefined && (
              <path data-band="" fill={colors[i]} opacity={0.12}
                d={`M${seg.map(p => `${X(Date.parse(p.t)).toFixed(1)},${Y(val(p, `${k}__max`) ?? val(p, k)!).toFixed(1)}`).join(' L')} L${[...seg].reverse().map(p => `${X(Date.parse(p.t)).toFixed(1)},${Y(val(p, `${k}__min`) ?? val(p, k)!).toFixed(1)}`).join(' L')} Z`} />
            )}
            {seg.length === 1 && <circle cx={X(Date.parse(seg[0].t))} cy={Y(val(seg[0], k)!)} r={2.5} fill={colors[i]} />}
            <polyline fill="none" stroke={colors[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              points={seg.map(p => `${X(Date.parse(p.t)).toFixed(1)},${Y(val(p, k)!).toFixed(1)}`).join(' ')} />
          </g>
        )))}
    </>
  ), [pts, scale, start, span, agg, maxGap, reading.keys, colors]); // eslint-disable-line react-hooks/exhaustive-deps

  const multiDay = span > 6 * 3_600_000;
  const xTicks = [0, 1, 2, 3, 4, 5].map(k => start + (k * span) / 5);
  const gapStart = data.longest_gap_at ? Date.parse(data.longest_gap_at) : null;
  const gapX = gapStart != null ? Math.max(X0, X(gapStart)) : null;
  const bigGap = data.longest_gap_s != null && data.longest_gap_s > 3 * (data.median_gap_s ?? 0);
  const gapW = gapStart != null && bigGap ? Math.max(3, X(gapStart + data.longest_gap_s! * 1000) - X(gapStart)) : 0;
  const cellW = W / Math.max(1, data.coverage.length);
  const lastCode = data.code_changes[data.code_changes.length - 1];
  const hpTime = hp ? (agg ? `${clockFmt(Date.parse(hp.t), multiDay)} to ${clockFmt(Date.parse(hp.t) + DETAIL_MS[data.detail], false)}` : secFmt(Date.parse(hp.t))) : '';

  return (
    <div className="dt-chart">
      <div className="dt-head">
        <h3>{reading.title}</h3>
        <div className="dt-readout" aria-live={hover == null ? 'polite' : 'off'}>
          {hp && <span className="dt-num dt-sub">{hover == null ? 'Latest, ' : ''}{hpTime}</span>}
          {hp && reading.keys.map((k, i) => { const v = val(hp, k); const lo = val(hp, `${k}__min`), hi = val(hp, `${k}__max`); return v !== undefined && (
            <span key={k}>
              <i className="dt-key" style={{ background: colors[i] }} aria-hidden="true" />
              <b className="dt-num">{num(v, reading.unit)}<span className="dt-unit">{reading.unit}</span></b>
              <span className="dt-sub"> {reading.names[i]}{agg && lo !== undefined && hi !== undefined && ` (${num(lo, reading.unit)} to ${num(hi, reading.unit)})`}</span>
            </span>
          ); })}
        </div>
      </div>
      <svg ref={svgRef} className="dt-svg" viewBox="0 0 1000 292" role="img"
        aria-label={`${reading.title}. ${hp ? `Latest ${reading.keys.map((k, i) => `${reading.names[i]} ${val(hp, k) !== undefined ? num(val(hp, k)!, reading.unit) : 'none'}`).join(', ')}` : 'No readings'}. ${lastCode ? `Last code change: ${lastCode.key.startsWith('warning') ? 'warning' : 'fault'} ${hexCode(lastCode.value)} at ${secFmt(Date.parse(lastCode.t))}. ` : ''}${data.longest_gap_s != null && data.longest_gap_at ? `Longest gap ${duration(data.longest_gap_s)} from ${secFmt(Date.parse(data.longest_gap_at))}. ` : ''}Exact values are in the Every reading tab.`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {scale.ticks.map(v => (
          <g key={v}>
            <line x1={X0} x2={X1} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeOpacity={v === 0 && reading.zero ? 1 : 0.6} strokeWidth={v === 0 && reading.zero ? 1.5 : 1} />
            <text x={50} y={Y(v) + 4} textAnchor="end">{v.toFixed(dec)}</text>
          </g>
        ))}
        {gapX != null && gapW > 0 && <>
          <rect x={gapX} y={Y0} width={gapW} height={Y1 - Y0} fill="var(--dc-miss)" opacity={0.45} />
          <text className="dt-label" x={Math.min(gapX + gapW + 6, X1 - 150)} y={Y0 + 14}>No readings, {duration(data.longest_gap_s!)}</text>
        </>}
        {lines}
        {hp && <line x1={X(Date.parse(hp.t))} x2={X(Date.parse(hp.t))} y1={Y0} y2={244} stroke="var(--foreground)" strokeOpacity={0.35} />}
        {hp && reading.keys.map((k, i) => val(hp, k) !== undefined && (
          <circle key={k} cx={X(Date.parse(hp.t))} cy={Y(val(hp, k)!)} r={4.5} fill={colors[i]} stroke="var(--card)" strokeWidth={2} />
        ))}

        <text className="dt-label" x={0} y={LANE_Y + 14}>Reported</text>
        {data.coverage.map((c, i) => (
          <rect key={i} data-cell={c} x={X0 + i * cellW + 1} width={Math.max(1, cellW - 2)} rx={2}
            y={c === 'partial' ? LANE_Y + 9 : LANE_Y} height={c === 'partial' ? 9 : 18}
            fill={c === 'empty' ? 'var(--dc-miss)' : 'var(--brand-green)'} />
        ))}
        <text className="dt-label" x={0} y={CODE_Y + 6}>Codes</text>
        {data.code_changes.map(c => {
          const x = X(Date.parse(c.t));
          return <path key={c.t + c.key} d={`M${x} ${CODE_Y - 6} L${x + 6} ${CODE_Y} L${x} ${CODE_Y + 6} L${x - 6} ${CODE_Y} Z`} fill="var(--dc-fault)" stroke="var(--card)" strokeWidth={2} />;
        })}
        {lastCode && <text x={X(Date.parse(lastCode.t)) + (X(Date.parse(lastCode.t)) < X0 + 260 ? 12 : -12)} y={CODE_Y + 6} textAnchor={X(Date.parse(lastCode.t)) < X0 + 260 ? 'start' : 'end'}>
          {`${lastCode.key.startsWith('warning') ? 'Warning' : 'Fault'} ${hexCode(lastCode.value)} at ${secFmt(Date.parse(lastCode.t))}`}
        </text>}
        {xTicks.map((t, k) => (
          <text key={k} x={X(t)} y={286} textAnchor={k === 0 ? 'start' : k === 5 ? 'end' : 'middle'}>
            {span >= 7 * 86_400_000 - 1 ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : clockFmt(t, multiDay)}
          </text>
        ))}
      </svg>
      <div className="dt-legend">
        <span><svg width="14" height="12" aria-hidden="true"><rect width="10" height="12" rx="2" fill="var(--brand-green)" /></svg> All expected readings arrived</span>
        <span><svg width="14" height="12" aria-hidden="true"><rect y="6" width="10" height="6" rx="2" fill="var(--brand-green)" /></svg> Some missing</span>
        <span><svg width="14" height="12" aria-hidden="true"><rect width="10" height="12" rx="2" fill="var(--dc-miss)" /></svg> None</span>
        <span><svg width="14" height="12" aria-hidden="true"><path d="M5 1 L10 6 L5 11 L0 6 Z" fill="var(--dc-fault)" /></svg> Fault or warning code changed</span>
      </div>
      <p style={{ margin: 0, fontSize: 14 }}>
        {data.median_gap_s != null ? <>A reading every {duration(data.median_gap_s)} on average.</> : <>No readings in this range.</>}
        {data.longest_gap_s != null && data.longest_gap_at && <> Longest gap {duration(data.longest_gap_s)}, from {secFmt(Date.parse(data.longest_gap_at))}.</>}
        {agg && <> Averages hide spikes, so check the band: a wide band means the reading jumped inside that period.</>}
      </p>
    </div>
  );
}
