import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DetailsTab from '../DetailsTab';
import DeviceDashboard from '../DeviceDashboard';

const mockApi = {
  getDevice: jest.fn(), getAlerts: jest.fn(), getPresetFresh: jest.fn(), getRegisterCoverage: jest.fn(),
  getDeviceDashboard: jest.fn(), getDeviceSeries: jest.fn(), getPresets: jest.fn(), updateDevice: jest.fn(), deleteDevice: jest.fn(),
};
let mockCan: (f: string) => boolean = () => true;
jest.mock('../../../../services/api', () => ({ apiService: new Proxy({}, { get: (_t, n: string) => (...a: unknown[]) => (mockApi as any)[n](...a) }) }));
jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: (f: string) => mockCan(f) }) }));
jest.mock('../deviceCache', () => ({ getFirmware: () => Promise.resolve(null) }));
jest.mock('../OperationsTab', () => ({ __esModule: true, default: () => <div data-testid="ops" /> }));
jest.mock('../OverviewChart', () => ({ __esModule: true, default: () => null }));
jest.mock('../DevicePage', () => ({ __esModule: true, at: () => '29 Oct, 10:00 am', devName: (d: any) => `Monitor ${d.serial}` }));
jest.mock('../../EditDeviceModal', () => ({ __esModule: true, default: (p: any) => p.isOpen ? <button onClick={() => p.onSave({ model: 'X' })}>save-edit</button> : null }));
jest.mock('../../DeleteDeviceModal', () => ({ __esModule: true, default: (p: any) => p.open ? <button onClick={() => p.onConfirm({ mode: 'x' })}>confirm-delete</button> : null }));

const dev = (o = {}) => ({
  id: 47, is_online: true, is_active: true, last_heartbeat: '2026-10-29T10:00:00Z', hw_id: 'AA:BB', model: 'GW-1', user: 'Lakshmi',
  connectivity_type: 'wifi', network_ip: '10.0.0.5', signal_strength_dbm: 61, device_temp_c: 41.26, memory_status: { free_heap: 120000 },
  heartbeat_health: { severity: 'ok', issues: [] }, config_version: 'cfg-1', pending_config_update: true, config_ack_ver: 2,
  provisioned_at: '2026-09-01T00:00:00Z', created_by_username: 'admin', ...o,
});
const alert = (o = {}) => ({ id: 1, device_id: '47', device_serial: '00A1', severity: 'critical', message: 'Grid lost', fault_code: 'GRID-001', timestamp: '2026-10-29T09:00:00Z', status: 'active', resolved: false, ...o });
const tab = (p: Partial<React.ComponentProps<typeof DetailsTab>> = {}) =>
  render(<MemoryRouter><DetailsTab deviceId={47} serial="00A1" meter={false} siteId={null} {...p} /></MemoryRouter>);

beforeEach(() => {
  Object.values(mockApi).forEach(f => f.mockReset());
  mockCan = () => true;
  mockApi.getDevice.mockResolvedValue(dev());
  mockApi.getAlerts.mockResolvedValue([]);
  mockApi.getPresetFresh.mockResolvedValue([{ config_id: 'cfg-1', name: 'Rooftop 3-phase', version: 3, slaves_count: 2 }]);
  mockApi.getRegisterCoverage.mockResolvedValue({ coverage_pct: 75, total_received: 3, total_configured: 4, last_telemetry_at: '2026-10-29T10:00:00Z',
    slaves: [{ slave_id: 1, device_name: 'Inverter', enabled: true, received: 3, configured: 4, registers: [{ id: 1, label: 'pv1_power', address: 10, received: true, value: 5 }] }] });
});

describe('DetailsTab', () => {
  it('D3 lists only this device\'s open alerts', async () => {
    mockApi.getAlerts.mockResolvedValue([alert(), alert({ id: 2, message: 'Battery low', severity: 'warning', device_id: '47' }), alert({ id: 3, message: 'Other device', device_id: '99', device_serial: 'ZZ' }), alert({ id: 4, message: 'Old', status: 'resolved' })]);
    tab();
    expect(await screen.findByText('Grid lost')).toBeInTheDocument();
    expect(screen.getByText('Battery low')).toBeInTheDocument();
    expect(screen.queryByText('Other device')).toBeNull();
    expect(screen.queryByText('Old')).toBeNull();
  });

  it('D4 says so when there are none', async () => {
    tab();
    expect(await screen.findByText('No active alerts for this device.')).toBeInTheDocument();
  });

  it('D5 still shows the device when the alerts call fails', async () => {
    mockApi.getAlerts.mockRejectedValue(new Error('x'));
    tab();
    expect(await screen.findByText(/Couldn't load the alerts/)).toBeInTheDocument();
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
  });

  it('D6 shows each fact the device reports and leaves out the ones it never sends', async () => {
    tab();
    expect(await screen.findByText('61%')).toBeInTheDocument();
    expect(screen.getByText('Wi-Fi strength')).toBeInTheDocument();
    expect(screen.getByText('120000 bytes')).toBeInTheDocument();
    expect(screen.getByText('41.3 °C')).toBeInTheDocument();
    expect(screen.queryByText('Assigned to')).toBeNull();
  });

  it('D6b leaves out temperature 0.0, memory and last confirmed when not reported', async () => {
    mockApi.getDevice.mockResolvedValue(dev({ device_temp_c: 0, memory_status: null, config_acked_at: null, signal_strength_dbm: -61 }));
    tab();
    await screen.findByText('About this device');
    ['Temperature', 'Free memory', 'Last confirmed by the device'].forEach(l => expect(screen.queryByText(l)).toBeNull());
  });

  it('D7 links the site, or says there is none', async () => {
    const { unmount } = tab({ siteId: 'SS-00002' });
    expect(await screen.findByRole('link', { name: 'SS-00002' })).toHaveAttribute('href', '/sites/SS-00002');
    unmount();
    tab();
    expect(await screen.findByText('Not at a site')).toBeInTheDocument();
  });

  it('D8 shows a pending preset with its name and version gap', async () => {
    tab();
    expect(await screen.findByText('Waiting for device')).toBeInTheDocument();
    expect(await screen.findByText('Rooftop 3-phase')).toBeInTheDocument();
    expect(screen.getByText(/latest is v3/)).toBeInTheDocument();
  });

  it('D9 says when no preset is assigned', async () => {
    mockApi.getDevice.mockResolvedValue(dev({ config_version: null }));
    tab();
    expect(await screen.findByText('No preset assigned')).toBeInTheDocument();
  });

  it('D10 loads coverage only when opened, then opens a slave', async () => {
    tab();
    await screen.findByText('About this device');
    expect(mockApi.getRegisterCoverage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Register coverage/ }));
    expect(await screen.findByText(/75%, 3 \/ 4 registers/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Slave 1/ }));
    expect(screen.getByText('pv1_power')).toBeInTheDocument();
  });

  it('D11 has no coverage for an energy meter', async () => {
    tab({ meter: true });
    await screen.findByText('About this device');
    expect(screen.queryByText('Register coverage')).toBeNull();
  });

  it('D12 survives a failed coverage call', async () => {
    mockApi.getRegisterCoverage.mockRejectedValue(new Error('x'));
    tab();
    await screen.findByText('About this device');
    fireEvent.click(screen.getByRole('button', { name: /Register coverage/ }));
    expect(await screen.findByText('No telemetry yet')).toBeInTheDocument();
  });
});

describe('DeviceDashboard staff actions', () => {
  const LIST = () => <span data-testid="list" />;
  const page = (url = '/devices/47/dashboard') => render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/devices/:deviceId/dashboard" element={<DeviceDashboard />} /><Route path="/devices" element={<LIST />} /></Routes>
    </MemoryRouter>,
  );
  beforeEach(() => {
    mockApi.getDeviceDashboard.mockResolvedValue({ device_id: 47, serial: '00A1', device_type: 'gateway', is_online: true, last_heartbeat: null, site_id: null,
      last_reading_at: '2026-10-29T10:00:00Z', range_start: '', range_end: '', bucket_minutes: 5, sampled_every: 1, latest: {}, history: [] });
    mockApi.getDeviceSeries.mockResolvedValue({});
    mockApi.getPresets.mockResolvedValue([]);
  });

  it('D1 staff get a Details tab after Operations', async () => {
    page();
    await screen.findByText('Monitor 00A1');
    expect(screen.getAllByRole('tab').map(t => t.textContent?.replace(/\d+$/, ''))).toEqual(['Overview', 'All values', 'Every reading', 'Operations', 'Details']);
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Details' })); });
    expect(await screen.findByText('About this device')).toBeInTheDocument();
  });

  it('D2 a viewer sees no Details tab, Edit or Delete', async () => {
    mockCan = f => f === 'my_sites' || f === 'device_control';
    page();
    await screen.findByText('Monitor 00A1');
    expect(screen.queryByRole('tab', { name: 'Details' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('D13 Edit loads the full record and saves it', async () => {
    mockApi.updateDevice.mockResolvedValue({});
    page();
    await screen.findByText('Monitor 00A1');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByText('save-edit'));
    await waitFor(() => expect(mockApi.updateDevice).toHaveBeenCalledWith(47, { model: 'X' }));
    await waitFor(() => expect(mockApi.getDeviceDashboard).toHaveBeenCalledTimes(2));
  });

  it('D14 Delete asks, deletes, then goes back to the list', async () => {
    mockApi.deleteDevice.mockResolvedValue({});
    page();
    await screen.findByText('Monitor 00A1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(await screen.findByText('confirm-delete'));
    expect(await screen.findByTestId('list')).toBeInTheDocument();
    expect(mockApi.deleteDevice).toHaveBeenCalledWith(47, { mode: 'x' });
  });

  it('D15 no Delete without destructive access', async () => {
    mockCan = f => f !== 'destructive';
    page();
    await screen.findByText('Monitor 00A1');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});
