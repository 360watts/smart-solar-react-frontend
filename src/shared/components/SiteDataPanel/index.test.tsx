import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import SiteDataPanel, { __resetMeterOnlyMemory } from './index';
import { apiService } from '../../../services/api';

jest.mock('react-chartjs-2', () => ({ Line: () => null, Bar: () => null }));
jest.mock('chartjs-plugin-zoom', () => ({}));
jest.mock('../../../features/staff/DetailsTab', () => () => null);
jest.mock('../../../features/staff/EnergyFlowHealthRow', () => ({ SystemHealthPanel: () => null }));
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('./tabs/OverviewTab', () => () => <div>OVERVIEW-CONTENT</div>);
jest.mock('./tabs/WeatherTab', () => () => null);
jest.mock('./tabs/HistoryTab', () => ({ __esModule: true, default: () => null, HISTORY_SERIES: [] }));
jest.mock('./tabs/ForecastTab', () => () => null);
jest.mock('./tabs/PhaseLoadTab', () => () => null);
jest.mock('./tabs/UsageTab', () => () => <div>USAGE-CONTENT</div>);
jest.mock('../../../features/staff/viewer/ViewerDevices', () => () => <div>DEVICES-CONTENT</div>);
jest.mock('../../../services/api', () => ({
  apiService: new Proxy({ getStaffOverview: jest.fn() }, {
    get: (t: any, k: string) => (k in t ? t[k] : (t[k] = jest.fn().mockResolvedValue(null))),
  }),
}));

const overview = apiService.getStaffOverview as jest.Mock;
const seen: string[] = [];
const snap = () => { if (screen.queryByText('OVERVIEW-CONTENT')) seen.push('overview'); if (screen.queryByText('USAGE-CONTENT')) seen.push('usage'); };

async function open(answer: any) {
  let resolve!: (v: any) => void;
  overview.mockReturnValue(new Promise(r => { resolve = r; }));
  seen.length = 0;
  const obs = new MutationObserver(snap);
  obs.observe(document.body, { childList: true, subtree: true });
  render(<SiteDataPanel siteId="1" autoRefresh />);
  expect(overview).toHaveBeenCalledTimes(1); // first overview call is immediate
  snap();
  expect(seen).toEqual([]); // skeleton while waiting
  expect(apiService.getSiteTelemetry as jest.Mock).not.toHaveBeenCalled();
  await act(async () => { resolve(answer); });
  await waitFor(() => { snap(); expect(seen.length).toBeGreaterThan(0); });
  obs.disconnect();
}

beforeAll(() => {
  (window as any).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
});
beforeEach(() => { jest.clearAllMocks(); __resetMeterOnlyMemory(); });

it('meter-only: Usage is the first tab rendered, Overview never renders', async () => {
  await open({ meter_only: true, has_meter: true });
  expect(seen[0]).toBe('usage');
  expect(seen).not.toContain('overview');
});

it('inverter site: Overview renders after the answer', async () => {
  await open({ meter_only: false, has_meter: false, weather: { temp: 30 } });
  expect(seen[0]).toBe('overview');
});

// docs/test-scenarios/dashboard-redesign.md row 25
it('Today / Refresh sit in the tab row, not a separate bar; Refresh refetches', async () => {
  await open({ meter_only: false, has_meter: false, weather: { temp: 30 } });
  const refresh = screen.getAllByRole('button', { name: /refresh/i });
  expect(refresh).toHaveLength(1);
  expect(screen.getByTestId('tab-row').contains(refresh[0])).toBe(true);
  expect(screen.getByTestId('tab-row').contains(screen.getByRole('option', { name: 'Today' }))).toBe(true);
  const forecast = apiService.getSiteForecast as jest.Mock;
  const before = forecast.mock.calls.length;
  await act(async () => { fireEvent.click(refresh[0]); });
  expect(forecast.mock.calls.length).toBeGreaterThan(before);
});

async function firstAnswer(siteId: string, answer: any) {
  overview.mockResolvedValue(answer);
  const u = render(<SiteDataPanel siteId={siteId} autoRefresh />);
  await waitFor(() => expect(screen.queryByText('USAGE-CONTENT') || screen.queryByText('OVERVIEW-CONTENT')).not.toBeNull());
  u.unmount();
}

it('remembered meter-only site: Usage on the very first render after a remount, overview still refetched', async () => {
  await firstAnswer('1', { meter_only: true, has_meter: true });
  overview.mockClear();
  overview.mockReturnValue(new Promise(() => {}));
  render(<SiteDataPanel siteId="1" autoRefresh />);
  expect(screen.queryByText('USAGE-CONTENT')).not.toBeNull();
  expect(screen.queryByText('OVERVIEW-CONTENT')).toBeNull();
  expect(overview).toHaveBeenCalledTimes(1);
});

it('a different site does not inherit the remembered answer', async () => {
  await firstAnswer('1', { meter_only: true, has_meter: true });
  overview.mockReturnValue(new Promise(() => {}));
  render(<SiteDataPanel siteId="2" autoRefresh />);
  expect(screen.queryByText('USAGE-CONTENT')).toBeNull();
  expect(screen.queryByText('OVERVIEW-CONTENT')).toBeNull();
});

it('a failed second overview answer keeps the remembered value', async () => {
  await firstAnswer('1', { meter_only: true, has_meter: true });
  overview.mockRejectedValue(new Error('boom'));
  render(<SiteDataPanel siteId="1" autoRefresh />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.queryByText('USAGE-CONTENT')).not.toBeNull();
  expect(screen.queryByText('OVERVIEW-CONTENT')).toBeNull();
});

describe('fetch failed (viewer-devices TB-5 / TB-6)', () => {
  const forecast = () => apiService.getSiteForecast as jest.Mock;
  beforeEach(() => {
    overview.mockResolvedValue({ meter_only: false, has_meter: false });
    forecast().mockRejectedValue(new Error('boom'));
  });
  afterEach(() => { forecast().mockResolvedValue(null); });
  const failed = () => waitFor(() => expect(screen.queryByText(/Failed to load data/)).not.toBeNull());
  const devicesTab = () => screen.queryAllByRole('tab').find(t => t.textContent === 'Devices');

  it("visibleTabs ['devices']: Devices tab and its content still show", async () => {
    render(<SiteDataPanel siteId="1" autoRefresh visibleTabs={['devices']} />);
    await waitFor(() => expect(screen.queryByText('DEVICES-CONTENT')).not.toBeNull());
    expect(devicesTab()).not.toBeUndefined();
  });

  it('other tabs show the error; Devices stays selectable', async () => {
    render(<SiteDataPanel siteId="1" autoRefresh visibleTabs={['overview', 'devices']} />);
    await failed();
    expect(screen.queryByText('OVERVIEW-CONTENT')).toBeNull();
    fireEvent.click(devicesTab()!);
    expect(screen.queryByText('DEVICES-CONTENT')).not.toBeNull();
    expect(screen.queryByText(/Failed to load data/)).toBeNull();
  });

  it('without devices in visibleTabs: error only, no tab bar (unchanged)', async () => {
    render(<SiteDataPanel siteId="1" autoRefresh visibleTabs={['overview']} />);
    await failed();
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});
