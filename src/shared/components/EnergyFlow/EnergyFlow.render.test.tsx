import React from 'react';
import { render, screen } from '@testing-library/react';
import EnergyFlowBlock from './index';

jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../services/api', () => ({
  apiService: { getLatestEnergyMeter: jest.fn().mockResolvedValue(null) },
}));

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} disconnect() {} };
});

const now = () => new Date().toISOString();
const plug = (id: number, display_name: string, circuit: 'grid_direct' | 'inverter_backup', power_w = 100) => ({
  id, display_name, circuit, device_type: 'tuya_plug' as const, appliance_label: 'other' as const, is_active: true, is_online: true,
  latest: { power_w, current_a: null, voltage_v: null, energy_kwh: null, switch_on: true, timestamp: now() },
});

// docs/test-scenarios/dashboard-redesign.md rows 9, 44
it('renders three equal cards per rail and empty today values', () => {
  render(<EnergyFlowBlock pvKw={1.73} loadKw={0.289} gridKw={0.022} battKw={-1.33} battSoc={72} />);
  ['Solar made today', 'Home used', 'From your own power', 'Live ledger', 'Inverter supply mix'].forEach(t =>
    expect(screen.getByText(t)).not.toBeNull());
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  expect(screen.queryByText('Running mostly on sun')).toBeNull();
});

// docs/test-scenarios/dashboard-redesign.md rows 24, 38
it('source cards are flat and fill their column', () => {
  const { container } = render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0.2} battKw={0} battSoc={50} />);
  ['Solar PV', 'Battery', 'Grid Tie'].forEach(label => {
    // "Battery" is also the right-rail tile title: pick the one inside a flat source card.
    const card = screen.getAllByText(label).map(el => el.closest('[data-flat-card]')).find(Boolean) as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.style.width).toBe('100%');
  });
  // no progress-arc gauges left on the source cards
  expect(container.querySelectorAll('[data-flat-card] svg').length).toBe(0);
});

// docs/test-scenarios/dashboard-redesign.md row 28 (rewritten as row 40)
it('battery source card shows direction and SoC; the right rail has a matching Battery card', () => {
  render(<EnergyFlowBlock pvKw={1.73} loadKw={0.289} gridKw={0.022} battKw={-1.33} battSoc={72} />);
  expect(screen.getByText('Charging · 72%')).not.toBeNull();
  expect(screen.getByText('Charging · 1.33 kW')).not.toBeNull();
  expect(screen.getAllByText('Battery').length).toBe(2);
});

// docs/test-scenarios/dashboard-redesign.md row 39
it('grid card says Selling when exporting', () => {
  render(<EnergyFlowBlock pvKw={3} loadKw={0.5} gridKw={-1.2} battKw={0} battSoc={50} />);
  expect(screen.getByText('Selling')).not.toBeNull();
});

// docs/test-scenarios/dashboard-redesign.md rows 41-42
it('removes the duplicate readouts and the nested load boxes', () => {
  render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0.2} battKw={0} battSoc={50}
    smartDevices={[plug(3, 'Fridge 1', 'inverter_backup')]} onOpenPlugs={() => {}} />);
  expect(screen.queryByText('Site Total')).toBeNull();
  expect(screen.queryByText(/Same as Backup/i)).toBeNull();
  expect(screen.queryByText('Detail ›')).toBeNull();
  expect(screen.queryByText('Plugs total')).toBeNull(); // inverter figure exists
  expect(screen.queryByText('Ring shows the mix')).toBeNull();
});

// docs/test-scenarios/dashboard-redesign.md row 44
it('mix is one bar with a three-item legend', () => {
  const { container } = render(<EnergyFlowBlock pvKw={1.73} loadKw={0.289} gridKw={0.022} battKw={-1.33} battSoc={72} />);
  expect(screen.getByText('Solar 99%')).not.toBeNull();
  expect(screen.getByText('Battery 0%')).not.toBeNull();
  expect(screen.getByText('Grid 1%')).not.toBeNull();
  expect(container.querySelectorAll('[data-mix]').length).toBe(2); // zero-share segment not drawn
});

// docs/test-scenarios/dashboard-redesign.md row 42
it('load card shows the plugs total only when there is no meter or inverter figure', () => {
  render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0} battKw={0} battSoc={50}
    smartDevices={[plug(1, 'Washer', 'grid_direct', 237)]} onOpenPlugs={() => {}} />);
  expect(screen.getByText('Plugs total')).not.toBeNull();
  // value sits right above the sub-line, on one line: "237" + "W"
  expect(screen.getByText('Plugs total').previousElementSibling!.textContent).toBe('237W');
});

// docs/test-scenarios/dashboard-redesign.md row 45
it('the whole Backup card opens the detail; the plug link does not', () => {
  const onOpenPlugs = jest.fn();
  render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0} battKw={0} battSoc={50}
    smartDevices={[plug(3, 'Fridge 1', 'inverter_backup')]} onOpenPlugs={onOpenPlugs} />);
  screen.getByRole('button', { name: '1 smart plug ›' }).click();
  expect(onOpenPlugs).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Inverter AC Output — same reading as above')).toBeNull();
  // the card itself is the click target (opening it is a live check: the modal fetches history)
  expect(screen.getByRole('button', { name: 'Backup Load details' })).not.toBeNull();
});

// docs/test-scenarios/smart-plugs-tab.md EF-1, EF-2
it('shows load totals with a plug link instead of per-plug cards', () => {
  const onOpenPlugs = jest.fn();
  render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0} battKw={0} battSoc={50}
    smartDevices={[plug(1, 'Washer', 'grid_direct'), plug(2, 'Geyser', 'grid_direct'), plug(3, 'Fridge 1', 'inverter_backup')]}
    onOpenPlugs={onOpenPlugs} />);
  expect(screen.queryByText('Washer')).toBeNull();
  expect(screen.queryByText('Fridge 1')).toBeNull();
  screen.getByRole('button', { name: '2 smart plugs ›' }).click();
  expect(onOpenPlugs).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '1 smart plug ›' })).not.toBeNull();
});

// docs/test-scenarios/dashboard-redesign.md row 29
it('without onOpenPlugs, lists the plugs inline under a collapsible "Smart plugs (N)"', () => {
  render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0} battKw={0} battSoc={50}
    smartDevices={[plug(1, 'Washer', 'grid_direct'), plug(2, 'Geyser', 'grid_direct')]} />);
  expect(screen.getByText('Smart plugs (2)').tagName).toBe('SUMMARY');
  expect(screen.queryByRole('button', { name: /smart plugs ›/ })).toBeNull();
  expect(screen.getByText('Washer')).not.toBeNull();
  expect(screen.getByText('Geyser')).not.toBeNull();
  expect(screen.getAllByText('Running').length).toBe(2);
});

// docs/test-scenarios/dashboard-redesign.md row 35
it('shows a "Partly counted" caption under Home used when partial', () => {
  render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0} battKw={0} battSoc={50}
    today={{ usedKwh: 5, ownPct: 80, usedPartial: 'Backup + Grid direct' }} />);
  const cap = screen.getByText('Partly counted · Backup + Grid direct');
  expect(cap.getAttribute('title')).toMatch(/only Backup \+ Grid direct/);
});

// docs/test-scenarios/dashboard-redesign.md rows 70-72
it('no EV plug: two load cards and two load lines; EV plug: three', () => {
  const { container, rerender } = render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0.2} battKw={0} battSoc={50} />);
  expect(screen.queryByText('EV Charging')).toBeNull();
  expect(screen.getByText('Backup Load')).not.toBeNull();
  expect(screen.getByText('Grid Direct')).not.toBeNull();
  expect(container.querySelectorAll('.ef-row2').length).toBe(1);
  const ev = { ...plug(9, 'EV', 'grid_direct'), appliance_label: 'ev_charger' as const };
  rerender(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0.2} battKw={0} battSoc={50} smartDevices={[ev] as any} />);
  expect(screen.getByText('EV Charging')).not.toBeNull();
  expect(container.querySelectorAll('.ef-row2').length).toBe(0);
});

// docs/test-scenarios/dashboard-redesign.md rows 90-91: both rails are three equal cards (approved mockup).
it('each rail is a column of three equal-share tiles', () => {
  const { container } = render(<EnergyFlowBlock pvKw={1} loadKw={0.5} gridKw={0.2} battKw={0} battSoc={50} />);
  ['left', 'right'].forEach(side => {
    const rail = container.querySelector(`[data-rail="${side}"]`) as HTMLElement;
    expect(rail).not.toBeNull();
    const tiles = rail.querySelectorAll<HTMLElement>('[data-rail-tile]');
    expect(tiles.length).toBe(3);
    tiles.forEach(t => expect(t.style.flex).toBe('1 1 0px')); // jsdom normalises "1 1 0" to "1 1 0px"
  });
});

// docs/test-scenarios/dashboard-redesign.md row 94: the ring holds only HOME USES and the whole-home value.
it('ring shows no parts line (Backup / EV breakdown)', () => {
  render(<EnergyFlowBlock pvKw={1.73} loadKw={0.351} gridKw={0.022} battKw={0} battSoc={72} />);
  expect(screen.getByText('HOME USES')).not.toBeNull();
  expect(screen.queryByText(/^Backup \d+ W$/)).toBeNull();
  expect(screen.queryByText(/^EV [\d.]+ kW$/)).toBeNull();
});
