// docs/test-scenarios/gateway-activity.md (H4-H12)
import React from 'react';
import { render, screen } from '@testing-library/react';
import HealthCheckResult, { healthChecks, checkSummary, rawRows } from './HealthCheckResult';

const good = { trigger: 1, sd_status: 0, sd_size: 32000, sd_free: 31000, data_status: 0, data_devices: 1, net_active: 1, net_active_text: 'wifi',
  wifi_status: 0, wifi_rssi: -58, cell_status: 22, cell_csq: 0, mqtt_status: 0, mqtt_latency_ms: 85 };
const TS = '2026-10-26T05:11:00Z';
const by = (c: ReturnType<typeof healthChecks>, n: string) => c.find(x => x.name === n)!;

it('H4 healthy Wi-Fi unit: all good, mobile data is "not used", not a problem', () => {
  const c = healthChecks(good, TS);
  expect(checkSummary(c)).toBe('All good');
  expect(by(c, 'Mobile data').state).toBe('na');
  expect(by(c, 'Internet').text).toBe('On Wi-Fi, signal good (-58 dBm)');
  expect(by(c, 'Cloud').text).toBe('Connected, replies in 85 ms');
  expect(by(c, 'Memory card').text).toBe('31.0 GB free of 32.0 GB');
});

it('H5 no uplink with an unregistered SIM is a problem', () => {
  const c = healthChecks({ ...good, net_active: 0, wifi_status: 11 }, TS);
  expect(by(c, 'Internet').state).toBe('look');
  expect(by(c, 'Mobile data').text).toMatch(/Check the SIM and APN/);
  expect(checkSummary(c)).toBe('4 of 6 fine, 2 need a look');
});

it('H6 inverter, card and cloud failures give their own advice', () => {
  const c = healthChecks({ ...good, data_status: 51, sd_status: 31, mqtt_status: 41 }, TS);
  expect(by(c, 'Inverter link').text).toMatch(/RS-485 wiring/);
  expect(by(c, 'Memory card').text).toBe('No card inserted.');
  expect(by(c, 'Cloud').text).toBe("Can't reach the cloud.");
});

it('H7 weak Wi-Fi and a missing clock are flagged', () => {
  const c = healthChecks({ ...good, wifi_rssi: -80 }, null);
  expect(by(c, 'Internet').state).toBe('look');
  expect(by(c, 'Clock').state).toBe('look');
});

it('H8 cellular signal is converted from CSQ', () => {
  const c = healthChecks({ ...good, net_active: 2, cell_status: 0, cell_csq: 15 }, TS);
  expect(by(c, 'Internet').text).toBe('On mobile data, signal -83 dBm');
  expect(by(c, 'Mobile data').text).toBe('Registered, signal -83 dBm');
});

it('H9 all 14 values are listed, missing ones read n/a', () => {
  expect(rawRows(good, TS)).toHaveLength(14);
  const rows = Object.fromEntries(rawRows({ trigger: 2 }, null));
  expect(rows['Started by']).toBe('2 (BOOT button)');
  expect(rows['MQTT reply']).toBe('n/a');
  expect(rows['Time']).toBe('not set');
});

it('H10 the result renders the checklist and the table', () => {
  render(<HealthCheckResult isDark={false} event={{ id: 1, event: 'diag', payload: good, received_at: TS, device_ts: TS }} />);
  expect(screen.getByText('All good')).toBeTruthy();
  expect(screen.getByText('All 14 values')).toBeTruthy();
  expect(screen.getByText('-58 dBm', { selector: 'dd' })).toBeTruthy();
});
