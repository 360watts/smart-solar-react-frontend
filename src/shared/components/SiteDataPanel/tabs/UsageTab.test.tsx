import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import UsageTab, { computeHealth, niceMax, liveKw } from './UsageTab';
import type { MeterUsage } from '../types';

jest.mock('../../../../services/api', () => ({
  apiService: { getMeterUsage: jest.fn(), getEnergyMeterHistory: jest.fn() },
}));

const { apiService } = jest.requireMock('../../../../services/api');

// 2026-09-25 .. 2026-10-08, oldest first
const DATES = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 8, 25 + i)).toISOString().slice(0, 10));

function usage(over: Partial<MeterUsage> = {}): MeterUsage {
  const today = Array.from({ length: 68 }, (_, i) => (i === 10 ? null : Math.round((0.4 + i / 20) * 100) / 100));
  const yesterday = Array.from({ length: 96 }, (_, i) => Math.round((0.5 + i / 25) * 100) / 100);
  return {
    site_id: 'coim_007',
    timezone: 'Asia/Kolkata',
    generated_at: '2026-10-08T11:08:00+00:00',
    meter_only: true,
    meter: { device_serial: 'ME0042', last_reading_at: '2026-10-08T11:06:00+00:00', age_seconds: 120 },
    step_minutes: 15,
    today: {
      date: '2026-10-08', energy_kwh: 18.4, yesterday_at_now_kwh: 16.4, yesterday_total_kwh: 21.9,
      now_kw: 2.31, peak_kw: 5.82, peak_at: '2026-10-08T14:15:00+00:00', yesterday_peak_kw: 6.1,
      avg_kw: 0.77, base_load_kw: 0.31,
    },
    curve: { today, yesterday },
    days: DATES.map((d, i) => ({ date: d, kwh: i === 3 ? null : 18 + i })),
    heatmap: { dates: DATES, kw: DATES.map((_, r) => Array.from({ length: 24 }, (_, h) => (h === 3 ? null : 0.3 + (r + h) / 10))) },
    month: { to_date_kwh: 161, avg_day_kwh: 22 },
    coverage: { today_pct: 97 },
    ...over,
  };
}

const ct: any = {
  timestamp: '2026-10-08T11:06:12+00:00', node_id: 'ME0042',
  voltage_l1: 229.4, voltage_l2: 231.0, voltage_l3: 233.2,
  current_l1: 10.12, current_l2: 12.41, current_l3: 14.8,
  frequency_l1: 49.98, frequency_l2: 49.98, frequency_l3: 49.97,
  active_power_l1: 2164, active_power_l2: 2689, active_power_l3: 3226, active_power_total: 8079,
  reactive_power_l1: 812, reactive_power_l2: 1004, reactive_power_l3: 1201, reactive_power_total: 3017,
  apparent_power_l1: 2311, apparent_power_l2: 2870, apparent_power_l3: 3443, apparent_power_total: 8624,
  power_factor_l1: 0.94, power_factor_l2: 0.94, power_factor_l3: 0.94, power_factor_total: 0.94,
};

const renderTab = (props: Partial<React.ComponentProps<typeof UsageTab>> = {}) =>
  render(<UsageTab siteId="coim_007" isDark={false} ctLatest={ct} {...props} />);

const NOW = Date.parse('2026-10-08T11:08:00Z'); // two minutes after the fixture meter reading

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  apiService.getMeterUsage.mockResolvedValue(usage());
  apiService.getEnergyMeterHistory.mockResolvedValue([]);
});

describe('UsageTab', () => {
  it('shows skeletons first, then the energy figure and the change against yesterday', async () => {
    renderTab();
    expect(screen.getByTestId('usage-skeleton')).toBeInTheDocument();
    expect(await screen.findByTestId('hero-kwh')).toHaveTextContent('18.4');
    expect(screen.queryByTestId('usage-skeleton')).toBeNull();
    expect(screen.getByText('12% more than yesterday at this time')).toBeInTheDocument();
    expect(screen.getByText(/finished at 21\.9 kWh/)).toBeInTheDocument();
    expect(apiService.getMeterUsage).toHaveBeenCalledWith('coim_007', expect.anything());
  });

  it('says "less" calmly and hides the chip when there is nothing to compare with', async () => {
    apiService.getMeterUsage.mockResolvedValue(usage({ today: { ...usage().today, energy_kwh: 10, yesterday_at_now_kwh: 20 } }));
    const { unmount } = renderTab();
    expect(await screen.findByText('50% less than yesterday at this time')).toBeInTheDocument();
    unmount();
    apiService.getMeterUsage.mockResolvedValue(usage({ today: { ...usage().today, yesterday_at_now_kwh: null } }));
    renderTab();
    await screen.findByTestId('hero-kwh');
    expect(screen.queryByText(/yesterday at this time/)).toBeNull();
  });

  it('shows live status with the reading age from the meter', async () => {
    renderTab();
    expect(await screen.findByText(/Live · last reading 2 minutes ago/)).toBeInTheDocument();
  });

  it('switches to amber wording when the meter has gone quiet', async () => {
    apiService.getMeterUsage.mockResolvedValue(usage({ meter: { device_serial: 'ME0042', last_reading_at: 'x', age_seconds: 3 * 3600 } }));
    renderTab();
    expect(await screen.findByText(/Not reporting · last reading 3 hours ago/)).toBeInTheDocument();
  });

  it('shows the four side cards, with the peak time in the site timezone', async () => {
    renderTab();
    await screen.findByTestId('hero-kwh');
    for (const [label, value] of [['Using right now', '8.08'], ['Highest demand today', '5.82'], ['Average load today', '0.77'], ['Overnight base load', '0.31']]) {
      const card = screen.getByText(label).closest('[data-testid="kpi-card"]') as HTMLElement;
      expect(within(card).getByText(value)).toBeInTheDocument();
    }
    expect(screen.getByText(/At 7:45 pm\. Yesterday: 6\.10 kW/)).toBeInTheDocument();
  });

  it('shows an em dash and a reason when the base load is unknown', async () => {
    apiService.getMeterUsage.mockResolvedValue(usage({ today: { ...usage().today, base_load_kw: null } }));
    renderTab();
    await screen.findByTestId('hero-kwh');
    const card = screen.getByText('Overnight base load').closest('[data-testid="kpi-card"]') as HTMLElement;
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(within(card).getByText('Needs a few nights of readings')).toBeInTheDocument();
  });

  it('draws the curve and breaks the line at gaps', async () => {
    renderTab();
    await screen.findByTestId('hero-kwh');
    const svg = screen.getByRole('img', { name: /today against yesterday/i });
    const d = svg.querySelector('[data-testid="today-line"]')!.getAttribute('d')!;
    expect((d.match(/M/g) || []).length).toBe(2); // the gap at slot 10 splits the line in two
    expect(svg.querySelector('[data-testid="yesterday-line"]')).toBeInTheDocument();
    expect(screen.getByText(/Now · 8\.08 kW/)).toBeInTheDocument();
  });

  it('renders 14 heat rows of 24 cells with a tooltip each', async () => {
    renderTab();
    await screen.findByTestId('hero-kwh');
    const rows = screen.getAllByTestId('heat-row');
    expect(rows).toHaveLength(14);
    rows.forEach(r => expect(within(r).getAllByTestId('heat-cell')).toHaveLength(24));
    expect(within(rows[0]).getAllByTestId('heat-cell')[0]).toHaveAttribute('title', 'Fri 25, 12 am · 0.30 kW');
    expect(within(rows[0]).getAllByTestId('heat-cell')[3]).toHaveAttribute('title', 'Fri 25, 3 am · no reading');
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('shows 14 day bars with today highlighted, the daily average and the month so far', async () => {
    renderTab();
    await screen.findByTestId('hero-kwh');
    const bars = screen.getAllByTestId('day-bar');
    expect(bars).toHaveLength(14);
    expect(bars[13]).toHaveAttribute('data-today', 'true');
    expect(bars[12]).toHaveAttribute('data-today', 'false');
    expect(bars[0]).toHaveAttribute('aria-label', 'Fri 25: 18.0 kWh');
    expect(screen.getByRole('img', { name: /Heat map.*Busiest around/ })).toBeInTheDocument();
    expect(screen.getByText('Daily average this month').nextSibling).toHaveTextContent('22.0 kWh');
    expect(screen.getByText('Total this month so far').nextSibling).toHaveTextContent('161.0 kWh');
  });

  it('shows the health bars and the current by phase', async () => {
    renderTab();
    await screen.findByTestId('hero-kwh');
    expect(screen.getByText('Is the supply healthy?')).toBeInTheDocument();
    const balance = screen.getByTestId('health-balance');
    expect(balance).toHaveTextContent('A little uneven');
    expect(balance).toHaveTextContent('19');
    expect(balance).toHaveTextContent('Phase 3 is the heaviest');
    expect(balance).toHaveTextContent('% off average');
    expect(screen.getByTestId('health-voltage')).toHaveTextContent('Steady');
    expect(screen.getByTestId('health-pf')).toHaveTextContent('Good');
    expect(screen.getByTestId('health-frequency')).toHaveTextContent('Steady');
    const phases = screen.getByTestId('current-by-phase');
    expect(phases).toHaveTextContent('Phase 1');
    expect(phases).toHaveTextContent('14.8 A');
  });

  it('lists every raw reading per phase with totals and units', async () => {
    renderTab();
    await screen.findByTestId('hero-kwh');
    const table = screen.getByRole('table', { name: 'Raw readings' });
    const row = (label: string) =>
      Array.from((within(table).getByText(label).closest('tr') as HTMLElement).children).map(c => c.textContent);
    expect(within(table).getByText('Voltage')).toHaveAttribute('scope', 'row');
    expect(within(table).getByText('Measurement')).toHaveAttribute('scope', 'col');
    expect(row('Voltage')).toEqual(['Voltage', '229.4', '231.0', '233.2', '231.2 avg', 'V']);
    expect(row('Current')).toEqual(['Current', '10.12', '12.41', '14.80', '—', 'A']);
    expect(row('Frequency')).toEqual(['Frequency', '49.98', '49.98', '49.97', '49.98 avg', 'Hz']);
    expect(row('Active power')).toEqual(['Active power', '2,164', '2,689', '3,226', '8,079', 'W']);
    expect(row('Reactive power')).toEqual(['Reactive power', '812', '1,004', '1,201', '3,017', 'VAR']);
    expect(row('Apparent power')).toEqual(['Apparent power', '2,311', '2,870', '3,443', '8,624', 'VA']);
    expect(row('Power factor')).toEqual(['Power factor', '0.94', '0.94', '0.94', '0.94', '']);
    expect(screen.getByText(/Meter ME0042/).closest('details')).not.toBeNull(); // device code sits behind the expander
    expect(screen.getByText(/4:36:12 pm/)).toBeInTheDocument();
  });

  it('uses an em dash for a missing phase value, and labels a summed power total only when the meter sent none', async () => {
    renderTab({ ctLatest: { ...ct, current_l2: null, active_power_total: null } });
    await screen.findByTestId('hero-kwh');
    const table = screen.getByRole('table', { name: 'Raw readings' });
    const cells = (label: string) => Array.from((within(table).getByText(label).closest('tr') as HTMLElement).children).map(c => c.textContent);
    expect(cells('Current')).toEqual(['Current', '10.12', '—', '14.80', '—', 'A']);
    expect(cells('Active power')).toEqual(['Active power', '2,164', '2,689', '3,226', '8,079 sum', 'W']);
  });

  it('shows the meter\'s own power total, not the phase sum', async () => {
    renderTab({ ctLatest: { ...ct, active_power_total: 8100 } });
    await screen.findByTestId('hero-kwh');
    const table = screen.getByRole('table', { name: 'Raw readings' });
    expect(within(within(table).getByText('Active power').closest('tr') as HTMLElement).getByText('8,100')).toBeInTheDocument();
  });

  it('never shows an old meter reading as live', async () => {
    renderTab({ ctLatest: { ...ct, timestamp: '2026-10-08T10:00:00+00:00' } });
    await screen.findByTestId('hero-kwh');
    const card = screen.getByText('Using right now').closest('[data-testid="kpi-card"]') as HTMLElement;
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(within(card).getByText('No reading in the last 15 minutes')).toBeInTheDocument();
    expect(screen.getByText('Now · —')).toBeInTheDocument();
    expect(screen.queryByText(/2\.31/)).toBeNull();
  });

  it('tells the person when the panel has no meter reading yet, and the rest still works', async () => {
    renderTab({ ctLatest: null });
    await screen.findByTestId('hero-kwh');
    expect(screen.getAllByText('Waiting for the first meter reading')).toHaveLength(2);
    expect(screen.getByText('Energy used today, so far')).toBeInTheDocument();
  });

  it('keeps the last 10 recent readings, newest first', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 9, 8, 10, i * 5)).toISOString(),
      active_power_total: 1000 + i * 100,
      voltage_l1: 230, voltage_l2: 231, voltage_l3: 232, current_l1: 1, current_l2: 2, current_l3: 3,
    }));
    apiService.getEnergyMeterHistory.mockResolvedValue(rows);
    const { container } = renderTab();
    await screen.findByTestId('hero-kwh');
    expect(apiService.getEnergyMeterHistory).not.toHaveBeenCalled(); // not until the details are opened
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(screen.getAllByTestId('recent-row')).toHaveLength(10));
    expect(screen.getAllByTestId('recent-row')[0]).toHaveTextContent('2.10'); // 2100 W is the newest
    expect(apiService.getEnergyMeterHistory).toHaveBeenCalledWith('coim_007', expect.objectContaining({ aggregate: '5min' }));
    expect(screen.getByText('Recent readings (last 10)')).toBeInTheDocument();
  });

  const emptyToday = (meter: Partial<MeterUsage['meter']>) => usage({
    meter: { ...usage().meter, ...meter },
    curve: { today: [], yesterday: Array(96).fill(null) },
    today: { ...usage().today, energy_kwh: 0, now_kw: null, peak_kw: null, peak_at: null, avg_kw: null, base_load_kw: null },
  });

  it('shows the empty state when the meter has not reported today, with the supply and raw readings still there', async () => {
    apiService.getMeterUsage.mockResolvedValue(emptyToday({ age_seconds: 3 * 3600 }));
    renderTab();
    expect(await screen.findByText("No readings yet. The meter hasn't reported today.")).toBeInTheDocument();
    expect(screen.queryByTestId('hero-kwh')).toBeNull();
    expect(screen.getByTestId('health-voltage')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Raw readings' })).toBeInTheDocument();
  });

  it('says there are no figures yet (not that the meter is silent) when the meter is live after midnight', async () => {
    apiService.getMeterUsage.mockResolvedValue(emptyToday({ age_seconds: 120 }));
    renderTab();
    expect(await screen.findByText('No usage figures yet today.')).toBeInTheDocument();
    expect(screen.queryByText(/hasn't reported/)).toBeNull();
    expect(screen.getByTestId('health-balance')).toBeInTheDocument();
  });

  it('shows a friendly error and retries', async () => {
    apiService.getMeterUsage.mockRejectedValueOnce(new Error('HTTP 500 boom')).mockResolvedValue(usage());
    renderTab();
    expect(await screen.findByText("Couldn't load the usage figures. Try again.")).toBeInTheDocument();
    expect(screen.queryByText(/boom|Nothing is wrong/)).toBeNull();
    expect(screen.getByTestId('health-voltage')).toBeInTheDocument(); // the meter reading still shows
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('hero-kwh')).toHaveTextContent('18.4');
    expect(apiService.getMeterUsage).toHaveBeenCalledTimes(2);
  });
});

describe('poll lifecycle', () => {
  const setHidden = (v: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, value: v });
  const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  afterEach(() => { setHidden(false); jest.useRealTimers(); });

  it('retries on demand, polls every 60 s, pauses while hidden and stops on unmount', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    apiService.getMeterUsage.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(usage());
    const { unmount } = renderTab();
    await flush();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(apiService.getMeterUsage).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('hero-kwh')).toBeInTheDocument();

    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(apiService.getMeterUsage).toHaveBeenCalledTimes(2); // not at 30 s
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(apiService.getMeterUsage).toHaveBeenCalledTimes(3);

    setHidden(true);
    await act(async () => { jest.advanceTimersByTime(120_000); });
    expect(apiService.getMeterUsage).toHaveBeenCalledTimes(3);

    setHidden(false);
    unmount();
    await act(async () => { jest.advanceTimersByTime(180_000); });
    expect(apiService.getMeterUsage).toHaveBeenCalledTimes(3);
  });
});

describe('liveKw', () => {
  it('uses the meter total in kW only while the reading is under 15 minutes old', () => {
    expect(liveKw(ct, NOW)).toBeCloseTo(8.079);
    expect(liveKw(ct, NOW + 12 * 60_000)).not.toBeNull();
    expect(liveKw(ct, NOW + 20 * 60_000)).toBeNull();
    expect(liveKw({ ...ct, active_power_total: null }, NOW)).toBeNull();
    expect(liveKw(null, NOW)).toBeNull();
  });
});

describe('computeHealth', () => {
  it('flags uneven phases and names the heaviest', () => {
    const h = computeHealth(ct);
    expect(h.balance).toMatchObject({ value: '19', ok: false, status: 'A little uneven' });
    expect(h.balance.note).toMatch(/Phase 3 is the heaviest/);
    expect(h.voltage).toMatchObject({ value: '231', status: 'Steady', ok: true });
    expect(h.pf).toMatchObject({ value: '0.94', status: 'Good', ok: true });
    expect(h.frequency).toMatchObject({ value: '49.98', status: 'Steady', ok: true });
  });

  it('is balanced inside 10 percent', () => {
    const h = computeHealth({ ...ct, current_l1: 10, current_l2: 10.4, current_l3: 10.2 });
    expect(h.balance).toMatchObject({ status: 'Balanced', ok: true });
  });

  it('is amber wording, not an alarm, outside the ranges', () => {
    const h = computeHealth({
      ...ct, voltage_l1: 262, voltage_l2: 262, voltage_l3: 262, power_factor_total: 0.8,
      frequency_l1: 51, frequency_l2: 51, frequency_l3: 51,
    });
    expect(h.voltage).toMatchObject({ status: 'Worth a look', ok: false });
    expect(h.pf).toMatchObject({ status: 'Worth a look', ok: false });
    expect(h.frequency).toMatchObject({ status: 'Worth a look', ok: false });
  });

  it('never produces NaN or Infinity when currents are zero or missing', () => {
    expect(computeHealth({ ...ct, current_l1: 0, current_l2: 0, current_l3: 0 }).balance.value).toBe('—');
    expect(computeHealth({ ...ct, current_l1: 5, current_l2: null, current_l3: null }).balance.value).toBe('—');
    const none = computeHealth({} as any);
    expect(none.voltage.value).toBe('—');
    expect(none.pf.value).toBe('—');
    expect(JSON.stringify(none)).not.toMatch(/NaN|Infinity/);
  });
});

describe('niceMax', () => {
  it('rounds the data maximum up to a round number', () => {
    expect(niceMax(5.82)).toBe(6);
    expect(niceMax(6.1)).toBe(8);
    expect(niceMax(0.4)).toBe(1);
    expect(niceMax(0)).toBe(1);
    expect(niceMax(2.3)).toBe(3);
    expect(niceMax(14.2)).toBe(16);
  });
});
