import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ViewerDevices from '../ViewerDevices';
import { clearDeviceCache } from '../deviceCache';

const ViewerDevicesAt = (p: { siteId: string }) => <MemoryRouter><ViewerDevices {...p} /></MemoryRouter>;

jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../services/api', () => ({
  apiService: { getSiteGatewayStatus: jest.fn(), getFirmwareVersions: jest.fn() },
}));
const { apiService } = jest.requireMock('../../../../services/api');
const recent = new Date(Date.now() - 4 * 60_000).toISOString();
const DEVICES = [
  { device_id: 11, device_type: 'gateway', serial: 'GW-1', is_online: true, last_heartbeat: recent, firmware_version: 'v2.2.1-3P' },
  { device_id: 12, device_type: 'energy_meter', serial: 'EM-1', is_online: false, last_heartbeat: null, firmware_version: '1.0.0' },
];
const FIRMWARE = [
  { id: 5, version: '2.2.1', device_type: 'gateway', is_active: true, created_at: '2026-09-01T00:00:00Z' },
  { id: 7, version: '1.1.0', device_type: 'energymeter', is_active: true, created_at: '2026-10-01T00:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  clearDeviceCache();
  apiService.getSiteGatewayStatus.mockResolvedValue({ devices: DEVICES });
  apiService.getFirmwareVersions.mockResolvedValue(FIRMWARE);
});

describe('ViewerDevices', () => {
  it('lists only the given site\'s devices with calm status and firmware (LS-1, LS-2)', async () => {
    render(<ViewerDevicesAt siteId="s1" />);
    expect(await screen.findByText('Monitor GW-1')).not.toBeNull();
    expect(screen.getByText('Meter EM-1')).not.toBeNull();
    expect(apiService.getSiteGatewayStatus).toHaveBeenCalledTimes(1);
    expect(apiService.getSiteGatewayStatus).toHaveBeenCalledWith('s1');
    expect(screen.getByText(/last update 4 minutes ago/i)).not.toBeNull();
    expect(screen.getByText('Not reporting')).not.toBeNull();
    expect(screen.getByText(/firmware v2\.2\.1-3P/i)).not.toBeNull();
  });

  it('hints an update only where a newer version exists, ignoring v/-suffix (LS-6)', async () => {
    render(<ViewerDevicesAt siteId="s1" />);
    await screen.findByText('Monitor GW-1');
    expect(await screen.findAllByText('Update available')).toHaveLength(1);
    const meterRow = screen.getByRole('link', { name: /meter em-1/i });
    expect(meterRow.textContent).toMatch(/update available/i);
  });

  it('keeps rows when the firmware list is refused (LS-7)', async () => {
    apiService.getFirmwareVersions.mockRejectedValueOnce(new Error('403'));
    render(<ViewerDevicesAt siteId="s1" />);
    expect(await screen.findByText('Monitor GW-1')).not.toBeNull();
    expect(screen.queryByText('Update available')).toBeNull();
  });

  it('each tile links to the device page (LS-8)', async () => {
    render(<ViewerDevicesAt siteId="s1" />);
    await screen.findByText('Meter EM-1');
    expect(screen.getByRole('link', { name: /meter em-1/i }).getAttribute('href')).toBe('/my-sites/s1/devices/12');
  });

  it('reuses the cached list on a second visit and fetches firmware once (cache)', async () => {
    const first = render(<ViewerDevicesAt siteId="s1" />);
    await screen.findByText('Monitor GW-1');
    first.unmount();
    render(<ViewerDevicesAt siteId="s1" />);
    await screen.findByText('Monitor GW-1');
    expect(apiService.getSiteGatewayStatus).toHaveBeenCalledTimes(1);
    expect(apiService.getFirmwareVersions).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state (LS-3) and a retry on failure (LS-4)', async () => {
    apiService.getSiteGatewayStatus.mockResolvedValueOnce({ devices: [] });
    const { unmount } = render(<ViewerDevicesAt siteId="s1" />);
    expect(await screen.findByText(/no devices at this site yet/i)).not.toBeNull();
    unmount();
    clearDeviceCache();

    apiService.getSiteGatewayStatus.mockRejectedValueOnce(new Error('500'));
    render(<ViewerDevicesAt siteId="s1" />);
    expect(await screen.findByText(/couldn't load the devices/i)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Monitor GW-1')).not.toBeNull();
  });
});

it('forgets cached devices when the account logs out (cache)', async () => {
  const first = render(<ViewerDevicesAt siteId="s1" />);
  await screen.findByText('Monitor GW-1');
  first.unmount();
  window.dispatchEvent(new Event('360w:logout'));
  render(<ViewerDevicesAt siteId="s1" />);
  await screen.findByText('Monitor GW-1');
  expect(apiService.getSiteGatewayStatus).toHaveBeenCalledTimes(2);
});
