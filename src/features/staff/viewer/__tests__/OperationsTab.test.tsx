import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OperationsTab from '../OperationsTab';

jest.mock('../../../../services/api', () => ({ apiService: { getDeviceOperations: jest.fn() } }));
let mockCanControl = true;
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: (f: string) => f === 'device_control' && mockCanControl }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
jest.mock('../DevicePage', () => ({ __esModule: true, default: ({ onDone }: { onDone?: () => void }) => <button data-testid="controls" onClick={onDone} />, at: (s: string) => s }));
const { apiService } = jest.requireMock('../../../../services/api');
const dev = { device_id: 47, device_type: 'gateway', serial: '00A1', is_online: true, last_heartbeat: null };
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe('OperationsTab', () => {
  beforeEach(() => { mockCanControl = true; });

  it('O1/O2/O3 shows each state in plain words', async () => {
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent: [], ops: [
      { op: 'reboot', state: 'confirmed', confirmed_at: ago(1), last: { at: ago(2), action: 'reboot', actor: { id: 7, name: 'T' }, values: {} } },
      { op: 'diagnostics', state: 'not_confirmed', confirmed_at: null, last: { at: ago(9), action: 'diagnostics', actor: { id: 8, name: 'Asha' }, values: {} } },
      { op: 'mute', state: 'no_record', confirmed_at: null, last: null },
    ] });
    render(<OperationsTab dev={dev} firmware={null} isDark={false} />);
    expect(await screen.findByText(/Confirmed .* by you/)).toBeInTheDocument();
    expect(screen.getByText(/Not confirmed after 5 min/)).toBeInTheDocument();
    expect(screen.getByText('No record yet')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  it('shows Confirmed without a time when none is known', async () => {
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent: [], ops: [
      { op: 'reboot', state: 'confirmed', confirmed_at: null, last: { at: ago(2), action: 'reboot', actor: null, values: {} } },
    ] });
    render(<OperationsTab dev={dev} firmware={null} isDark={false} />);
    expect(await screen.findByText(/^Confirmed, sent/)).toBeInTheDocument();
  });

  it('O7 offline notice shows only for an offline device; the admin note always', async () => {
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent: [], ops: [] });
    const { unmount } = render(<OperationsTab dev={{ ...dev, is_online: false }} firmware={null} isDark={false} />);
    expect(await screen.findByText(/This device is offline/)).toBeInTheDocument();
    expect(screen.getByText('Updating many devices at once stays with admins.')).toBeInTheDocument();
    unmount();
    render(<OperationsTab dev={dev} firmware={null} isDark={false} />);
    await screen.findByText('Operations');
    expect(screen.queryByText(/This device is offline/)).toBeNull();
  });

  it('refreshes the statuses when the controls report done', async () => {
    apiService.getDeviceOperations.mockClear();
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent: [], ops: [] });
    render(<OperationsTab dev={dev} firmware={null} isDark={false} />);
    fireEvent.click(await screen.findByTestId('controls'));
    await waitFor(() => expect(apiService.getDeviceOperations).toHaveBeenCalledTimes(2));
  });

  it('O4 hides the controls without device control', async () => {
    mockCanControl = false;
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent: [], ops: [] });
    render(<OperationsTab dev={dev} firmware={null} isDark={false} />);
    await screen.findByText('Operations');
    expect(screen.queryByTestId('controls')).toBeNull();
  });
});
