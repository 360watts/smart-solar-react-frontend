import '@testing-library/jest-dom';
import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HistoryTab from './HistoryTab';

// scenarios: docs/test-scenarios/history-tab-redesign.md (U1-U10)
const mockChart: { props: any } = { props: null };
jest.mock('react-chartjs-2', () => ({
  Line: (p: any) => { mockChart.props = p; return <div data-testid="chart" />; },
  Bar: (p: any) => { mockChart.props = p; return <div data-testid="bars" />; },
}));
jest.mock('../chartUtils', () => ({
  useChartZoomState: () => ({ chartRef: { current: null }, isZoomed: false, resetZoom: () => {}, onZoomComplete: { current: () => {} } }),
  ZoomResetButton: () => null,
}));
const mockGetDay = jest.fn();
const mockGetDaily = jest.fn();
const mockGetEvents = jest.fn();
jest.mock('../../../../services/api', () => ({
  apiService: {
    getHouseholdDay: (...a: any[]) => mockGetDay(...a),
    getHouseholdDaily: (...a: any[]) => mockGetDaily(...a),
    getSiteEvents: (...a: any[]) => mockGetEvents(...a),
  },
}));

const NOW = Date.parse('2026-11-19T06:00:00Z');
const slot = (ts: string, whole = true) => ({
  ts, whole_home: whole, pv_kw: 4, home_kw: 4, from_solar_kw: 2, from_battery_kw: 0.4, from_grid_kw: 1.6, bought_kw: 1.6,
  solar_to_battery_kw: 1, exported_kw: 1, inverter_kw: 2, grid_board_kw: 2, inv_out_kw: 3, soc: 60,
});
const dayRow = (date: string, whole = true) => ({
  date, source: '5min', whole_home: whole, coverage: 1, pv_kwh: 30, home_kwh: 30, from_solar_kwh: 12,
  from_battery_kwh: 6, from_grid_kwh: 12, bought_kwh: 12, solar_to_battery_kwh: 8, exported_kwh: 10, soc_min: 25, soc_max: 95,
});
const addD = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00+05:30`) + n * 864e5 + 19_800_000).toISOString().slice(0, 10);

beforeEach(() => {
  mockChart.props = null;
  mockGetDay.mockReset(); mockGetDaily.mockReset(); mockGetEvents.mockReset();
  mockGetDay.mockImplementation((_s: string, date: string) => Promise.resolve({
    date, parts: ['grid_board', 'inverter'], whole_home: true, note: null,
    slots: [slot(`${date}T00:00:00Z`), slot(`${date}T00:15:00Z`)],
  }));
  mockGetDaily.mockImplementation((_s: string, start: string, end: string) => {
    const days: any[] = [];
    for (let d = start; d <= end; d = addD(d, 1)) days.push(dayRow(d, d >= '2026-11-01'));
    return Promise.resolve({ start, end, parts: ['grid_board', 'inverter'], note: null, days });
  });
  mockGetEvents.mockResolvedValue({ days: 7, events: [] });
});
const setup = () => render(<HistoryTab siteId="s1" isDark={false} nowMs={NOW} />);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const TILE = /^\w{3}, \d+ \w{3}:/;

describe('HistoryTab', () => {
  it('U1 Today: chart first, header summary, flags, then where energy went', async () => {
    setup();
    await screen.findByTestId('chart');
    await waitFor(() => expect(screen.getByTestId('history-chart')).toHaveTextContent(/60% own power/));
    const [c, f, w] = ['history-chart', 'history-flags', 'history-where'].map(id => screen.getByTestId(id));
    expect(c.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(f.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByTestId('kpi')).toHaveLength(4);
    expect(f).toHaveTextContent('All clear · 3 checks');
  });

  it('U2 7 days: stacked daily bars', async () => {
    setup();
    click('7 days');
    await screen.findByTestId('bars');
    expect(mockChart.props.data.labels).toHaveLength(7);
    expect(mockChart.props.data.datasets.map((d: any) => d.label)).toEqual(['From solar', 'From battery', 'From grid', 'Solar made']);
  });

  it('U3 30 days: calendar with clickable days', async () => {
    setup();
    click('30 days');
    const tiles = await screen.findAllByRole('button', { name: TILE });
    expect(tiles).toHaveLength(30);
    fireEvent.click(tiles[29]);
    expect(screen.getByRole('button', { name: 'Open this day' })).toBeInTheDocument();
  });

  it('U4 mixed days note', async () => {
    setup();
    click('30 days');
    await screen.findAllByRole('button', { name: TILE });
    await waitFor(() => expect(screen.getByTestId('history-where')).toHaveTextContent('Whole home on 19 of 30 days'));
  });

  it('U5 site without a meter', async () => {
    mockGetDay.mockImplementation((_s: string, date: string) => Promise.resolve({ date, parts: ['inverter'], whole_home: false, note: null, slots: [slot(`${date}T00:00:00Z`, false)] }));
    setup();
    await screen.findByTestId('chart');
    await waitFor(() => expect(screen.getByTestId('history-where')).toHaveTextContent('Inverter circuits only'));
    expect(screen.getAllByTestId('kpi')).toHaveLength(4);
  });

  it('U6 stepping back', async () => {
    setup();
    await screen.findByTestId('chart');
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled();
    click('Previous period');
    // Nov 18 is already fetched as "the day before" on load; stepping back must fetch Nov 17
    await waitFor(() => expect(mockGetDay).toHaveBeenCalledWith('s1', '2026-11-17'));
    expect(screen.getByRole('button', { name: 'Next period' })).not.toBeDisabled();
  });

  it('U7 inverter detail adds raw lines', async () => {
    setup();
    await screen.findByTestId('chart');
    click('Inverter detail');
    expect(mockChart.props.data.datasets.map((d: any) => d.label)).toEqual(expect.arrayContaining(['Inverter output', 'Inverter-side load']));
  });

  it('U8 table view', async () => {
    setup();
    await screen.findByTestId('chart');
    click('Table');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('U9 pick dates over 60 days gives weekly bars', async () => {
    setup();
    click('Pick dates');
    await screen.findByTestId('bars');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-22' } });
    await waitFor(() => expect(mockChart.props.data.labels).toHaveLength(13));
    expect(mockChart.props.data.labels[0]).toMatch(/^Week of /);
  });

  it('U11 Anything wrong? stays short: one line per issue, 3 shown, then Show all', async () => {
    const inc = (title: string, n: number) => Array.from({ length: n }, (_, i) => ({
      at: `2026-11-19T0${i}:00:00Z`, ended: i ? '2026-11-19T05:00:00Z' : null, kind: 'incident', title, severity: 'warning', serial: `D${i}`,
    }));
    mockGetEvents.mockResolvedValue({ days: 7, events: [...inc('Device Offline', 4), ...inc('A', 1), ...inc('B', 1), ...inc('C', 1), ...inc('D', 1)] });
    setup();
    const f = await screen.findByTestId('history-flags');
    await waitFor(() => expect(f).toHaveTextContent('5 issues · 5 open'));
    expect(f.querySelectorAll('li')).toHaveLength(3);
    expect(f.querySelector('li')).toHaveTextContent('Device Offline×4open');
    click('Show all 5');
    expect(f.querySelectorAll('li')).toHaveLength(5);
  });

  it('U10 balance note', async () => {
    mockGetDay.mockImplementation((_s: string, date: string) => Promise.resolve({
      date, parts: ['grid_board', 'inverter'], whole_home: true, note: null, slots: [{ ...slot(`${date}T00:00:00Z`), pv_kw: 6 }],
    }));
    setup();
    await screen.findByTestId('chart');
    await waitFor(() => expect(screen.getByTestId('history-where')).toHaveTextContent("Figures don't fully balance"));
  });
});
