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

it('shows Backup first with offline plugs last (R1)', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  const rows = screen.getAllByTestId('plug-row').map(r => within(r).getByTestId('plug-name').textContent);
  expect(rows).toEqual(['Fridge 1', 'Water Pump', 'EV Charger']);
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

it('groups tiles into circuit rows, each ranked by draw (R7)', () => {
  render(<PlugsTab smartDevices={[...DEVICES, mk(6, 'Fridge 2', 300, fresh, 1)]} isDark siteId="s1" />);
  expect(screen.getByTestId('circuit-ev').textContent).toBe('EV · 1');
  expect(screen.getByTestId('circuit-backup').textContent).toBe('Backup · 2');
  expect(screen.getByTestId('circuit-grid').textContent).toBe('Grid direct · 1');
  const backup = within(screen.getByRole('region', { name: 'Backup plugs' })).getAllByTestId('plug-name').map(n => n.textContent);
  expect(backup).toEqual(['Fridge 2', 'Fridge 1']);
});

it('keeps Backup first, then most installed plugs counting offline ones, ties EV before Grid (R12)', () => {
  const order = () => screen.getAllByTestId(/^circuit-/).map(n => n.getAttribute('data-testid'));
  const { unmount } = render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  expect(order()).toEqual(['circuit-backup', 'circuit-grid', 'circuit-ev']);
  unmount();
  render(<PlugsTab smartDevices={DEVICES.filter(d => d.id !== 4)} isDark siteId="s1" />);
  expect(order()).toEqual(['circuit-backup', 'circuit-ev', 'circuit-grid']);
});

describe('circuit load bars', () => {
  const BACKUP = [mk(2, 'Fridge 1', 96, fresh, 0.9), mk(7, 'AC 3', 9, fresh, 0.1, { appliance_label: 'ac_unit' })];
  const draw = (devices: SmartDeviceNode[], backup: number | null, grid: number | null = null) =>
    render(<PlugsTab smartDevices={devices} isDark siteId="s1" circuitKw={{ backup, grid }} />);

  it('compares plugs to the inverter reading, with a segment per plug and swatches (R13)', () => {
    draw(BACKUP, 0.64);
    const head = screen.getByTestId('load-backup').textContent;
    expect(head).toContain('105 of 640 W');
    expect(head).toContain('backup load');
    expect(head).toContain('535 W not on a plug');
    expect(screen.getByTestId('bar-backup').children).toHaveLength(3);
    expect(screen.getByTestId('swatch-Fridge 1')).not.toBeNull();
  });

  it.each([[null], [0]])('shows only the plug total when the reading is %s (R14)', reading => {
    draw(BACKUP, reading);
    expect(screen.queryByTestId('bar-backup')).toBeNull();
    expect(screen.queryByTestId('swatch-Fridge 1')).toBeNull();
    expect(screen.getByTestId('load-backup').textContent).toBe('105 W on plugs');
  });

  it('drops the gap when plugs add up to more than the reading (R15)', () => {
    draw(BACKUP, 0.05);
    expect(screen.getByTestId('bar-backup').children).toHaveLength(2);
    expect(screen.queryByTestId('gap-backup')).toBeNull();
    expect(screen.getByTestId('load-backup').textContent).toBe('105 W on plugs');
  });

  it('says when the gap includes a plug that is not reporting (R16)', () => {
    draw([...BACKUP, mk(8, 'Fridge 2', 50, old, null)], 0.64);
    expect(screen.getByTestId('load-backup').textContent).toContain('includes 1 plug not reporting');
  });

  it('gives Grid direct the same bar from the meter (R17)', () => {
    draw(DEVICES, null, 1.2);
    expect(screen.getByTestId('load-grid').textContent).toContain('0.00 of 1.20 kW');
    expect(screen.getByTestId('load-grid').textContent).toContain('grid-direct load');
    expect(screen.getByTestId('bar-grid').children).toHaveLength(1);
  });

  it('shows no bar or row total for a single EV plug (R18)', () => {
    draw(DEVICES, 0.64, 1.2);
    expect(screen.queryByTestId('bar-ev')).toBeNull();
    expect(screen.queryByTestId('load-ev')).toBeNull();
  });
});

it('shows Standby on the tile and leaves it out of the running count (R20)', () => {
  render(<PlugsTab smartDevices={[mk(2, 'Fridge 1', 96, fresh, 0.9), mk(7, 'AC 3', 9, fresh, 0.1, { appliance_label: 'ac_unit' })]} isDark siteId="s1" />);
  expect(screen.getByTestId('plug-state-AC 3').textContent).toBe('Standby');
  expect(screen.getByTestId('sum-running').textContent).toBe('1 of 2 running');
});

it('offline chip shows today so the summary can be reconciled (R22)', () => {
  render(<PlugsTab smartDevices={[DEVICES[1], mk(4, 'Geyser 1', 900, old, 2.5, { circuit: 'grid_direct', appliance_label: 'geyser' })]} isDark siteId="s1" />);
  expect(screen.getByTestId('plug-offline-Geyser 1').textContent).toContain('Today 2.5 kWh');
});

it('leaves amps and volts to the popup (R23)', () => {
  const latest = { power_w: 96, current_a: 0.42, voltage_v: 231, energy_kwh: null, switch_on: true, timestamp: fresh };
  render(<PlugsTab smartDevices={[mk(2, 'Fridge 1', 96, fresh, 0.9, { latest })]} isDark siteId="s1" />);
  const tile = screen.getByTestId('plug-row').textContent;
  expect(tile).not.toContain('231');
  expect(tile).not.toContain('0.42');
});

it('row click opens the detail modal (R6)', () => {
  render(<PlugsTab smartDevices={DEVICES} isDark siteId="s1" />);
  fireEvent.click(screen.getAllByTestId('plug-row')[0]);
  expect(screen.getByTestId('node-modal').textContent).toContain('Fridge 1');
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
