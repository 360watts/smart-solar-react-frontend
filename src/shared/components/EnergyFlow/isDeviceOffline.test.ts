import { isDeviceOffline } from './index';
import type { SmartDeviceNode, SmartDeviceReading } from './types';

function reading(overrides: Partial<SmartDeviceReading>): SmartDeviceReading {
  return {
    power_w: 100, current_a: 0.5, voltage_v: 230, energy_kwh: 1.0,
    switch_on: true, timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function device(overrides: Partial<SmartDeviceNode>): SmartDeviceNode {
  return {
    id: 1,
    device_type: 'tuya_plug',
    appliance_label: 'ac_unit',
    display_name: 'Test Plug',
    is_active: true,
    is_online: true,
    latest: null,
    ...overrides,
  };
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe('isDeviceOffline', () => {
  it('is not offline with a reading from just now', () => {
    expect(isDeviceOffline(device({ latest: reading({ timestamp: minutesAgo(0) }) }))).toBe(false);
  });

  it('is not offline with a reading a few minutes old', () => {
    expect(isDeviceOffline(device({ latest: reading({ timestamp: minutesAgo(4) }) }))).toBe(false);
  });

  it('is offline once the last reading is stale (>5 min)', () => {
    // This is exactly the AC(NEW) case at coim_002: is_online stayed true
    // and poller_consecutive_failures kept resetting to 0-1, but the last
    // actual reading was over 21 hours old — reading recency is the signal
    // that actually catches it.
    expect(isDeviceOffline(device({
      is_online: true,
      poller_consecutive_failures: 0,
      latest: reading({ timestamp: minutesAgo(6) }),
    }))).toBe(true);
  });

  it('is offline when there has never been a reading at all', () => {
    expect(isDeviceOffline(device({ latest: null }))).toBe(true);
  });

  it('ignores is_online when the reading is fresh (matches backend: data recency is the gate, is_online only classifies why)', () => {
    expect(isDeviceOffline(device({ is_online: false, latest: reading({ timestamp: minutesAgo(0) }) }))).toBe(false);
  });

  it('ignores poller_consecutive_failures when the reading is fresh', () => {
    expect(isDeviceOffline(device({ poller_consecutive_failures: 20, latest: reading({ timestamp: minutesAgo(0) }) }))).toBe(false);
  });
});
