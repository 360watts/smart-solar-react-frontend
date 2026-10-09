import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PlugsTab from './PlugsTab';
import type { SmartDeviceNode } from '../../EnergyFlow/types';

// Scenarios: docs/test-scenarios/smart-plugs-tab.md (PT-*).
jest.mock('../../EnergyFlow/NodeDetailModal', () => ({
  __esModule: true,
  default: (p: any) => (p.node ? <div data-testid="node-modal">{p.node.title}</div> : null),
}));

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const plug = (o: Partial<SmartDeviceNode>): SmartDeviceNode => ({
  id: 1, device_type: 'tuya_plug', appliance_label: 'other', display_name: 'Plug', is_active: true, is_online: true,
  latest: { power_w: 0, current_a: null, voltage_v: null, energy_kwh: null, switch_on: true, timestamp: minutesAgo(1) },
  ...o,
});

const DEVICES: SmartDeviceNode[] = [
  plug({ id: 1, display_name: 'Fridge 1', appliance_label: 'fridge', circuit: 'inverter_backup',
    latest: { power_w: 120, current_a: 0.5, voltage_v: 230, energy_kwh: 4, switch_on: true, timestamp: minutesAgo(1) } }),
  plug({ id: 2, display_name: 'AC(NEW)', appliance_label: 'ac_unit', circuit: 'grid_direct', latest: null }),
  plug({ id: 3, display_name: 'Washer', appliance_label: 'washing_machine', circuit: 'grid_direct' }),
  plug({ id: 4, display_name: 'EV charger', appliance_label: 'ev_charger', circuit: 'ev_line',
    latest: { power_w: 3000, current_a: 13, voltage_v: 230, energy_kwh: 50, switch_on: true, timestamp: minutesAgo(10) } }),
  plug({ id: 5, display_name: 'Main meter', appliance_label: 'grid' }),
];

const group = (title: string) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;

describe('PlugsTab', () => {
  it('groups plugs by what they are wired to (PT-1)', () => {
    render(<PlugsTab smartDevices={DEVICES} isDark={false} siteId="s1" />);
    const titles = screen.getAllByRole('heading').map(h => h.textContent);
    expect(titles).toEqual(['Backup (via inverter)', 'Grid direct', 'EV charging']);
    expect(within(group('Backup (via inverter)')).getByText('Fridge 1')).not.toBeNull();
    expect(within(group('Grid direct')).getByText('AC(NEW)')).not.toBeNull();
    expect(within(group('Grid direct')).getByText('Washer')).not.toBeNull();
    expect(within(group('EV charging')).getByText('EV charger')).not.toBeNull();
    expect(screen.queryByText('Main meter')).toBeNull();
  });

  it('shows Offline for stale or missing readings, Running and Idle otherwise (PT-2..4)', () => {
    render(<PlugsTab smartDevices={DEVICES} isDark={false} siteId="s1" />);
    const row = (name: string) => screen.getByRole('button', { name: new RegExp(name.replace(/[()]/g, '\\$&')) });
    expect(row('AC(NEW)').textContent).toMatch(/Offline/);
    expect(row('EV charger').textContent).toMatch(/Offline/);
    expect(row('EV charger').textContent).not.toMatch(/3\.00|3000/);
    expect(row('Fridge 1').textContent).toMatch(/Running/);
    expect(row('Fridge 1').textContent).toMatch(/120/);
    expect(row('Washer').textContent).toMatch(/Idle/);
  });

  it('shows an empty state with no plugs (PT-5)', () => {
    render(<PlugsTab smartDevices={[DEVICES[4]]} isDark={false} siteId="s1" />);
    expect(screen.getByText('No smart plugs at this site yet')).not.toBeNull();
  });

  it('opens the plug detail on tap (PT-6)', () => {
    render(<PlugsTab smartDevices={DEVICES} isDark={false} siteId="s1" />);
    expect(screen.queryByTestId('node-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Fridge 1/ }));
    expect(screen.getByTestId('node-modal').textContent).toBe('Fridge 1');
  });

  it('has no on/off control (PT-7: no plug switch API is wired)', () => {
    render(<PlugsTab smartDevices={DEVICES} isDark={false} siteId="s1" />);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/turn (on|off)/i)).toBeNull();
  });
});
