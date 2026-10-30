import React from 'react';
import './viewerSkeleton.css';

/** Loading placeholders shaped like the page that is coming, so the layout does not jump when data arrives.
 *  Each one is a polite live region with the words "Loading…" for screen readers; the shimmer stops under reduced motion. */
const Bone: React.FC<{ w?: number | string; h?: number | string; r?: number; className?: string }> = ({ w = '100%', h = 14, r = 8, className }) => (
  <span className={`sk-bone${className ? ` ${className}` : ''}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />
);

const Live: React.FC<{ label?: string; children: React.ReactNode; className?: string }> = ({ label = 'Loading…', children, className }) => (
  <div className={`sk${className ? ` ${className}` : ''}`} role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

/** A short list of rows (events, trail, devices). */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <Live>
    {Array.from({ length: rows }, (_, i) => (
      <div className="sk-row" key={i}><Bone w={72} h={12} /><Bone w={56} h={22} r={11} /><Bone w={`${52 - (i % 3) * 10}%`} h={12} /></div>
    ))}
  </Live>
);

/** A table body (every reading, devices table). */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 8, cols = 6 }) => (
  <Live className="sk-table">
    {Array.from({ length: rows }, (_, i) => (
      <div className="sk-trow" key={i} style={{ gridTemplateColumns: `1.4fr repeat(${cols - 1}, 1fr)` }}>
        {Array.from({ length: cols }, (_, j) => <Bone key={j} h={12} w={j === 0 ? '80%' : `${60 + ((i + j) % 3) * 12}%`} />)}
      </div>
    ))}
  </Live>
);

/** A chart panel: tile row, range chips and the plot area. */
export const ChartSkeleton: React.FC = () => (
  <Live>
    <div className="sk-chips"><Bone w={44} h={30} r={15} /><Bone w={44} h={30} r={15} /><Bone w={44} h={30} r={15} /><Bone w={44} h={30} r={15} /></div>
    <div className="sk-plot"><Bone h="100%" r={14} /></div>
  </Live>
);

/** The whole device page while the first response is on its way. */
export const DeviceSkeleton: React.FC = () => (
  <Live className="sk-page">
    <div className="sk-head"><Bone w={220} h={26} /><Bone w={90} h={22} r={11} /></div>
    <div className="sk-tabs">{[96, 84, 108, 92].map((w, i) => <Bone key={i} w={w} h={34} r={17} />)}</div>
    <div className="sk-tiles">{Array.from({ length: 4 }, (_, i) => <div className="sk-tile" key={i}><Bone w={70} h={12} /><Bone w={110} h={28} /><Bone w="60%" h={10} /></div>)}</div>
    <div className="sk-card"><Bone w={180} h={16} /><div className="sk-plot"><Bone h="100%" r={14} /></div></div>
  </Live>
);

/** Home while the access summary loads: headline, table, site cards. */
export const HomeSkeleton: React.FC = () => (
  <Live className="sk-page">
    <Bone w={320} h={28} />
    <div className="sk-card">{Array.from({ length: 4 }, (_, i) => (
      <div className="sk-trow" key={i} style={{ gridTemplateColumns: '1.2fr 1fr 2.4fr .8fr' }}><Bone h={12} w="70%" /><Bone h={12} w="50%" /><Bone h={14} r={4} /><Bone h={12} w="60%" /></div>
    ))}</div>
    <div className="sk-tiles">{Array.from({ length: 2 }, (_, i) => <div className="sk-tile" key={i}><Bone w={110} h={16} /><Bone w="70%" h={12} /></div>)}</div>
  </Live>
);
