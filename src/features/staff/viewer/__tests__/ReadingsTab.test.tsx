import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ReadingsTab from '../ReadingsTab';

jest.mock('../../../../services/api', () => ({ apiService: { getDeviceReadings: jest.fn(), getReadingPacket: jest.fn() } }));
const { apiService } = jest.requireMock('../../../../services/api');
const T = (s: number) => new Date(Date.UTC(2026, 9, 29, 9, 0, 0) - s * 1000).toISOString();
const row = (id: number, s: number, extra = {}) => ({ id, t: T(s), values: { pv1_power_w: 1462, grid_power_w: 141, fault_word_1: 0, ...extra } });
const gw = (reading: unknown, extra = {}) => ({ kind: 'gateway', reading_time: T(0), received_at: T(0), reading, message: null, message_note: null, ...extra });
const loaded = () => screen.findAllByRole('row');
const packetPanel = () => screen.findByRole('complementary', { name: 'Packet' });

beforeEach(() => { jest.resetAllMocks(); try { localStorage.clear(); } catch { /* ignore */ } });

describe('ReadingsTab', () => {
  it('R1/R6/RR6 adds gap rows (with times) and tints fault rows', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0), row(2, 2), row(3, 4, { fault_word_1: 4 }), row(4, 64), row(5, 66)], next_before: null });
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect(await screen.findByText(/No readings for 1 min 0 s \(.+ to .+\)\. The device was not sending\./)).toBeInTheDocument();
    expect(screen.getByText('0x0004').closest('tr')).toHaveClass('fault');
  });

  it('R2 pages older', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0)], next_before: T(0) });
    render(<ReadingsTab deviceId={47} meter={false} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Older' }));
    expect(apiService.getDeviceReadings).toHaveBeenLastCalledWith(47, { before: T(0) });
  });

  it('R3/R4 opens the packet beside the table, and says when the message was pruned', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(9, 0)], next_before: null });
    apiService.getReadingPacket.mockResolvedValue(gw({ pv1_power_w: 1462 }, { message_note: 'pruned' }));
    const { container } = render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click((await screen.findByText('1,462')).closest('tr')!);
    const panel = await packetPanel();
    expect(await within(panel).findByText(/"pv1_power_w"/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Message on the wire' }));
    expect(within(panel).getByText(/older than 14 days and has been removed/)).toBeInTheDocument();
    expect(container.querySelector('.rt-split')).toBeInTheDocument();
  });

  it('R5/RR14 shows the meter message as sent', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [{ id: 3, t: T(0), values: { voltage_l1: 231 } }], next_before: null });
    apiService.getReadingPacket.mockResolvedValue({ kind: 'meter', reading_time: T(0), raw: 'SRMTR1^1^0^V:231', parsed: { voltage_l1: 231 } });
    render(<ReadingsTab deviceId={5} meter />);
    fireEvent.click(await screen.findByRole('button', { name: /Open packet/ }));
    expect(await screen.findByText(/"voltage_l1"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Message on the wire' }));
    expect(screen.getByText('SRMTR1^1^0^V:231')).toBeInTheDocument();
  });

  it('R9/RR17 shows the latest packet when responses arrive out of order', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0), row(2, 2)], next_before: null });
    let first: (v: unknown) => void = () => {};
    apiService.getReadingPacket
      .mockImplementationOnce(() => new Promise(r => { first = r; }))
      .mockResolvedValueOnce(gw({ marker: 'second' }));
    render(<ReadingsTab deviceId={47} meter={false} />);
    const buttons = await screen.findAllByRole('button', { name: /Open packet/ });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(await screen.findByText(/"second"/)).toBeInTheDocument();
    await act(async () => { first(gw({ marker: 'first' })); });
    expect(screen.queryByText(/"first"/)).not.toBeInTheDocument();
    expect(screen.getByText(/"second"/)).toBeInTheDocument();
  });

  it('R10/RR18 says so when the page fails to load', async () => {
    apiService.getDeviceReadings.mockRejectedValue(new Error('boom'));
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect(await screen.findByText("Couldn't load readings")).toBeInTheDocument();
    expect(screen.queryByText(/No readings in the last 10 days/)).not.toBeInTheDocument();
  });

  it('RR18 says so when there are no readings', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [], next_before: null });
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect(await screen.findByText('No readings in the last 10 days')).toBeInTheDocument();
  });

  it('R11/RR3 Older then Newer returns to the first page', async () => {
    apiService.getDeviceReadings
      .mockResolvedValueOnce({ rows: [row(1, 0)], next_before: 'cursor-1' })
      .mockResolvedValueOnce({ rows: [row(2, 100)], next_before: null })
      .mockResolvedValueOnce({ rows: [row(1, 0)], next_before: 'cursor-1' });
    render(<ReadingsTab deviceId={47} meter={false} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Older' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Newer' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Newer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Older' })).toBeEnabled());
    expect(apiService.getDeviceReadings.mock.calls).toEqual([[47, {}], [47, { before: 'cursor-1' }], [47, {}]]);
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
  });

  it('R12 tints a row for a fault code in a column that is not shown', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0, { warning_code_2: 8 })], next_before: null });
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect((await screen.findByText('1,462')).closest('tr')).toHaveClass('fault');
  });

  it('RR1/RR2/RR5 toolbar, range line and columns count', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0), row(2, 2)], next_before: 'c' });
    render(<ReadingsTab deviceId={47} meter={false} />);
    await loaded();
    expect(screen.getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Older' })).toBeEnabled();
    expect(document.querySelector('.rt-range')).toHaveTextContent(/^2 readings, .+ back to .+\.$/);
    expect(screen.queryByText(/added at the top/)).not.toBeInTheDocument();
    expect(screen.getByText('Columns').parentElement).toHaveTextContent('Columns 7');
    fireEvent.click(screen.getByLabelText('pv1 power W'));
    expect(screen.getByText('Columns').parentElement).toHaveTextContent('Columns 6');
  });

  it('RR4/RR9 jump and Older 100', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0)], next_before: 'c1' });
    render(<ReadingsTab deviceId={47} meter={false} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Older 100' }));
    expect(apiService.getDeviceReadings).toHaveBeenLastCalledWith(47, { before: 'c1' });
    fireEvent.change(screen.getByLabelText('Jump to'), { target: { value: '2026-10-30T10:02' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(apiService.getDeviceReadings).toHaveBeenLastCalledWith(47, { before: new Date('2026-10-30T10:02').toISOString() });
  });

  it('RR7/RR8/RR16 selection, keyboard and close', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0), row(2, 2)], next_before: null });
    apiService.getReadingPacket.mockResolvedValue(gw({ a: 1 }));
    render(<ReadingsTab deviceId={47} meter={false} />);
    const first = (await screen.findAllByRole('row'))[1];
    fireEvent.click(first);
    expect(first).toHaveClass('selected');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.rt-foot')).toHaveTextContent('Reading 1 of 2 selected');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(apiService.getReadingPacket).toHaveBeenLastCalledWith(47, 2);
    expect(document.querySelector('.rt-foot')).toHaveTextContent('Reading 2 of 2 selected');
    fireEvent.keyDown(screen.getAllByRole('row')[2], { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Packet' })).not.toBeInTheDocument();
    fireEvent.click(first);
    await packetPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Close packet' }));
    expect(screen.queryByRole('complementary', { name: 'Packet' })).not.toBeInTheDocument();
  });

  it('RR11/RR12/RR13/RR15 gateway packet summary, keys, wire view, copy', async () => {
    const reading: Record<string, number> = { fault_word_1: 4 };
    for (let i = 0; i < 12; i++) reading[`k${i}`] = i;
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(9, 0)], next_before: null });
    apiService.getReadingPacket.mockResolvedValue(gw(reading, {
      message: { received_at: new Date(Date.parse(T(0)) + 300).toISOString(), size_bytes: 2150, text: '{"wire":1}', hex: null } }));
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click((await screen.findByText('1,462')).closest('tr')!);
    const panel = await packetPanel();
    expect(await within(panel).findByText(/nearest message 0\.3 s later/)).toBeInTheDocument();
    expect(within(panel).getByText('1 fault code')).toBeInTheDocument();
    expect(within(panel).getByText('13')).toBeInTheDocument();
    expect(within(panel).getByText('"fault_word_1"').closest('.rt-hl')).toBeInTheDocument();
    expect(within(panel).getByText(/… 6 more keys/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy as JSON' }));
    expect(writeText).toHaveBeenLastCalledWith(JSON.stringify(reading, null, 2));
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy one row as CSV' }));
    expect(writeText.mock.calls[1][0].split('\n')[0]).toMatch(/^fault_word_1,k0,/);
    fireEvent.click(within(panel).getByRole('button', { name: 'Show all 13 keys' }));
    expect(within(panel).queryByText(/more keys/)).not.toBeInTheDocument();
    expect(within(panel).getByText('"k11"')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Message on the wire' }));
    expect(within(panel).getByText('{"wire":1}')).toBeInTheDocument();
  });

  it('RR10 shows the table skeleton while loading', () => {
    apiService.getDeviceReadings.mockReturnValue(new Promise(() => {}));
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('RR17 says so when the packet fails to load', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0)], next_before: null });
    apiService.getReadingPacket.mockRejectedValue(new Error('x'));
    render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click((await screen.findByText('1,462')).closest('tr')!);
    expect(await screen.findByText(/Couldn't load this packet/)).toBeInTheDocument();
  });
});
