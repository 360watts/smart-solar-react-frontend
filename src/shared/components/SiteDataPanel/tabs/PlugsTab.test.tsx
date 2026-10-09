import { render, screen, within, fireEvent } from '@testing-library/react';
import PlugsTab from './PlugsTab';
import type { SmartDeviceNode } from '../../EnergyFlow/types';

// Scenarios: docs/test-scenarios/smart-plugs-tab.md (R*).
jest.mock('../../EnergyFlow/NodeDetailModal', () => ({
  __esModule: true,
  default: (p: any) => (p.node ? <div data-testid="node-modal">{p.node.title}</div> : null),
}));

const NOW = Date.parse('2026-10-08T11:08:00Z');
const fresh = new Date(NOW - 60_000).toISOString();
const old = new Date(NOW - 3 * 3_600_000).toISOString();
const mk = (id: number, name: string, w: number, ts: string | null, kwh: number | null, extra: Partial<SmartDeviceNode> = {}): SmartDeviceNode => ({
  id, device_type: 'tuya_plug', appliance_label: 'fridge', display_name: name, is_active: true, is_online: true,
  circuit: 'inverter_backup',
  latest: ts ? { power_w: w, current_a: null, voltage_v: null, energy_kwh: null, switch_on: true, timestamp: ts } : null,
  today: { kwh_today: kwh, curve_24h: Array(24).fill(null).map((_, i) => (i > 20 ? 1 : null)) },
  ...extra,
});
const DEVICES = [
  mk(1, 'EV Charger', 2680, fresh, 3.2, { appliance_label: 'ev_charger', circuit: 'ev_line' }),
  mk(2, 'Fridge 1', 82, fresh, 1.9),
  mk(3, 'Water Pump', 0, fresh, 0.3, { circuit: 'grid_direct', appliance_label: 'water_pump' }),
  mk(4, 'Geyser 1', 900, old, null, { circuit: 'grid_direct', appliance_label: 'geyser' }),
];

beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(NOW); });
afterEach(() => jest.restoreAllMocks());

it('ranks by live draw with offline plugs last (R1)', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  const rows = screen.getAllByTestId('plug-row').map(r => within(r).getByTestId('plug-name').textContent);
  expect(rows).toEqual(['EV Charger', 'Fridge 1', 'Water Pump']);
  expect(screen.getByTestId('plug-offline-Geyser 1')).not.toBeNull();
});

it('summary strip adds up fresh draw and counts states (R2)', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  expect(screen.getByTestId('sum-now').textContent).toContain('2.76');
  expect(screen.getByTestId('sum-running').textContent).toContain('2');
  expect(screen.getByText('Not reporting · 1')).not.toBeNull();
});

it('offline plug shows no wattage, only when it was last seen (R3)', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  const off = screen.getByTestId('plug-offline-Geyser 1');
  expect(off.textContent).toContain('Last seen 3 h ago');
  expect(off.textContent).not.toContain('900');
});

it('missing today figure leaves the line out and the summary says partly counted (R4)', () => {
  render(<PlugsTab smartDevices={[DEVICES[0], mk(5, 'Fridge 2', 50, fresh, null)]} isDark siteId="s1" />);
  expect(screen.queryByTestId('plug-today-Fridge 2')).toBeNull();
  expect(screen.getByTestId('sum-today-note').textContent).toContain('partly counted');
});

it('shows the circuit as a muted label (R7)', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  expect(screen.getByTestId('plug-circuit-EV Charger').textContent).toBe('EV');
  expect(screen.getByTestId('plug-circuit-Fridge 1').textContent).toBe('Backup');
  expect(screen.getByTestId('plug-circuit-Water Pump').textContent).toBe('Grid direct');
});

it('row click opens the detail modal (R6)', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  fireEvent.click(screen.getAllByTestId('plug-row')[0]);
  expect(screen.getByTestId('node-modal').textContent).toContain('EV Charger');
});

it('offline chip opens the detail modal too', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  fireEvent.click(screen.getByTestId('plug-offline-Geyser 1'));
  expect(screen.getByTestId('node-modal').textContent).toContain('Geyser 1');
});

it('empty site shows the empty state (R8)', () => {
  render(<PlugsTab smartDevices={[]} isDark siteId="s1" />);
  expect(screen.queryByText('No smart plugs at this site yet')).not.toBeNull();
});
