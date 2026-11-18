import '@testing-library/jest-dom';
import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { render, screen, fireEvent } from '@testing-library/react';
import LoadCard, { type LoadCardProps } from './LoadCard';
import { SLOT_MS } from './loadCardModel';

// scenarios: docs/test-scenarios/combined-load-card.md (C1-C7)
let chartProps: any = null;
jest.mock('react-chartjs-2', () => ({
  Line: (props: any) => { chartProps = props; return <div data-testid="chart" />; },
}));
jest.mock('../chartUtils', () => ({
  useChartZoomState: () => ({ chartRef: { current: null }, isZoomed: false, resetZoom: () => {}, onZoomComplete: { current: () => {} } }),
  ZoomResetButton: () => null,
  createDragZoomPlugins: () => ({}),
}));
jest.mock('../../../lib/resolveCssVar', () => ({ resolveCssVar: () => '#000' }));

const S0 = Date.UTC(2026, 10, 17, 0, 30); // 06:00 IST
const NOW = S0 + 4 * 3_600_000 + 60_000;
const iso = (i: number) => new Date(S0 + i * SLOT_MS).toISOString();
const actual = Array.from({ length: 16 }, (_, i) => ({ rawTs: S0 + i * SLOT_MS, inverter: 0.5, grid: i === 3 ? null : 1, ev: 0.2 }));
const series = (kw: number) => Array.from({ length: 96 }, (_, i) => ({ ts: iso(i), predicted_kw: kw, p10_kw: kw / 2, p90_kw: kw * 2 }));

function setup(over: Partial<LoadCardProps> = {}) {
  const props: LoadCardProps = {
    isDark: false, actual, invAccuracy: { timeseries: series(0.4), overall: { mae_kw: 0.2, coverage_pct: 80 } },
    invForward: [], gridAccuracy: { timeseries: series(0.6), note: 'Meter reads ~25% low' }, hasEv: true,
    hours: 24, onHoursChange: jest.fn(), onLeadChange: jest.fn(), solarStartMs: S0, nowMs: NOW, ...over,
  };
  const { rerender } = render(<LoadCard {...props} />);
  rerenderWith = next => rerender(<LoadCard {...next} />);
  return props;
}
let rerenderWith: (p: LoadCardProps) => void = () => {};
const labels = () => chartProps.data.datasets.map((d: any) => d.label as string);
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('LoadCard', () => {
  beforeEach(() => { chartProps = null; });

  it('C1 the summed forecast is inverter + grid, never EV', () => {
    setup();
    click('All');
    const summed = chartProps.data.datasets.find((d: any) => d.label === 'Forecast (inverter + grid)');
    expect(summed.data[50]).toBeCloseTo(1.0);
    expect(labels()).not.toContain('EV forecast');
  });

  it('C2 the EV line has no forecast', () => {
    setup();
    click('EV');
    expect(labels().some((l: string) => /forecast|P10/i.test(l) && !/measured only/.test(l))).toBe(false);
  });

  it('C3 one line: no Line picker', () => {
    setup({ actual: actual.map(r => ({ ...r, inverter: null, ev: null })), invAccuracy: null, hasEv: false });
    expect(screen.queryByRole('group', { name: 'Line' })).toBeNull();
    expect(screen.getByText(/Grid Load: Today/)).toBeInTheDocument();
  });

  it('C4 the window drives the hours fetched', () => {
    const onHoursChange = jest.fn();
    const p = setup({ onHoursChange });
    click('Last 7 days');
    expect(p.onHoursChange).toHaveBeenLastCalledWith(168);
    rerenderWith({ ...p, hours: 168 }); // the parent passes the new hours back
    click('Today');
    expect(p.onHoursChange).toHaveBeenLastCalledWith(24);
  });

  it('C5 Off hides the forecast without a fetch; a lead fetches its runs', () => {
    const p = setup();
    click('Off');
    expect(labels()).toEqual(['Actual']);
    expect(p.onLeadChange).not.toHaveBeenCalled();
    click('Day-ahead');
    expect(p.onLeadChange).toHaveBeenCalledWith('day');
    expect(labels()).toContain('Forecast (P50)');
  });

  it('C6 a missing grid reading marks the total incomplete', () => {
    setup();
    click('All');
    expect(screen.getByText(/· incomplete/)).toBeInTheDocument();
    expect(screen.getByText(/total incomplete/)).toBeInTheDocument();
  });

  it('C7 the grid line shows the meter note', () => {
    setup();
    click('Grid');
    expect(screen.getByText('Meter reads ~25% low')).toBeInTheDocument();
    expect(labels()).toContain('Forecast (14-day pattern)');
    expect(labels()).toContain('Likely range');
    expect(labels()).not.toContain('P10–P90');
  });

  it('C8 the grid kWh chip sums the expected value, not P50', () => {
    // 3.75 kWh so far + 79 future slots at mean 1.0 kW (19.75) -> ~23.5 by 06:00 (P50 0.6 would give 15.6)
    setup({ gridAccuracy: { timeseries: series(0.6).map(r => ({ ...r, mean_kw: 1.0 })) } });
    click('Grid');
    expect(screen.getByText(/~23\.5 kWh by 06:00/)).toBeInTheDocument();
  });

  it('C9 the forecast is drawn in its line colour, never red, on straight segments', () => {
    setup();
    const fc = chartProps.data.datasets.find((d: any) => d.label === 'Forecast (P50)');
    expect(fc.borderColor).not.toBe('#ef4444');
    expect(fc.borderDash).toBeTruthy();
    expect(chartProps.data.datasets.every((d: any) => d.tension === 0)).toBe(true);
  });

  it('C11 All: solid measured stack, one dashed forecast line on top, nothing at the slot in progress', () => {
    setup();
    click('All');
    expect(labels()).toEqual(['Inverter', 'Grid', 'EV', 'Forecast (inverter + grid)']);
    const ds = (l: string) => chartProps.data.datasets.find((d: any) => d.label === l);
    expect(ds('Inverter').data[15]).toBeCloseTo(0.5);
    expect(ds('Inverter').data[16]).toBeNull(); // slot 16 holds now: no full reading yet, so no drop to 0
    const fc = ds('Forecast (inverter + grid)');
    expect(fc.order).toBe(-1); // drawn last, above the filled stack
    expect(fc.data[5]).toBeCloseTo(1.0); // the whole day, past slots included, for comparison
    expect(fc.data[60]).toBeCloseTo(1.0);
  });

  it('C12 an EV plug with no readings in the window gets no layer', () => {
    setup({ actual: actual.map(r => ({ ...r, ev: null })) });
    click('All');
    expect(labels()).not.toContain('EV');
  });

  it('C10 the accuracy line is a caption and the chips read as so far / by the end', () => {
    setup();
    expect(screen.getByText(/Day-ahead accuracy, last 7 days: typical error 0\.20 kW · 80% inside the range/)).toBeInTheDocument();
    expect(screen.getAllByText(/so far/).length).toBeGreaterThan(0);
  });
});
