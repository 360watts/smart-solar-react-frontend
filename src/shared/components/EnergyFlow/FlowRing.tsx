import React, { forwardRef } from 'react';
import { MixShares, fmtPower } from './flowModel';
import { FLOW_COLORS } from './FlowLines';

export const RING_R = 67;      // centre-line radius
export const RING_STROKE = 16;
export const RING_OUTER = RING_R + RING_STROKE / 2; // 75 (150 px ring): the lines end here

const SEG: { key: keyof MixShares; color: string }[] = [
  { key: 'solar', color: FLOW_COLORS.solar },
  { key: 'battery', color: FLOW_COLORS.batt },
  { key: 'grid', color: FLOW_COLORS.grid },
];

// The interior holds HOME USES, the value and the parts line.
interface Props { shares: MixShares | null; homeKw: number; partsText?: string; isDark: boolean }

const FlowRing = forwardRef<HTMLDivElement, Props>(({ shares, homeKw, partsText, isDark }, ref) => {
  const c = 2 * Math.PI * RING_R;
  const size = RING_OUTER * 2;
  let offset = 0;
  const f = fmtPower(homeKw);
  return (
    // Box scales with the energy-flow container (120-150 px); the SVG fills it, so the ring's outer edge is
    // always the box edge and FlowLines (which measures this element) still ends lines on the ring border.
    <div ref={ref} data-flow-ring style={{ position: 'relative', width: `clamp(120px, 18cqw, ${size}px)`, aspectRatio: '1 / 1', flexShrink: 0 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={RING_OUTER} cy={RING_OUTER} r={RING_R} fill="none" strokeWidth={RING_STROKE}
          stroke="var(--surface-muted)" />
        {shares && SEG.map(({ key, color }) => {
          const len = shares[key] * c;
          if (len <= 0) return null;
          const el = (
            <circle key={key} data-seg={key} cx={RING_OUTER} cy={RING_OUTER} r={RING_R} fill="none"
              strokeWidth={RING_STROKE} stroke={color}
              strokeDasharray={`${len} ${c}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-dim)' }}>HOME USES</div>
        <div style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: "'Rubik', sans-serif", fontSize: 'clamp(24px, 2.9cqw, 32px)', fontWeight: 600, color: 'var(--foreground)' }}>{f.valueStr}</span>
          <span style={{ fontSize: 14, color: 'var(--text-dim)', marginLeft: 3 }}>{f.unit}</span>
        </div>
        {partsText ? (
          // One part per line, never broken mid-item (the parts text joins them with " · ").
          <div title={partsText} style={{ fontSize: 12, lineHeight: 1.25, color: 'var(--text-dim)', marginTop: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {partsText.split(' · ').map(p => <span key={p} style={{ whiteSpace: 'nowrap' }}>{p}</span>)}
          </div>
        ) : null}
      </div>
    </div>
  );
});
export default FlowRing;
