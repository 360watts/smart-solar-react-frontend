import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import MeterSettingsSection, { MeterFields } from './MeterSettingsSection';
import { apiService } from '../../services/api';

// docs/test-scenarios/meter-controls.md (IDs in test names)
jest.mock('../../services/api', () => ({ apiService: { calibrateMeter: jest.fn(), getDevice: jest.fn() } }));
const api = apiService as unknown as { calibrateMeter: jest.Mock; getDevice: jest.Mock };

const METER: MeterFields = { id: 9, is_online: true };

const renderSection = (device: Partial<MeterFields> = {}, canCalibrate = true) =>
  render(<MeterSettingsSection device={{ ...METER, ...device }} isDark={false} intervalMs={null}
    onIntervalChange={jest.fn()} canCalibrate={canCalibrate} />);

beforeEach(() => { api.calibrateMeter.mockReset(); api.getDevice.mockReset(); });

it('C1: single-phase shows only V1/I1, three-phase shows all six', () => {
  renderSection();
  expect(screen.getByLabelText('Voltage (V)')).not.toBeNull();
  expect(screen.queryByLabelText('Phase B voltage (V)')).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Three-phase' }));
  for (const p of 'ABC') {
    expect(screen.getByLabelText(`Phase ${p} voltage (V)`)).not.toBeNull();
    expect(screen.getByLabelText(`Phase ${p} current (A)`)).not.toBeNull();
  }
});

it('C2: out-of-range values disable Calibrate', () => {
  renderSection();
  fireEvent.change(screen.getByLabelText('Voltage (V)'), { target: { value: '400' } });
  expect(screen.getByRole('alert').textContent).toMatch(/Voltage must be 100–300 V/);
  expect((screen.getByText('Calibrate meter') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Voltage (V)'), { target: { value: '230' } });
  fireEvent.change(screen.getByLabelText('Current (A)'), { target: { value: '0' } });
  expect(screen.getByRole('alert').textContent).toMatch(/Current must be/);
});

it('C3: Calibrate goes through the confirm dialog and sends once', async () => {
  api.calibrateMeter.mockResolvedValue({ ...METER, meter_calibration_status: 'pending' });
  renderSection();
  fireEvent.click(screen.getByText('Calibrate meter'));
  expect(api.calibrateMeter).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Calibrate' })); });
  expect(api.calibrateMeter).toHaveBeenCalledTimes(1);
  expect(api.calibrateMeter).toHaveBeenCalledWith(9, { mode: 'single', v: [230], i: [5] });
  expect(screen.getByText('Waiting for meter')).not.toBeNull();
});

it('C4: pending polls every 10 s and stops at confirmed', async () => {
  jest.useFakeTimers();
  try {
    api.getDevice
      .mockResolvedValueOnce({ ...METER, meter_calibration_status: 'pending' })
      .mockResolvedValueOnce({ ...METER, meter_calibration_status: 'confirmed', meter_calibration_confirmed_at: '2026-10-22T10:00:00Z' });
    renderSection({ meter_calibration_status: 'pending' });
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(api.getDevice).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(screen.getByText(/Calibrated at/)).not.toBeNull();
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(api.getDevice).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

it('C5: offline meter has no Calibrate button', () => {
  renderSection({ is_online: false });
  expect(screen.queryByText('Calibrate meter')).toBeNull();
  expect(screen.getByText(/Meter offline/)).not.toBeNull();
});

it('C6: calibration hidden when not allowed; interval still shown', () => {
  renderSection({}, false);
  expect(screen.queryByText('Calibration')).toBeNull();
  expect(screen.getByLabelText(/How often the meter sends readings/)).not.toBeNull();
});
