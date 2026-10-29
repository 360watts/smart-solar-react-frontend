import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ReadingsTab from '../ReadingsTab';

jest.mock('../../../../services/api', () => ({ apiService: { getDeviceReadings: jest.fn(), getReadingPacket: jest.fn() } }));
const { apiService } = jest.requireMock('../../../../services/api');
const T = (s: number) => new Date(Date.UTC(2026, 9, 29, 9, 0, 0) - s * 1000).toISOString();
const row = (id: number, s: number, extra = {}) => ({ id, t: T(s), values: { pv1_power_w: 1462, grid_power_w: 141, fault_word_1: 0, ...extra } });

beforeEach(() => { jest.resetAllMocks(); try { localStorage.clear(); } catch { /* ignore */ } });

describe('ReadingsTab', () => {
  it('R1/R6 adds gap rows and tints fault rows', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0), row(2, 2), row(3, 4, { fault_word_1: 4 }), row(4, 64), row(5, 66)], next_before: null });
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect(await screen.findByText('No readings for 1 min 0 s')).toBeInTheDocument();
    expect(screen.getByText('0x0004').closest('tr')).toHaveClass('fault');
  });

  it('R2 pages older', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0)], next_before: T(0) });
    render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Older' }));
    expect(apiService.getDeviceReadings).toHaveBeenLastCalledWith(47, { before: T(0) });
  });

  it('R3/R4 opens the packet beside the table, and says when the message was pruned', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(9, 0)], next_before: null });
    apiService.getReadingPacket.mockResolvedValue({ kind: 'gateway', reading_time: T(0), received_at: T(0), reading: { pv1_power_w: 1462 }, message: null, message_note: 'pruned' });
    const { container } = render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click((await screen.findByText('1,462')).closest('tr')!);
    const panel = await screen.findByRole('region', { name: /Packet as the device sent it/ });
    expect(await within(panel).findByText(/"pv1_power_w": 1462/)).toBeInTheDocument();
    expect(within(panel).getByText(/older than 14 days and has been removed/)).toBeInTheDocument();
    expect(container.querySelector('.dt-split')).toHaveClass('open');
  });

  it('R5 shows the meter message as sent', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [{ id: 3, t: T(0), values: { voltage_l1: 231 } }], next_before: null });
    apiService.getReadingPacket.mockResolvedValue({ kind: 'meter', reading_time: T(0), raw: 'SRMTR1^1^0^V:231', parsed: { voltage_l1: 231 } });
    render(<ReadingsTab deviceId={5} meter />);
    fireEvent.click(await screen.findByRole('button', { name: /Open packet/ }));
    expect(await screen.findByText('SRMTR1^1^0^V:231')).toBeInTheDocument();
  });

  it('R9 shows the latest packet when responses arrive out of order', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0), row(2, 2)], next_before: null });
    let first: (v: unknown) => void = () => {};
    apiService.getReadingPacket
      .mockImplementationOnce(() => new Promise(r => { first = r; }))
      .mockResolvedValueOnce({ kind: 'gateway', reading_time: T(2), received_at: T(2), reading: { marker: 'second' }, message: null, message_note: null });
    render(<ReadingsTab deviceId={47} meter={false} />);
    const buttons = await screen.findAllByRole('button', { name: /Open packet/ });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(await screen.findByText(/"marker": "second"/)).toBeInTheDocument();
    await act(async () => { first({ kind: 'gateway', reading_time: T(0), received_at: T(0), reading: { marker: 'first' }, message: null, message_note: null }); });
    expect(screen.queryByText(/"marker": "first"/)).not.toBeInTheDocument();
    expect(screen.getByText(/"marker": "second"/)).toBeInTheDocument();
  });

  it('R10 says so when the page fails to load', async () => {
    apiService.getDeviceReadings.mockRejectedValue(new Error('boom'));
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect(await screen.findByText("Couldn't load readings. Try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText(/No readings in the last 10 days/)).not.toBeInTheDocument();
  });

  it('R11 Older then Newer returns to the first page', async () => {
    apiService.getDeviceReadings
      .mockResolvedValueOnce({ rows: [row(1, 0)], next_before: 'cursor-1' })
      .mockResolvedValueOnce({ rows: [row(2, 100)], next_before: null })
      .mockResolvedValueOnce({ rows: [row(1, 0)], next_before: 'cursor-1' });
    render(<ReadingsTab deviceId={47} meter={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Older' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Newer' }));
    await screen.findByRole('button', { name: 'Older' });
    expect(apiService.getDeviceReadings.mock.calls).toEqual([[47, {}], [47, { before: 'cursor-1' }], [47, {}]]);
    expect(screen.queryByRole('button', { name: 'Newer' })).not.toBeInTheDocument();
  });

  it('R12 tints a row for a fault code in a column that is not shown', async () => {
    apiService.getDeviceReadings.mockResolvedValue({ rows: [row(1, 0, { warning_code_2: 8 })], next_before: null });
    render(<ReadingsTab deviceId={47} meter={false} />);
    expect((await screen.findByText('1,462')).closest('tr')).toHaveClass('fault');
  });
});
