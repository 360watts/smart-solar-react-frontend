import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditDeviceModal from './EditDeviceModal';

// docs/test-scenarios/role-based-hiding.md IP-8, IP-11
jest.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
const mockCan = jest.fn();
jest.mock('../../shared/access/useAccess', () => ({ useAccess: () => ({ can: mockCan }) }));

const DEVICE = { id: 7, device_serial: 'GW-7', device_type: 'gateway' as const, provisioned_at: '2026-01-01T00:00:00Z' };
const save = async (wifi_ssid?: string) => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<EditDeviceModal isOpen device={{ ...DEVICE, wifi_ssid }} isDark={false} onClose={jest.fn()} onSave={onSave} />);
  return onSave;
};
const clickSave = () => fireEvent.click(screen.getByText('Save Changes'));

it('employee: SSID managed by an admin, no Wi-Fi fields sent', async () => {
  mockCan.mockReturnValue(false);
  const onSave = await save(undefined);
  expect(screen.getByText('Managed by an admin')).not.toBeNull();
  expect(screen.queryByPlaceholderText('Network name')).toBeNull();
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  const payload = onSave.mock.calls[0][0];
  expect('wifi_ssid' in payload).toBe(false);
  expect('wifi_password' in payload).toBe(false);
});

it('admin: untouched SSID is not sent', async () => {
  mockCan.mockReturnValue(true);
  const onSave = await save('HomeNet');
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect('wifi_ssid' in onSave.mock.calls[0][0]).toBe(false);
});

it('admin: a changed SSID is sent', async () => {
  mockCan.mockReturnValue(true);
  const onSave = await save('HomeNet');
  fireEvent.change(screen.getByPlaceholderText('Network name'), { target: { value: 'NewNet' } });
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].wifi_ssid).toBe('NewNet');
});

// docs/test-scenarios/meter-controls.md M1–M5, C7
jest.mock('../../services/api', () => ({ apiService: { calibrateMeter: jest.fn(), getDevice: jest.fn() } }));
const METER = { id: 9, device_serial: 'EM-9', device_type: 'energy_meter' as const, provisioned_at: '2026-01-01T00:00:00Z', is_online: true };
const openMeter = (extra = {}) => {
  mockCan.mockReturnValue(true);
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<EditDeviceModal isOpen device={{ ...METER, ...extra }} isDark={false} onClose={jest.fn()} onSave={onSave} />);
  return onSave;
};

it('M1: meter shows Meter settings and hides gateway-only fields', () => {
  openMeter();
  expect(screen.getByRole('region', { name: 'Meter settings' })).not.toBeNull();
  for (const gone of ['Config Version ID', 'Auto Reboot', 'Log Streaming']) expect(screen.queryByText(gone)).toBeNull();
});

it('M2: gateway has no meter section and keeps its fields', async () => {
  mockCan.mockReturnValue(true);
  await save('HomeNet');
  expect(screen.queryByRole('region', { name: 'Meter settings' })).toBeNull();
  for (const kept of ['Config Version ID', 'Auto Reboot', 'Log Streaming']) expect(screen.getByText(kept)).not.toBeNull();
});

it('M3: a changed interval is sent with Save', async () => {
  const onSave = openMeter();
  fireEvent.click(screen.getByRole('button', { name: '10 s' }));
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].meter_publish_interval_ms).toBe(10000);
});

it('M4 + C7: untouched interval and calibration are never in the Save payload', async () => {
  const onSave = openMeter({ meter_publish_interval_ms: 5000 });
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  const payload = onSave.mock.calls[0][0];
  expect('meter_publish_interval_ms' in payload).toBe(false);
  expect(Object.keys(payload).some(k => k.includes('calibrat'))).toBe(false);
});

it('M5: out-of-range interval blocks Save', async () => {
  const onSave = openMeter();
  fireEvent.change(screen.getByLabelText(/How often the meter sends readings/), { target: { value: '3601' } });
  clickSave();
  expect(await screen.findByText(/Reading interval must be 1–3600 seconds/)).not.toBeNull();
  expect(onSave).not.toHaveBeenCalled();
});
