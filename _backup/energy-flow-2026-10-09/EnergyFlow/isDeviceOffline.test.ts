import { isDeviceOffline, anomalousDevices } from './index';
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

describe('anomalousDevices', () => {
  it('does not flag a never-reported device when a sibling is live (the AC(NEW) case)', () => {
    // AC(NEW): is_active, zero readings ever. Fridge: reporting normally.
    const ac = device({ id: 9, display_name: 'AC(NEW)', latest: null });
    const fridge = device({ id: 6, display_name: 'Fridge 1', latest: reading({ timestamp: minutesAgo(0) }) });
    expect(anomalousDevices([ac, fridge])).toEqual([]);
  });

  it('flags a never-reported device when NO device at the site is live (feed looks down)', () => {
    const ac = device({ id: 9, display_name: 'AC(NEW)', latest: null });
    const fridge = device({ id: 6, display_name: 'Fridge 1', latest: reading({ timestamp: minutesAgo(30) }) });
    expect(anomalousDevices([ac, fridge])).toEqual(['AC(NEW)']);
  });

  it('never flags an inactive device', () => {
    const ac = device({ id: 9, display_name: 'AC(NEW)', is_active: false, latest: null });
    expect(anomalousDevices([ac])).toEqual([]);
  });

  it('never flags a device that has a (possibly stale) reading — that is isDeviceOffline\'s job, not this banner\'s', () => {
    const stale = device({ id: 4, display_name: 'Geyser 1', latest: reading({ timestamp: minutesAgo(60) }) });
    expect(anomalousDevices([stale])).toEqual([]);
  });
});
