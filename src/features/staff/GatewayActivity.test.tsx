// docs/test-scenarios/gateway-activity.md (IDs in comments)
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GatewayActivity from './GatewayActivity';
import { apiService } from '../../services/api';

jest.mock('../../services/api', () => ({ apiService: { getDeviceEvents: jest.fn(), setDeviceApn: jest.fn() } }));
const api = apiService as jest.Mocked<typeof apiService>;

const ev = (id: number, event: string, payload: Record<string, unknown> = {}) =>
  ({ id, event, payload, received_at: '2026-10-20T06:00:00Z', device_ts: null });
const events = (...rows: ReturnType<typeof ev>[]) => api.getDeviceEvents.mockResolvedValue({ results: rows });

beforeEach(() => jest.resetAllMocks());

it('N1 wifi failure with name', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} device={{ wifi_failure: { ssid: 'Home', reason: 'auth_failed' } }} />);
  expect(screen.getByText(/Couldn't join Wi-Fi Home: wrong password/)).toBeTruthy();
  await screen.findByText(/No activity yet/);
});

it('N2 wifi failure without name', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} device={{ wifi_failure: { reason: 'auth_failed' } }} />);
  expect(screen.getByText(/^Couldn't join Wi-Fi: wrong password/)).toBeTruthy();
  await screen.findByText(/No activity yet/);
});

it('N3 refused settings', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} device={{ config_rejected: 'CFG:4' }} />);
  expect(screen.getByText(/refused settings CFG v4\. Fix the preset/)).toBeTruthy();
  await screen.findByText(/No activity yet/);
});

it('N4 + N5 battery, and a V1 device shows nothing extra', async () => {
  events();
  const { rerender } = render(<GatewayActivity deviceId={1} isDark={false} device={{ battery_pct: 87 }} />);
  expect(screen.getByText('Backup battery 87%')).toBeTruthy();
  rerender(<GatewayActivity deviceId={1} isDark={false} device={{ battery_pct: null, config_rejected: '', wifi_failure: null }} />);
  expect(await screen.findByText(/No activity yet/)).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText(/Backup battery/)).toBeNull();
});

it('E1-E3, E5 plain-language rows', async () => {
  events(ev(1, 'ota_failed', { errorCode: 10 }), ev(2, 'ota_progress', { percent: 40 }), ev(3, 'command_deferred', { command: 'reboot' }), ev(4, 'foo_bar'));
  render(<GatewayActivity deviceId={1} isDark={false} />);
  expect(await screen.findByText('Firmware update failed: file check failed')).toBeTruthy();
  expect(screen.getByText('Downloading firmware: 40%')).toBeTruthy();
  expect(screen.getByText(/Postponed restart \(busy\)/)).toBeTruthy();
  expect(screen.getByText('foo bar')).toBeTruthy();
});

it('E4 health checks hidden until asked', async () => {
  events(ev(1, 'diag', { net_active_text: 'cellular' }), ev(2, 'mqtt_connected'));
  render(<GatewayActivity deviceId={1} isDark={false} />);
  expect(await screen.findByText(/No activity yet/)).toBeTruthy();
  fireEvent.click(screen.getByText('Show health checks'));
  expect(screen.getByText('Health check: network cellular')).toBeTruthy();
  expect(screen.getByText('Connected to the cloud')).toBeTruthy();
});

it('E6 load failure offers a retry', async () => {
  api.getDeviceEvents.mockRejectedValueOnce(new Error('down'));
  render(<GatewayActivity deviceId={1} isDark={false} />);
  expect(await screen.findByText(/Couldn't load activity/)).toBeTruthy();
  events(ev(1, 'uplink_wifi'));
  fireEvent.click(screen.getByText('Try again'));
  expect(await screen.findByText('Switched to Wi-Fi')).toBeTruthy();
});

it('A1 no APN form without permission', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} />);
  await screen.findByText(/No activity yet/);
  expect(screen.queryByText(/Mobile data settings/)).toBeNull();
});

it('A2 + A3 APN save', async () => {
  events();
  api.setDeviceApn.mockResolvedValue({});
  render(<GatewayActivity deviceId={7} isDark={false} allowApn />);
  fireEvent.click(screen.getByText('Mobile data settings (APN)'));
  const save = screen.getByText('Save APN').closest('button')!;
  expect(save.disabled).toBe(true);  // empty
  const input = screen.getByLabelText('APN');
  fireEvent.change(input, { target: { value: 'bad^apn' } });
  expect(screen.getByRole('alert').textContent).toMatch(/\^/);
  expect(save.disabled).toBe(true);
  fireEvent.change(input, { target: { value: 'airtelgprs.com' } });
  fireEvent.click(save);
  fireEvent.click(screen.getByText('Send'));
  await waitFor(() => expect(api.setDeviceApn).toHaveBeenCalledWith(7, { apn: 'airtelgprs.com' }));
  expect(await screen.findByText(/Sent\. The gateway restarts/)).toBeTruthy();
});
