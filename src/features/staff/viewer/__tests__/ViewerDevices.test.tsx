import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewerDevices from '../ViewerDevices';

jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../services/api', () => ({
  apiService: { getSiteGatewayStatus: jest.fn(), getFirmwareVersions: jest.fn() },
}));
jest.mock('../DeviceDrawer', () => ({
  ...jest.requireActual('../DeviceDrawer'),
  __esModule: true,
  default: (p: any) => <div data-testid="drawer">{p.dev.serial}</div>,
}));

const { apiService } = jest.requireMock('../../../../services/api');
const recent = new Date(Date.now() - 4 * 60_000).toISOString();
const DEVICES = [
  { device_id: 11, device_type: 'gateway', serial: 'GW-1', is_online: true, last_heartbeat: recent, firmware_version: 'v2.2.1-3P' },
  { device_id: 12, device_type: 'energy_meter', serial: 'EM-1', is_online: false, last_heartbeat: null, firmware_version: '1.0.0' },
];
const FIRMWARE = [
  { id: 5, version: '2.2.1', device_type: 'gateway', is_active: true, created_at: '2026-09-01T00:00:00Z' },
  { id: 7, version: '1.1.0', device_type: 'energy_meter', is_active: true, created_at: '2026-10-01T00:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  apiService.getSiteGatewayStatus.mockResolvedValue({ devices: DEVICES });
  apiService.getFirmwareVersions.mockResolvedValue(FIRMWARE);
});

describe('ViewerDevices', () => {
  it('lists only the given site\'s devices with calm status and firmware (LS-1, LS-2)', async () => {
    render(<ViewerDevices siteId="s1" />);
    expect(await screen.findByText('Monitor GW-1')).not.toBeNull();
    expect(screen.getByText('Meter EM-1')).not.toBeNull();
    expect(apiService.getSiteGatewayStatus).toHaveBeenCalledTimes(1);
    expect(apiService.getSiteGatewayStatus).toHaveBeenCalledWith('s1');
    expect(screen.getByText(/last update 4 minutes ago/i)).not.toBeNull();
    expect(screen.getByText('Not reporting')).not.toBeNull();
    expect(screen.getByText(/firmware v2\.2\.1-3P/i)).not.toBeNull();
  });

  it('hints an update only where a newer version exists, ignoring v/-suffix (LS-6)', async () => {
    render(<ViewerDevices siteId="s1" />);
    await screen.findByText('Monitor GW-1');
    expect(await screen.findAllByText('Update available')).toHaveLength(1);
    const meterRow = screen.getByRole('button', { name: /meter em-1/i });
    expect(meterRow.textContent).toMatch(/update available/i);
  });

  it('keeps rows when the firmware list is refused (LS-7)', async () => {
    apiService.getFirmwareVersions.mockRejectedValueOnce(new Error('403'));
    render(<ViewerDevices siteId="s1" />);
    expect(await screen.findByText('Monitor GW-1')).not.toBeNull();
    expect(screen.queryByText('Update available')).toBeNull();
  });

  it('opens the drawer for the clicked row (LS-8)', async () => {
    render(<ViewerDevices siteId="s1" />);
    await screen.findByText('Meter EM-1');
    expect(screen.queryByTestId('drawer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /meter em-1/i }));
    expect(screen.getByTestId('drawer').textContent).toBe('EM-1');
  });

  it('shows the empty state (LS-3) and a retry on failure (LS-4)', async () => {
    apiService.getSiteGatewayStatus.mockResolvedValueOnce({ devices: [] });
    const { unmount } = render(<ViewerDevices siteId="s1" />);
    expect(await screen.findByText(/no devices at this site yet/i)).not.toBeNull();
    unmount();

    apiService.getSiteGatewayStatus.mockRejectedValueOnce(new Error('500'));
    render(<ViewerDevices siteId="s1" />);
    expect(await screen.findByText(/couldn't load the devices/i)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Monitor GW-1')).not.toBeNull();
  });
});
