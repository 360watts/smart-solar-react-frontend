import React, { useRef } from 'react';
import { act, render } from '@testing-library/react';
import FlowLines, { LineSet, FLOW_COLORS } from './FlowLines';
import { flowPaths } from './flowModel';

const paths = {
  solar: 'M 0 0 C 0 5 10 5 10 10', gridIn: 'M 0 0 L 1 1', gridOut: 'M 1 1 L 0 0',
  battIn: 'M 0 0 L 0 9', battOut: 'M 0 9 L 0 0',
  loads: ['M 0 0 L 5 5', 'M 0 0 L 6 6', 'M 0 0 L 7 7'] as [string, string, string],
};
const idle = { solar: 0, gridIn: 0, gridOut: 0, battIn: 0, battOut: 0, loads: [0, 0, 0] as [number, number, number] };

it('only active lines animate', () => {
  const { container } = render(<svg><LineSet paths={paths} kw={{ ...idle, solar: 1.7, battOut: 1.3, loads: [0.29, 0, 0.6] }} /></svg>);
  expect(container.querySelectorAll('path[data-flow="solar"][data-anim="1"]').length).toBe(1);
  expect(container.querySelectorAll('path[data-flow="battOut"][data-anim="1"]').length).toBe(1);
  expect(container.querySelectorAll('path[data-flow="battIn"][data-anim="1"]').length).toBe(0);
  expect(container.querySelectorAll('path[data-flow="load0"][data-anim="1"]').length).toBe(1);
  expect(container.querySelectorAll('path[data-flow="load1"][data-anim="1"]').length).toBe(0);
  expect(container.querySelectorAll('path[data-flow="load2"][data-anim="1"]').length).toBe(1);
});
// docs/test-scenarios/dashboard-redesign.md row 39
it('selling uses the grid blue and every load line is neutral', () => {
  const { container } = render(<svg><LineSet paths={paths} kw={{ ...idle, gridOut: 0.5, loads: [0.3, 0.2, 0.6] }} /></svg>);
  const stroke = (flow: string) => container.querySelector(`path[data-flow="${flow}"][data-anim="1"]`)!.getAttribute('stroke');
  expect(stroke('gridOut')).toBe(FLOW_COLORS.grid);
  ['load0', 'load1', 'load2'].forEach(f => expect(stroke(f)).toBe(FLOW_COLORS.load));
});
it('every line still draws a track', () => {
  const { container } = render(<svg><LineSet paths={paths} kw={idle} /></svg>);
  expect(container.querySelectorAll('path[data-track]').length).toBe(8);
});

// docs/test-scenarios/dashboard-redesign.md rows 56-57: anchors follow the boxes when the layout or ring size changes.
describe('FlowLines re-measures on resize', () => {
  type Box = { left: number; top: number; width: number; height: number };
  const rects: Record<string, Box> = {};
  let observed: Element[] = [];
  let fire: () => void = () => {};
  const origRO = (globalThis as any).ResizeObserver;
  const origRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    observed = [];
    (globalThis as any).ResizeObserver = class {
      constructor(cb: () => void) { fire = cb; }
      observe(el: Element) { observed.push(el); }
      disconnect() {}
    };
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const r = rects[this.dataset.k ?? ''] ?? { left: 0, top: 0, width: 0, height: 0 };
      return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON() { return r; } } as DOMRect;
    };
    Object.assign(rects, {
      panel: { left: 0, top: 0, width: 800, height: 500 },
      solar: { left: 0, top: 0, width: 200, height: 100 },
      batt: { left: 300, top: 0, width: 200, height: 100 },
      grid: { left: 600, top: 0, width: 200, height: 100 },
      ring: { left: 325, top: 175, width: 150, height: 150 },
      l0: { left: 0, top: 400, width: 200, height: 100 },
      l1: { left: 300, top: 400, width: 200, height: 100 },
      l2: { left: 600, top: 400, width: 200, height: 100 },
    });
  });
  afterEach(() => {
    (globalThis as any).ResizeObserver = origRO;
    HTMLElement.prototype.getBoundingClientRect = origRect;
  });

  function Harness() {
    const panel = useRef<HTMLDivElement>(null), s = useRef<HTMLDivElement>(null), b = useRef<HTMLDivElement>(null);
    const g = useRef<HTMLDivElement>(null), r = useRef<HTMLDivElement>(null);
    const l0 = useRef<HTMLDivElement>(null), l1 = useRef<HTMLDivElement>(null), l2 = useRef<HTMLDivElement>(null);
    return (
      <div ref={panel} data-k="panel">
        <FlowLines container={panel} solar={s} batt={b} grid={g} ring={r} loads={[l0, l1, l2]} kw={{ ...idle, solar: 1 }} />
        <div ref={s} data-k="solar" /><div ref={b} data-k="batt" /><div ref={g} data-k="grid" />
        <div ref={r} data-k="ring" />
        <div ref={l0} data-k="l0" /><div ref={l1} data-k="l1" /><div ref={l2} data-k="l2" />
      </div>
    );
  }
  const d = (c: HTMLElement, flow: string) => c.querySelector(`path[data-track][data-flow="${flow}"]`)!.getAttribute('d');

  it('observes the panel, the ring and every card', () => {
    render(<Harness />);
    expect(observed.map(el => (el as HTMLElement).dataset.k).sort())
      .toEqual(['batt', 'grid', 'l0', 'l1', 'l2', 'panel', 'ring', 'solar']);
  });

  it('recomputes the anchors after a ResizeObserver callback (ring shrinks, solar card narrows)', () => {
    const { container } = render(<Harness />);
    const wide = flowPaths({
      solar: { x: 100, y: 100 }, batt: { x: 400, y: 100 }, grid: { x: 700, y: 100 },
      ring: { cx: 400, cy: 250, r: 75 }, loads: [{ x: 100, y: 400 }, { x: 400, y: 400 }, { x: 700, y: 400 }],
    });
    expect(d(container, 'solar')).toBe(wide.solar);

    rects.ring = { left: 340, top: 190, width: 120, height: 120 }; // clamp() ring at its 120 px floor
    rects.solar = { left: 0, top: 0, width: 150, height: 100 };
    act(() => fire());

    const narrow = flowPaths({
      solar: { x: 75, y: 100 }, batt: { x: 400, y: 100 }, grid: { x: 700, y: 100 },
      ring: { cx: 400, cy: 250, r: 60 }, loads: [{ x: 100, y: 400 }, { x: 400, y: 400 }, { x: 700, y: 400 }],
    });
    expect(d(container, 'solar')).toBe(narrow.solar);
    expect(d(container, 'load1')).toBe(narrow.loads[1]); // load lines now start on the smaller ring's edge
    expect(narrow.loads[1]).not.toBe(wide.loads[1]);
  });
});

// docs/test-scenarios/dashboard-redesign.md row 71
it('two load anchors give two load paths: backup from the SW edge, grid direct from the SE edge', () => {
  const a = { solar: { x: 100, y: 0 }, batt: { x: 400, y: 0 }, grid: { x: 700, y: 0 }, ring: { cx: 400, cy: 250, r: 75 }, loads: [{ x: 200, y: 400 }, { x: 600, y: 400 }] };
  const p = flowPaths(a);
  expect(p.loads.length).toBe(2);
  expect(p.loads[0].startsWith(`M ${400 + 75 * Math.cos((135 * Math.PI) / 180)}`)).toBe(true);
  const { container } = render(<svg><LineSet paths={p} kw={{ ...idle, loads: [0.3, 0.6] }} /></svg>);
  expect(container.querySelectorAll('path[data-track][data-flow^="load"]').length).toBe(2);
  expect(container.querySelector('path[data-flow="load2"]')).toBeNull();
});
