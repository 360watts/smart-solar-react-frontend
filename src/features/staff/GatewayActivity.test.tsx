// docs/test-scenarios/gateway-activity.md (IDs in comments)
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GatewayActivity from './GatewayActivity';
import { apiService } from '../../services/api';

jest.mock('../../services/api', () => ({ apiService: { getDeviceEvents: jest.fn(), setDeviceApn: jest.fn(), runDeviceDiagnostics: jest.fn() } }));
const api = apiService as jest.Mocked<typeof apiService>;

const ev = (id: number, event: string, payload: Record<string, unknown> = {}) =>
  ({ id, event, payload, received_at: '2026-10-20T06:00:00Z', device_ts: null });
const events = (...rows: ReturnType<typeof ev>[]) => api.getDeviceEvents.mockResolvedValue({ results: rows });

beforeEach(() => jest.resetAllMocks());

it('N1 wifi failure with name', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} device={{ wifi_failure: { ssid: 'Home', reason: 'auth_failed' } }} />);
  expect(screen.getByText(/Couldn't join Wi-Fi Home: wrong password/)).toBeTruthy();
  await waitFor(() => expect(api.getDeviceEvents).toHaveBeenCalled());
});

it('N2 wifi failure without name', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} device={{ wifi_failure: { reason: 'auth_failed' } }} />);
  expect(screen.getByText(/^Couldn't join Wi-Fi: wrong password/)).toBeTruthy();
  await waitFor(() => expect(api.getDeviceEvents).toHaveBeenCalled());
});

it('N3 refused settings', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} device={{ config_rejected: 'CFG:4' }} />);
  expect(screen.getByText(/refused settings CFG v4\. Fix the preset/)).toBeTruthy();
  await waitFor(() => expect(api.getDeviceEvents).toHaveBeenCalled());
});

it('N4 + N5 battery, and a V1 device shows nothing extra', async () => {
  events();
  const { rerender } = render(<GatewayActivity deviceId={1} isDark={false} device={{ battery_pct: 87 }} />);
  expect(screen.getByText('87% charged')).toBeTruthy();
  rerender(<GatewayActivity deviceId={1} isDark={false} device={{ battery_pct: null, config_rejected: '', wifi_failure: null }} />);
  await waitFor(() => expect(api.getDeviceEvents).toHaveBeenCalled());
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText(/Backup battery/)).toBeNull();
});

it('A1 no APN form without permission', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} />);
  await waitFor(() => expect(api.getDeviceEvents).toHaveBeenCalled());
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

it('H1 no health-check button without permission', async () => {
  events();
  render(<GatewayActivity deviceId={1} isDark={false} />);
  await waitFor(() => expect(api.getDeviceEvents).toHaveBeenCalled());
  expect(screen.queryByText('Run health check')).toBeNull();
});

it('H2 health check sends, then shows the hidden health rows', async () => {
  events();
  api.runDeviceDiagnostics.mockResolvedValue({});
  render(<GatewayActivity deviceId={7} isDark={false} allowCheck />);
  fireEvent.click(await screen.findByText('Run health check'));
  await waitFor(() => expect(api.runDeviceDiagnostics).toHaveBeenCalledWith(7));
  expect(await screen.findByText(/Sent\. The result appears below/)).toBeTruthy();
});

it('H3 health check failure is shown', async () => {
  events();
  api.runDeviceDiagnostics.mockRejectedValue(new Error('MQTT publish queue unavailable'));
  render(<GatewayActivity deviceId={7} isDark={false} allowCheck />);
  fireEvent.click(await screen.findByText('Run health check'));
  expect(await screen.findByText('MQTT publish queue unavailable')).toBeTruthy();
});

it('A4 APN backend refusal is shown', async () => {
  events();
  api.setDeviceApn.mockRejectedValue(new Error('APN too long'));
  render(<GatewayActivity deviceId={7} isDark={false} allowApn />);
  fireEvent.click(screen.getByText('Mobile data settings (APN)'));
  fireEvent.change(screen.getByLabelText('APN'), { target: { value: 'x' } });
  fireEvent.click(screen.getByText('Save APN'));
  fireEvent.click(screen.getByText('Send'));
  expect(await screen.findByText('APN too long')).toBeTruthy();
});

it('H11 shows the newest health check, no history list', async () => {
  events(ev(1, 'diag', { net_active: 1, wifi_rssi: -58, mqtt_status: 0, mqtt_latency_ms: 85, net_active_text: 'wifi' }), ev(2, 'uplink_wifi'));
  render(<GatewayActivity deviceId={1} isDark={false} />);
  await screen.findByText('Connected, replies in 85 ms');
  expect(screen.queryByText('History')).toBeNull();
  expect(screen.queryByText('Switched to Wi-Fi')).toBeNull();
});
