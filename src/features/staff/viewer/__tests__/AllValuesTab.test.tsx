import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import AllValuesTab from '../AllValuesTab';

const R = (id: string, label: string, unit: string, keys = [id]) => ({ id, label, unit, keys });
const T = (m: number) => new Date(Date.UTC(2026, 9, 1, 10, m)).toISOString();
const hist = (rows: Record<string, number>[]) => rows.map((r, i) => ({ t: T(i * 10), ...r })) as any;

const sections: [string, ReturnType<typeof R>[]][] = [
  ['Solar', [R('pv1_power_w', 'PV1 power', 'W'), R('pv2_power_w', 'PV2 power', 'W'), R('pv_energy_today_kwh', 'Solar today', 'kWh')]],
  ['Grid', [R('grid_lN_voltage_v', 'Grid voltage per phase', 'V', ['grid_l1_voltage_v', 'grid_l2_voltage_v', 'grid_l3_voltage_v']), R('grid_frequency_hz', 'Frequency', 'Hz')]],
  ['Status and codes', [R('fault_word_1', 'Fault word 1', ''), R('warning_word_1', 'Warning word 1', ''), R('data_source', 'Data source', '')]],
];
const latest = { pv1_power_w: 512.4, pv2_power_w: 300, pv_energy_today_kwh: 4.2, grid_l1_voltage_v: 231, grid_l2_voltage_v: 229, grid_l3_voltage_v: 230, grid_frequency_hz: 50, fault_word_1: 4, warning_word_1: 0, data_source: 'rs485' };
const history = hist([
  { pv1_power_w: 500, pv2_power_w: 300, pv_energy_today_kwh: 4, grid_l1_voltage_v: 231, grid_frequency_hz: 50, fault_word_1: 0 },
  { pv1_power_w: 520, pv2_power_w: 300, pv_energy_today_kwh: 4.2, grid_l1_voltage_v: 232, grid_frequency_hz: 50, fault_word_1: 4 },
]);
const ui = (over: Partial<React.ComponentProps<typeof AllValuesTab>> = {}) =>
  render(<AllValuesTab sections={sections} latest={latest} history={history} lastReadingAt={T(10)} {...over} />);
const card = (name: string) => screen.getByRole('region', { name });

describe('AllValuesTab', () => {
  it('V1 one card per group with count, label, key, value and unit', () => {
    ui();
    const solar = card('Solar');
    expect(within(solar).getByText('3')).toBeInTheDocument();
    expect(within(solar).getByText('PV1 power')).toBeInTheDocument();
    expect(within(solar).getByText('pv1_power_w')).toBeInTheDocument();
    expect(within(solar).getByText((_, el) => el?.textContent === '512W')).toBeInTheDocument();
  });

  it('V2 phases become R, Y, B rows with their own keys', () => {
    ui();
    const grid = card('Grid');
    ['grid_l1_voltage_v', 'grid_l2_voltage_v', 'grid_l3_voltage_v'].forEach(k => expect(within(grid).getByText(k)).toBeInTheDocument());
    ['R', 'Y', 'B'].forEach(p => expect(within(grid).getByText(p)).toBeInTheDocument());
  });

  it('V3 measurements get a line, counters and codes do not', () => {
    ui();
    expect(card('Solar').querySelectorAll('polyline')).toHaveLength(2); // pv1 + pv2, not kWh
    expect(card('Faults and warnings').querySelectorAll('polyline')).toHaveLength(0);
  });

  it('V4 faults are an amber card with hex codes and no invented change time', () => {
    ui();
    const f = card('Faults and warnings');
    expect(within(f).getByText('1 active')).toBeInTheDocument();
    expect(within(f).getByText('0x0004')).toBeInTheDocument();
    expect(within(f).getByText('0x0000')).toBeInTheDocument();
    expect(within(f).queryByText(/changed/)).toBeNull();
    expect(within(card('Status and codes')).getByText('rs485')).toBeInTheDocument();
  });

  it('V5 shows 5 rows and the rest on Show more', () => {
    const many = [['Solar', Array.from({ length: 7 }, (_, i) => R(`pv${i}_power_w`, `String ${i}`, 'W'))]] as typeof sections;
    ui({ sections: many, latest: {}, history: [] });
    const c = card('Solar');
    expect(c.querySelectorAll('.av-row')).toHaveLength(5);
    fireEvent.click(within(c).getByRole('button', { name: 'Show 2 more' }));
    expect(c.querySelectorAll('.av-row')).toHaveLength(7);
    expect(within(c).getByRole('button', { name: 'Show fewer' })).toBeInTheDocument();
  });

  it('V6 search matches label or key and drops empty cards', () => {
    ui();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a value' }), { target: { value: 'pv2' } });
    expect(screen.getByText('PV2 power')).toBeInTheDocument();
    expect(screen.queryByText('PV1 power')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Grid' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'frequency' } });
    expect(screen.getByText('grid_frequency_hz')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No value matches that.')).toBeInTheDocument();
  });

  it('V7 filter pills count and filter', () => {
    ui();
    expect(screen.getByRole('button', { name: 'All 10' })).toHaveAttribute('aria-pressed', 'true');
    // changing: pv1 and grid l1 vary; pv2, frequency do not
    expect(screen.getByRole('button', { name: /Changing now 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faults and warnings 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Changing now/ }));
    expect(screen.getByText('PV1 power')).toBeInTheDocument();
    expect(screen.queryByText('PV2 power')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Faults and warnings/ }));
    expect(screen.getByText('0x0004')).toBeInTheDocument();
    expect(screen.queryByText('0x0000')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'All 10' }));
    expect(screen.getByText('PV2 power')).toBeInTheDocument();
  });

  it('V8 clicking a key copies it', () => {
    const writeText = jest.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    ui();
    fireEvent.click(screen.getByText('pv1_power_w'));
    expect(writeText).toHaveBeenCalledWith('pv1_power_w');
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('V9 meter groups use the same layout', () => {
    ui({ sections: [['Voltage', [R('voltage_lN', 'Voltage per phase', 'V', ['voltage_l1', 'voltage_l2', 'voltage_l3'])]]], latest: { voltage_l1: 230, voltage_l2: 231, voltage_l3: 229 }, history: [] });
    expect(within(card('Voltage')).getByText('voltage_l2')).toBeInTheDocument();
  });

  it('V10 caps at 6 groups until Show all groups, search shows all', () => {
    const eight = Array.from({ length: 8 }, (_, i) => [`G${i}`, [R(`k${i}_v`, `Row ${i}`, 'V')]]) as typeof sections;
    ui({ sections: eight, latest: {}, history: [] });
    expect(screen.getAllByRole('region')).toHaveLength(6);
    expect(screen.getByText(/Showing 6 of 8 groups/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all groups' }));
    expect(screen.getAllByRole('region')).toHaveLength(8);
  });
});
