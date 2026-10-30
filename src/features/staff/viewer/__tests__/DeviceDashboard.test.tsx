import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DeviceDashboard from '../DeviceDashboard';

jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../services/api', () => ({ apiService: { getDeviceDashboard: jest.fn(), getDeviceSeries: jest.fn() } }));
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: (f: string) => f === 'my_sites' }) }));
jest.mock('../deviceCache', () => ({ getFirmware: () => Promise.resolve(null) }));
jest.mock('../ReadingsTab', () => ({ __esModule: true, default: () => <div data-testid="readings" /> }));
jest.mock('../OperationsTab', () => ({ __esModule: true, default: () => <div data-testid="ops" /> }));
jest.mock('../OverviewChart', () => ({ __esModule: true, default: () => <div data-testid="chart" /> }));
jest.mock('../DevicePage', () => ({
  __esModule: true,
  at: () => '29 Oct, 10:00 am', devName: (d: any) => `Monitor ${d.serial}`,
}));

const { apiService } = jest.requireMock('../../../../services/api');
const Where = () => <span data-testid="where">{useLocation().search}</span>;
const ui = (url = '/devices/47/dashboard') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/devices/:deviceId/dashboard" element={<><DeviceDashboard /><Where /></>} /></Routes>
  </MemoryRouter>,
);
const T0 = '2026-10-01T10:00:00+00:00', T1 = '2026-10-01T10:10:00+00:00';
const dash = (over = {}) => ({
  device_id: 47, serial: '00A1', device_type: 'gateway', is_online: false, last_heartbeat: null, site_id: null,
  last_reading_at: T1, range_start: '2026-10-01T09:55:00+00:00', range_end: T1, bucket_minutes: 5, sampled_every: 1,
  latest: { pv1_power_w: 512.4, grid_l1_voltage_v: 231, grid_l2_voltage_v: 229, grid_l3_voltage_v: 230, fault_word_1: 0, data_source: 'rs485' },
  history: [{ t: T0, pv1_power_w: 500, grid_l1_voltage_v: 231, grid_l2_voltage_v: 229, grid_l3_voltage_v: 230, fault_word_1: 0 },
            { t: T1, pv1_power_w: 520, grid_l1_voltage_v: 232, grid_l2_voltage_v: 228, grid_l3_voltage_v: 230, fault_word_1: 0 }],
  ...over,
});

describe('DeviceDashboard', () => {
  it('V12 shows the All values cards from the last hour, with the tab count and a stale banner', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    ui('/devices/47/dashboard?tab=values');
    expect(await screen.findByText('Monitor 00A1')).toBeInTheDocument();
    expect(apiService.getDeviceDashboard).toHaveBeenCalledWith(47, 1);
    expect(screen.getByText(/not at a site/)).toBeInTheDocument();
    ['Solar', 'Grid', 'Faults and warnings'].forEach(h => expect(screen.getByRole('heading', { name: h })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /All values/ })).toHaveTextContent('All values6');
    expect(screen.getByText(/stopped sending/)).toBeInTheDocument();
  });

  it('V13 says when nothing has arrived and shows no cards', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash({ last_reading_at: null, latest: null, history: [] }));
    ui('/devices/47/dashboard?tab=values');
    expect(await screen.findByText('No readings yet')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  const SER = () => ({ ...dash(), detail: 'every', keys: [], series: [], coverage: [], code_changes: [], median_gap_s: null, longest_gap_s: null, longest_gap_at: null });

  it('T1 opens on Overview with four tabs and asks for the finest detail of 1 h', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    apiService.getDeviceSeries.mockResolvedValue(SER());
    ui();
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map(t => t.textContent?.replace(/\d+$/, ''))).toEqual(['Overview', 'All values', 'Every reading', 'Operations']);
    expect(apiService.getDeviceSeries).toHaveBeenCalledWith(47, 1, 'every', ['pv1_power_w', 'pv2_power_w']);
  });

  it('T2 keeps the tab in the URL', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    ui('/devices/47/dashboard?tab=readings');
    expect(await screen.findByTestId('readings')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Operations/ })); });
    expect(await screen.findByTestId('ops')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=ops');
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: /Overview/ })); });
    expect(screen.getByTestId('where')).toHaveTextContent(/^$/);
  });

  it('C2 switching range refits the detail', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    apiService.getDeviceSeries.mockResolvedValue(SER());
    ui();
    await screen.findByTestId('chart');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '24 h' })); });
    expect(apiService.getDeviceSeries).toHaveBeenLastCalledWith(47, 24, '5m', ['pv1_power_w', 'pv2_power_w']);
    expect(screen.queryByRole('button', { name: 'Every reading' })).toBeNull();
  });

  it('T4 tiles say charging, selling and idle in plain words', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash({ latest: { battery_power_w: -1500, battery_soc_percent: 80, grid_power_w: -300 } }));
    apiService.getDeviceSeries.mockResolvedValue(SER());
    ui();
    expect(await screen.findByText('Charging at 1.50 kW')).toBeInTheDocument();
    expect(screen.getByText('Selling')).toBeInTheDocument();
    expect(screen.getByText('0.30')).toBeInTheDocument();
  });

  it('T5 meter tiles show total power', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash({ device_type: 'energy_meter', latest: { active_power_total: 2500 } }));
    apiService.getDeviceSeries.mockResolvedValue(SER());
    ui();
    expect(await screen.findByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('All three phases')).toBeInTheDocument();
  });

  it('T6 says so when the chart cannot load, and keeps the page when a refresh fails', async () => {
    apiService.getDeviceDashboard.mockResolvedValue(dash());
    apiService.getDeviceSeries.mockRejectedValue(new Error('500'));
    ui();
    expect(await screen.findByText(/Couldn't load the chart/)).toBeInTheDocument();
  });

  it('says the device is not available when the call is refused', async () => {
    apiService.getDeviceDashboard.mockRejectedValue(new Error('403'));
    ui();
    expect(await screen.findByText("This device isn't available to you")).toBeInTheDocument();
  });
});
