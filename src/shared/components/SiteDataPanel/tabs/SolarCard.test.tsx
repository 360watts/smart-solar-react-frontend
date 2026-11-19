import '@testing-library/jest-dom';
import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { render, screen, fireEvent, act } from '@testing-library/react';
import SolarCard from './SolarCard';
import { DAY_MS, SLOT_MS } from './solarCardModel';

// scenarios: docs/test-scenarios/solar-forecast-card.md (U1-U8)
const mockChart: { props: any } = { props: null };
jest.mock('react-chartjs-2', () => ({
  Line: (props: any) => { if (props) mockChart.props = props; return <div data-testid="chart" />; },
}));
jest.mock('../chartUtils', () => ({
  useChartZoomState: () => ({ chartRef: { current: null }, isZoomed: false, resetZoom: () => {}, onZoomComplete: { current: () => {} } }),
  ZoomResetButton: () => null,
  createDragZoomPlugins: () => ({}),
}));
jest.mock('../../../lib/resolveCssVar', () => ({ resolveCssVar: () => '#000' }));

const DAY = Date.UTC(2026, 10, 17, 18, 30); // Nov 18 00:00 IST
const NOW = DAY + 13 * 3_600_000 + 60_000;  // 13:01 IST
const iso = (ms: number) => new Date(ms).toISOString();
// sun 06:00–18:00 IST: 2 kW forecast, 1.8 kW actual on finished slots
const dayRows = (d0: number, upTo: number) => Array.from({ length: 48 }, (_, i) => {
  const ms = d0 + 6 * 3_600_000 + i * SLOT_MS;
  return { slot_ts: iso(ms), actual_kw: ms < upTo ? 1.8 : null, predicted_kw: 2, p10_kw: 1, p90_kw: 3, physics_baseline_kw: 2.2 };
});
const ts = [...[6, 5, 4, 3, 2, 1].flatMap(n => dayRows(DAY - n * DAY_MS, Infinity)), ...dayRows(DAY, NOW)];
const forecast = Array.from({ length: 48 }, (_, i) => ({ forecast_for: iso(DAY + DAY_MS + 6 * 3_600_000 + i * SLOT_MS), p50_kw: 3, p10_kw: 2, p90_kw: 4, ghi_input_wm2: 600 }))
  .concat([{ forecast_for: iso(DAY + DAY_MS + 19 * 3_600_000), p50_kw: 0, p10_kw: 0, p90_kw: 0, ghi_input_wm2: 0 } as any, // night: tomorrow is a complete day
    { forecast_for: iso(DAY + 9 * 3_600_000), p50_kw: 2, p10_kw: 1, p90_kw: 3, ghi_input_wm2: 500 } as any]);

const setup = (accuracy: any = { timeseries: ts }) => render(<SolarCard isDark={false} forecast={forecast} accuracy={accuracy} nowMs={NOW} />);
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const labels = () => mockChart.props.data.datasets.map((d: any) => d.label);

describe('SolarCard', () => {
  beforeEach(() => { mockChart.props = null; localStorage.clear(); });

  it('U1 today: three tiles and one chart of actual, P50 and range', () => {
    setup();
    expect(screen.getAllByTestId('kpi')).toHaveLength(3);
    expect(screen.getByText('Generated so far')).toBeInTheDocument();
    expect(screen.getByText('~24.0')).toBeInTheDocument();          // 48 slots × 2 kW × 0.25
    expect(screen.getByText('-10%')).toBeInTheDocument();
    expect(labels()).toEqual(['_p10', 'Likely range (P10–P90)', 'Forecast (P50)', 'Actual']);
    const act = mockChart.props.data.datasets[3].data;
    expect(act.filter((v: any) => v != null)).toHaveLength(28);      // 06:00–13:00 finished, 13:00 slot in progress
  });

  it('U2 daily: last 7 days, a hollow dot for today so far on a dotted link, then the forecast days', () => {
    setup();
    click('Daily');
    expect(mockChart.props.data.labels).toHaveLength(8);           // 6 full days + today + tomorrow
    expect(mockChart.props.data.labels[6]).toBe('Today');
    const a = mockChart.props.data.datasets.find((d: any) => d.label === 'Actual').data;
    expect(a[0]).toBeCloseTo(21.6);
    expect(a[6]).toBeNull();
    expect(a[7]).toBeNull();
    const p50 = mockChart.props.data.datasets.find((d: any) => d.label === 'Forecast (P50)').data;
    expect(p50[7]).toBeCloseTo(36);
    expect(labels()).toContain('Today, so far');
    expect(screen.getByText('Generated · 6 full days')).toBeInTheDocument();
    expect(screen.getByText('vs forecast · 6 of 6 days in range')).toBeInTheDocument();
    expect(screen.getByText('Next day')).toBeInTheDocument();
  });

  it('U8 daily: the dotted line through the dot for today is drawn by the plugin; zoom is off; ends sit on the axes', () => {
    setup();
    click('Daily');
    const link = mockChart.props.data.datasets.find((d: any) => d.label === 'Today, so far');
    expect(link.data.every((v: any) => v == null)).toBe(true);    // legend entry only
    expect(link.borderDash).toBeTruthy();
    expect(link.pointBackgroundColor).toBe('#fff');
    const f = mockChart.props.options.plugins.tooltip.filter;
    expect(f({ dataset: { label: 'Today, so far' }, parsed: { y: 1 } })).toBe(false);
    expect(f({ dataset: { label: 'Actual' }, parsed: { y: 1 } })).toBe(true);
    expect(mockChart.props.options.plugins.zoom.zoom.drag.enabled).toBe(false);
    expect(mockChart.props.options.scales.x.offset).toBe(false);
    click('Today');
    expect(mockChart.props.options.scales.x.offset).toBe(true);
  });

  it('U9 the Expected tile range is the daily band times the total, matching the Daily chart; no band keeps the slot sums', () => {
    setup({ timeseries: ts, daily_range: { lo: 0.8, hi: 1.2 } });
    expect(screen.getByText('Likely 19.2–28.8 kWh')).toBeInTheDocument();   // 24.0 x 0.8 .. x 1.2
  });

  it('U3 clicking a forecast day opens it, forecast only, and Back to today returns', () => {
    setup();
    click('Daily');
    act(() => mockChart.props.options.onClick(null, [{ index: 7 }]));
    expect(labels()).not.toContain('Actual');
    expect(screen.getByText(/^Expected · /)).toBeInTheDocument();
    expect(screen.getByText('~36.0')).toBeInTheDocument();
    click('Back to today');
    expect(labels()).toContain('Actual');
  });

  it('U8 the range is the only shaded area; its edges are dotted', () => {
    setup();
    const ds = mockChart.props.data.datasets;
    expect(ds.filter((d: any) => d.fill && d.fill !== false).map((d: any) => d.label)).toEqual(['Likely range (P10–P90)']);
    expect(ds.find((d: any) => d.label === '_p10').borderDash).toEqual([2, 3]);
    expect(screen.getByTestId('legend')).toHaveTextContent('ActualLikely range (P10–P90)Forecast (P50)');
  });

  it('U4 no animation, straight segments', () => {
    setup();
    expect(mockChart.props.options.animation).toBe(false);
    expect(mockChart.props.data.datasets.every((d: any) => d.tension === 0)).toBe(true);
    expect(mockChart.props.options.plugins.legend.display).toBe(false);
    expect(mockChart.props.options.scales.x.offset).toBe(true);
    click('Daily');
    expect(mockChart.props.options.scales.x.offset).toBe(false);   // Daily: points on the axes, with padding
  });

  it('U5 GHI is off until asked for', () => {
    setup();
    expect(labels()).not.toContain('Sunlight (GHI)');
    click('+ Sunlight (GHI)');
    expect(labels()).toContain('Sunlight (GHI)');
    expect(mockChart.props.options.scales.ghi).toBeTruthy();
  });

  it('U6 no data: empty state', () => {
    render(<SolarCard isDark={false} forecast={[]} accuracy={null} nowMs={NOW} />);
    expect(screen.getByText('No forecast or readings for today yet.')).toBeInTheDocument();
  });

  it('U7 table view', () => {
    setup();
    click('Table');
    expect(screen.getByRole('columnheader', { name: 'Actual kW' })).toBeInTheDocument();
    click('Daily');
    expect(screen.getByRole('columnheader', { name: 'Actual kWh' })).toBeInTheDocument();
  });
});
