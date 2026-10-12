import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import BuildsCard from '../BuildsCard';

jest.mock('../../../../services/api', () => ({
  apiService: { getFirmwareVersions: jest.fn(), updateFirmwareVersion: jest.fn().mockResolvedValue({}), uploadFirmwareVersion: jest.fn().mockResolvedValue({}) },
}));
const { apiService } = jest.requireMock('../../../../services/api');
const METER_BUILDS = [{ id: 8, version: '2.0.0', device_type: 'energymeter', is_active: true, created_at: '2026-10-11T00:00:00Z' }];
const BUILDS = [
  { id: 1, version: '1.1.0', device_type: 'gateway', is_active: true, created_at: '2026-10-10T00:00:00Z' },
  { id: 2, version: '1.0.9', device_type: 'gateway', is_active: false, created_at: '2026-09-22T00:00:00Z' },
  { id: 3, version: '9.9.9', device_type: 'energy_meter', is_active: true, created_at: '2026-10-11T00:00:00Z' },
];
beforeEach(() => { jest.clearAllMocks(); apiService.getFirmwareVersions.mockResolvedValue(BUILDS); });
const open = () => render(<BuildsCard isDark={false} deviceType="gateway" kindLabel="Inverter monitor" />);

it('lists only this device type, newest first, with state (OTA-1)', async () => {
  open();
  expect(await screen.findByText('1.1.0')).not.toBeNull();
  expect(screen.queryByText('9.9.9')).toBeNull();
  expect(screen.getByText('Active')).not.toBeNull();
  expect(screen.getByText('Inactive')).not.toBeNull();
});

it('activates only after a confirm that names the build (OTA-2)', async () => {
  open();
  await screen.findByText('1.0.9');
  fireEvent.click(screen.getByRole('button', { name: 'Activate 1.0.9' }));
  expect(apiService.updateFirmwareVersion).not.toHaveBeenCalled();
  const dlg = screen.getByRole('alertdialog');
  expect(dlg.textContent).toMatch(/1\.0\.9/);
  fireEvent.click(within(dlg).getByRole('button', { name: /^activate$/i }));
  await waitFor(() => expect(apiService.updateFirmwareVersion).toHaveBeenCalledWith(2, { is_active: true }));
});

it('uploads inactive for this device type and needs a file and version (OTA-3)', async () => {
  open();
  await screen.findByText('1.1.0');
  fireEvent.click(screen.getByRole('button', { name: /upload build/i }));
  fireEvent.click(screen.getByRole('button', { name: /^upload$/i }));
  expect(await screen.findByText(/choose a file and enter its version/i)).not.toBeNull();
  const file = new File(['x'], 'fw.bin');
  fireEvent.change(screen.getByLabelText('Firmware file'), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.2.0' } });
  fireEvent.click(screen.getByRole('button', { name: /^upload$/i }));
  await waitFor(() => expect(apiService.uploadFirmwareVersion).toHaveBeenCalled());
  const fd = apiService.uploadFirmwareVersion.mock.calls[0][0] as FormData;
  expect(fd.get('device_type')).toBe('gateway');
  expect(fd.get('is_active')).toBe('false');
  expect(fd.get('version')).toBe('1.2.0');
});

it('an energy meter sees and uploads under the firmware name energymeter (OTA-4)', async () => {
  apiService.getFirmwareVersions.mockResolvedValue([...BUILDS, ...METER_BUILDS]);
  render(<BuildsCard isDark={false} deviceType="energy_meter" kindLabel="Whole-home meter" />);
  expect(await screen.findByText('2.0.0')).not.toBeNull();
  expect(screen.queryByText('1.1.0')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /upload build/i }));
  fireEvent.change(screen.getByLabelText('Firmware file'), { target: { files: [new File(['x'], 'em.bin')] } });
  fireEvent.change(screen.getByLabelText('Version'), { target: { value: '2.1.0' } });
  fireEvent.click(screen.getByRole('button', { name: /^upload$/i }));
  await waitFor(() => expect(apiService.uploadFirmwareVersion).toHaveBeenCalled());
  expect((apiService.uploadFirmwareVersion.mock.calls[0][0] as FormData).get('device_type')).toBe('energymeter');
});

it('shows the backend sentence when the upload is refused (OTA-5)', async () => {
  apiService.uploadFirmwareVersion.mockRejectedValueOnce(new Error('Upload failed: 400 - {"error":"Firmware version 1.2.0 already exists for Gateway (ESP32)"}'));
  open();
  await screen.findByText('1.1.0');
  fireEvent.click(screen.getByRole('button', { name: /upload build/i }));
  fireEvent.change(screen.getByLabelText('Firmware file'), { target: { files: [new File(['x'], 'fw.bin')] } });
  fireEvent.change(screen.getByLabelText('Version'), { target: { value: '1.2.0' } });
  fireEvent.click(screen.getByRole('button', { name: /^upload$/i }));
  expect(await screen.findByText(/already exists for gateway/i)).not.toBeNull();
});
