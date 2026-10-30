import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import OpsFirmware from '../OpsFirmware';

jest.mock('../../../../services/api', () => ({ apiService: {
  getFirmwareVersions: jest.fn(), updateFirmwareVersion: jest.fn(), uploadFirmwareVersion: jest.fn(), deleteFirmwareVersion: jest.fn(),
} }));
let mockCtl = true;
let mockAdmin = false;
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: (f: string) => f === 'device_control' && mockCtl }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: mockAdmin }) }));
const { apiService } = jest.requireMock('../../../../services/api');

const BUILDS = [
  { id: 1, version: '2.2.3-3P', device_type: 'gateway', is_active: true, created_at: '2026-10-28T00:00:00Z', size: 1677721, release_notes: 'Three-phase bench build' },
  { id: 2, version: '2.2.4-rc1', device_type: 'gateway', is_active: false, created_at: '2026-10-27T00:00:00Z', size: 1677721, release_notes: '' },
  { id: 3, version: '2.2.5', device_type: 'energymeter', is_active: true, created_at: '2026-10-29T00:00:00Z', size: 1468006, release_notes: 'Meter fix' },
];
const gw = { device_id: 1, device_type: 'gateway', serial: 'S1' } as any;
const em = { device_id: 2, device_type: 'energy_meter', serial: 'S2' } as any;
const view = (dev = gw) => render(<OpsFirmware dev={dev} isDark={false} />);
const file = (name = 'fw.bin', size = 10) => { const f = new File(['x'], name); Object.defineProperty(f, 'size', { value: size }); return f; };
const fill = (f = file(), v = '2.2.6') => {
  fireEvent.click(screen.getByRole('tab', { name: /upload a build/i }));
  fireEvent.change(screen.getByLabelText('Firmware file'), { target: { files: [f] } });
  fireEvent.change(screen.getByLabelText('Build number'), { target: { value: v } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Upload build' }));

beforeEach(() => {
  mockCtl = true; mockAdmin = false; jest.clearAllMocks();
  apiService.getFirmwareVersions.mockResolvedValue(BUILDS);
  apiService.updateFirmwareVersion.mockResolvedValue({}); apiService.uploadFirmwareVersion.mockResolvedValue({}); apiService.deleteFirmwareVersion.mockResolvedValue({});
});

describe('OpsFirmware', () => {
  it('B1 lists this device type, newest first, with notes and status', async () => {
    view();
    expect(await screen.findByText('2.2.3-3P')).toBeInTheDocument();
    expect(screen.getByText('Three-phase bench build')).toBeInTheDocument();
    expect(screen.queryByText('2.2.5')).toBeNull();
    expect(screen.getAllByRole('row').slice(1).map(r => r.textContent)[0]).toMatch(/2\.2\.3-3P/);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(apiService.getFirmwareVersions).toHaveBeenCalledWith(false);
  });

  it('B2/B3 a meter sees meter builds; show-all adds the rest', async () => {
    view(em);
    expect(await screen.findByText('2.2.5')).toBeInTheDocument();
    expect(screen.queryByText('2.2.3-3P')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /show all builds/i }));
    expect(screen.getByText('2.2.3-3P')).toBeInTheDocument();
  });

  it('B4 shows a skeleton while loading', () => {
    apiService.getFirmwareVersions.mockReturnValue(new Promise(() => {}));
    view();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('B5 empty state offers upload', async () => {
    apiService.getFirmwareVersions.mockResolvedValue([]);
    view();
    expect(await screen.findByText('No builds yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upload a build' }));
    expect(screen.getByRole('tab', { name: /upload a build/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('B6 a failed list says so and retries', async () => {
    apiService.getFirmwareVersions.mockRejectedValueOnce(new Error('x'));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2.2.3-3P')).toBeInTheDocument();
  });

  it('B7 tabs switch views', async () => {
    view();
    await screen.findByText('2.2.3-3P');
    expect(screen.getByRole('tab', { name: /^builds/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /upload a build/i }));
    expect(screen.getByRole('tab', { name: /upload a build/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('T1 activate asks, then sends and reloads', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Activate 2.2.4-rc1' }));
    expect(apiService.updateFirmwareVersion).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(apiService.updateFirmwareVersion).toHaveBeenCalledWith(2, { is_active: true }));
    await waitFor(() => expect(apiService.getFirmwareVersions).toHaveBeenCalledTimes(2));
  });

  it('T2 deactivate asks first', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate 2.2.3-3P' }));
    expect(apiService.updateFirmwareVersion).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(apiService.updateFirmwareVersion).toHaveBeenCalledWith(1, { is_active: false }));
  });

  it('T3 a refused change shows a plain error', async () => {
    apiService.updateFirmwareVersion.mockRejectedValue(new Error('403'));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Activate 2.2.4-rc1' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Activate' }));
    expect(await screen.findByText(/couldn't change that build/i)).toBeInTheDocument();
  });

  it('D1 admin deletes after confirming; D2 others never see Delete', async () => {
    mockAdmin = true;
    const { unmount } = view();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete 2.2.4-rc1' }));
    expect(within(screen.getByRole('alertdialog')).getByText(/2\.2\.4-rc1/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(apiService.deleteFirmwareVersion).toHaveBeenCalledWith(2));
    unmount();
    mockAdmin = false;
    view();
    await screen.findByText('2.2.3-3P');
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('D3 a refused delete is explained', async () => {
    mockAdmin = true;
    apiService.deleteFirmwareVersion.mockRejectedValue(new Error('409'));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete 2.2.4-rc1' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/can't be deleted/i)).toBeInTheDocument();
  });

  it('P1 without device control the list is read-only', async () => {
    mockCtl = false;
    view();
    await screen.findByText('2.2.3-3P');
    expect(screen.queryByRole('button', { name: /activate|delete/i })).toBeNull();
    expect(screen.queryByRole('tab', { name: /upload a build/i })).toBeNull();
  });

  it('U1/U3 uploads with the right fields, shows success and refreshes', async () => {
    view();
    await screen.findByText('2.2.3-3P');
    fill();
    fireEvent.change(screen.getByLabelText('What changed'), { target: { value: 'Fix' } });
    fireEvent.click(screen.getByRole('switch', { name: /available right away/i }));
    submit();
    await waitFor(() => expect(apiService.uploadFirmwareVersion).toHaveBeenCalled());
    const fd = apiService.uploadFirmwareVersion.mock.calls[0][0] as FormData;
    expect(fd.get('version')).toBe('2.2.6');
    expect(fd.get('device_type')).toBe('gateway');
    expect(fd.get('release_notes')).toBe('Fix');
    expect(fd.get('is_active')).toBe('true');
    expect(fd.get('file')).toBeTruthy();
    expect(await screen.findByText(/2\.2\.6 uploaded/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^builds/i })).toHaveAttribute('aria-selected', 'true');
    expect(apiService.getFirmwareVersions).toHaveBeenCalledTimes(2);
  });

  it('U2 a meter uploads as energymeter, inactive by default', async () => {
    view(em);
    await screen.findByText('2.2.5');
    fill();
    submit();
    await waitFor(() => expect(apiService.uploadFirmwareVersion).toHaveBeenCalled());
    const fd = apiService.uploadFirmwareVersion.mock.calls[0][0] as FormData;
    expect(fd.get('device_type')).toBe('energymeter');
    expect(fd.get('is_active')).toBe('false');
  });

  it('U4 rejects a too-big or non-bin file without a request', async () => {
    view();
    await screen.findByText('2.2.3-3P');
    fill(file('fw.bin', 9 * 1048576));
    expect(screen.getByRole('alert')).toHaveTextContent(/8 MB/i);
    submit();
    fill(file('fw.zip'));
    expect(screen.getByRole('alert')).toHaveTextContent(/\.bin file/i);
    expect(apiService.uploadFirmwareVersion).not.toHaveBeenCalled();
  });

  it('U5 needs a file and a build number', async () => {
    view();
    await screen.findByText('2.2.3-3P');
    fireEvent.click(screen.getByRole('tab', { name: /upload a build/i }));
    submit();
    expect(screen.getByText(/choose a file and enter a build number/i)).toBeInTheDocument();
    expect(apiService.uploadFirmwareVersion).not.toHaveBeenCalled();
  });

  it('U6 shows the backend sentence for 400 and a plain one for 403', async () => {
    apiService.uploadFirmwareVersion.mockRejectedValueOnce(new Error('Upload failed: 400 - {"error":"Firmware version 2.2.6 already exists"}'));
    view();
    await screen.findByText('2.2.3-3P');
    fill(); submit();
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    apiService.uploadFirmwareVersion.mockRejectedValueOnce(new Error('Upload failed: 403 - {}'));
    submit();
    expect(await screen.findByText(/not allowed to upload/i)).toBeInTheDocument();
  });

  it('U7 cancel clears the form and returns to Builds', async () => {
    view();
    await screen.findByText('2.2.3-3P');
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('tab', { name: /^builds/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /upload a build/i }));
    expect(screen.getByLabelText('Build number')).toHaveValue('');
  });

  it('U8 a dropped file is taken', async () => {
    view();
    await screen.findByText('2.2.3-3P');
    fireEvent.click(screen.getByRole('tab', { name: /upload a build/i }));
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [file('drop.bin')] } });
    expect(screen.getByText('drop.bin')).toBeInTheDocument();
  });
});
