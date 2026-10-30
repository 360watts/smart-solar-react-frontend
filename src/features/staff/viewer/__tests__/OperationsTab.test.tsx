import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OperationsTab from '../OperationsTab';

jest.mock('../../../../services/api', () => ({ apiService: {
  getDeviceOperations: jest.fn(), rebootDevice: jest.fn(), hardResetDevice: jest.fn(), toggleDeviceLogs: jest.fn(), runDeviceDiagnostics: jest.fn(),
  muteDeviceAlerts: jest.fn(), unmuteDeviceAlerts: jest.fn(), triggerSingleUpdate: jest.fn(), triggerRollback: jest.fn(),
  getFirmwareVersions: jest.fn().mockResolvedValue([]), getDevice: jest.fn(),
} }));
let mockCanControl = true;
let mockUpdate: unknown = null;
let mockBuilds: any[] = [];
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: (f: string) => f === 'device_control' && mockCanControl }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
const mockActivity = jest.fn((_: any) => <div data-testid="activity" />);
jest.mock('../OpsHealth', () => ({ __esModule: true, default: (p: any) => mockActivity(p) }));
jest.mock('../OpsLogFiles', () => ({ __esModule: true, default: () => <div data-testid="logscard" /> }));
jest.mock('../OpsSettings', () => ({ __esModule: true, default: () => <div data-testid="controls" /> }));
jest.mock('../DevicePage', () => ({ __esModule: true, default: () => <div data-testid="controls" />, at: (s: string) => s, updateFor: () => mockUpdate, buildsFor: () => mockBuilds, normVersion: (v?: string) => (v ?? '').replace(/^v/i, ''), isNewer: (a: string, b?: string) => a > (b ?? '') }));
const { apiService } = jest.requireMock('../../../../services/api');
const dev = { device_id: 47, device_type: 'gateway', serial: '00A1B2', is_online: true, last_heartbeat: null };
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const op = (o: string, state: string, last: object | null = null, confirmed_at: string | null = null) =>
  ({ op: o, state, confirmed_at, last: last && { at: ago(2), action: o, actor: { id: 7, name: 'T' }, values: {}, ...last } });
const GW = ['reboot', 'fetch_logs', 'diagnostics', 'mute', 'ota_update', 'rollback', 'hard_reset', 'auto_reboot', 'apn'];
const all = (over: Record<string, any> = {}) => GW.map(o => over[o] ?? op(o, 'no_record'));
const mockOps = (ops: unknown[], recent: unknown[] = []) => apiService.getDeviceOperations.mockResolvedValue({ device_type: 'gateway', recent, ops });
const view = (d = dev, url = '/x') => render(<MemoryRouter initialEntries={[url]}><OperationsTab dev={d} firmware={[]} isDark={false} /></MemoryRouter>);
const titles = () => screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent).filter(t => t !== 'Recent runs');
const lastBtn = (n: string) => screen.getAllByRole('button', { name: n }).pop()!;

describe('OperationsTab', () => {
  beforeEach(() => { mockCanControl = true; mockUpdate = null; mockBuilds = []; localStorage.clear(); jest.clearAllMocks(); mockActivity.mockClear(); Object.values(apiService).forEach((f: any) => f.mockResolvedValue({})); mockOps(all()); });

  it('S1/S2/S3 sub-tabs follow ?ops=', async () => {
    const { unmount } = view();
    expect(await screen.findByRole('link', { name: 'Actions' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/x?ops=settings');
    unmount();
    view(dev, '/x?tab=ops&ops=settings');
    expect(await screen.findByTestId('controls')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Restart')).toBeNull();
    expect(screen.getByRole('link', { name: 'Actions' })).toHaveAttribute('href', '/x?tab=ops');
    fireEvent.click(screen.getByRole('link', { name: 'Firmware library' }));
    expect(screen.getByRole('link', { name: 'Firmware library' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('tab', { name: /upload a build/i })).toBeInTheDocument();
  });

  it('A1 gateway shows seven action cards, Send logs next to Update firmware', async () => {
    view();
    await screen.findByText('Restart', { selector: 'h3' });
    expect(titles()).toEqual(['Restart', 'Run diagnostics', 'Mute alerts', 'Update firmware', 'Send logs', 'Roll back firmware', 'Hard reset']);
    expect(screen.queryByRole('button', { name: /^(Pin|Move|Reset layout|Compact|List)/ })).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('S4 four sub-tabs, Logs last', async () => {
    view();
    await screen.findByText('Restart', { selector: 'h3' });
    expect(screen.getAllByRole('link').map(l => l.textContent)).toEqual(['Actions', 'Settings', 'Firmware library', 'Logs']);
    expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute('href', '/x?ops=logs');
  });

  it('S5/S6 gateway Logs: log files and health with the loaded device', async () => {
    apiService.getDevice.mockResolvedValue({ id: 47, logs_enabled: true });
    view(dev, '/x?ops=logs');
    expect(await screen.findByTestId('logscard')).toBeInTheDocument();
    await waitFor(() => expect(mockActivity).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 47, device: { id: 47, logs_enabled: true } })));
  });

  it('S7 meter Logs: one-line note only', async () => {
    view({ ...dev, device_type: 'energy_meter' }, '/x?ops=logs');
    expect(await screen.findByText('Energy meters have no remote logs')).toBeInTheDocument();
    expect(screen.queryByTestId('logscard')).toBeNull();
    expect(apiService.getDevice).not.toHaveBeenCalled();
  });

  it('A2 meter shows restart, update and hard reset', async () => {
    apiService.getDeviceOperations.mockResolvedValue({ device_type: 'energy_meter', recent: [], ops: ['reboot', 'meter_interval', 'meter_calibrate', 'ota_update', 'hard_reset'].map(o => op(o, 'no_record')) });
    view({ ...dev, device_type: 'energy_meter' });
    await screen.findByText('Restart', { selector: 'h3' });
    expect(titles()).toEqual(['Restart', 'Update firmware', 'Hard reset']);
  });

  it('A3/A4 state chips, timeline and who ran it', async () => {
    mockOps(all({
      reboot: op('reboot', 'confirmed', {}, ago(1)),
      mute: op('mute', 'waiting', { actor: { id: 8, name: 'Asha' } }),
      diagnostics: op('diagnostics', 'not_confirmed', {}),
      rollback: op('rollback', 'failed', {}),
    }));
    view();
    await screen.findByText('Confirmed', { selector: '.ops-st' });
    for (const t of ['Waiting', 'Not confirmed', 'Failed', 'Never run']) expect(screen.getAllByText(t, { selector: '.ops-st' }).length).toBeGreaterThan(0);
    expect(within(screen.getByRole('region', { name: 'Restart' })).getByText(/^Confirmed .* by you$/)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Mute alerts' })).getByText('Waiting by Asha')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Hard reset' })).getByText('Never run', { selector: '.ops-st' })).toBeInTheDocument();
    expect(document.querySelector('.ops-tl')).toBeNull();
  });

  it('A5 restart asks first, then calls the API and reloads', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Restart' }));
    expect(apiService.rebootDevice).not.toHaveBeenCalled();
    fireEvent.click(lastBtn('Restart'));
    await waitFor(() => expect(apiService.rebootDevice).toHaveBeenCalledWith(47));
    expect(await screen.findByText(/Restart sent to/)).toBeInTheDocument();
    expect(apiService.getDeviceOperations).toHaveBeenCalledTimes(2);
  });

  it('A6/A7 diagnostics, mute and unmute run at once', async () => {
    view();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run diagnostics' })).toBeEnabled());
    expect(screen.queryByRole('button', { name: 'Fetch logs' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Run diagnostics' }));
    await waitFor(() => expect(apiService.runDeviceDiagnostics).toHaveBeenCalledWith(47));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mute' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    await waitFor(() => expect(apiService.muteDeviceAlerts).toHaveBeenCalledWith(47, 4));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unmute' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));
    await waitFor(() => expect(apiService.unmuteDeviceAlerts).toHaveBeenCalledWith(47));
  });

  it('A8/A9 update (only when newer exists) and roll back confirm first', async () => {
    const { unmount } = view();
    await screen.findByText('Roll back firmware', { selector: 'h3' });
    expect(screen.queryByRole('button', { name: /Update to/ })).toBeNull();
    unmount();
    mockUpdate = { id: 9, version: '2.2.5' };
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Update to 2.2.5' }));
    fireEvent.click(lastBtn('Update'));
    await waitFor(() => expect(apiService.triggerSingleUpdate).toHaveBeenCalledWith('00A1B2', 9));
    await waitFor(() => expect(screen.queryByText(/Keep it/)).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Roll back' }));
    fireEvent.click(lastBtn('Roll back'));
    await waitFor(() => expect(apiService.triggerRollback).toHaveBeenCalledWith('00A1B2'));
  });

  it('A8b any build can be picked: an older one reads Install and warns', async () => {
    mockBuilds = [{ id: 9, version: '2.9.0' }, { id: 5, version: '1.0.0' }];
    mockUpdate = mockBuilds[0];
    view({ ...dev, firmware_version: '2.0.0' } as any);
    expect(await screen.findByRole('button', { name: 'Update to 2.9.0' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Firmware build'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Install 1.0.0' }));
    expect(screen.getByText(/older than what the device runs/)).toBeInTheDocument();
    fireEvent.click(lastBtn('Install'));
    await waitFor(() => expect(apiService.triggerSingleUpdate).toHaveBeenCalledWith('00A1B2', 5));
  });

  it('A12 Send logs card toggles logs_enabled and shows On/Off', async () => {
    apiService.getDevice.mockResolvedValue({ id: 47, logs_enabled: false });
    view();
    const card = await screen.findByRole('region', { name: 'Send logs' });
    expect(await within(card).findByText('Off')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(apiService.toggleDeviceLogs).toHaveBeenCalledWith(47, true));
    expect(await within(card).findByText('On')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Turn off' })).toBeEnabled();
  });

  it('A10 a waiting card cannot be run again', async () => {
    mockOps(all({ diagnostics: op('diagnostics', 'waiting', {}) }));
    view();
    expect(await screen.findByRole('button', { name: 'Run diagnostics' })).toBeDisabled();
  });

  it('A11 a failed call shows a note and does not crash', async () => {
    apiService.runDeviceDiagnostics.mockRejectedValue(new Error('x'));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Run diagnostics' }));
    expect(await screen.findByText(/Couldn't send that/)).toBeInTheDocument();
  });

  it('H1/H2 hard reset unlocks on the typed serial, then confirms', async () => {
    view();
    const go = await screen.findByRole('button', { name: 'Hard reset' });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type the serial/), { target: { value: '00a1b' } });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type the serial/), { target: { value: '00a1b2' } });
    expect(go).toBeEnabled();
    fireEvent.click(go);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset it' }));
    await waitFor(() => expect(apiService.hardResetDevice).toHaveBeenCalledWith(47));
  });

  it('C1/C2 recent runs are collapsed behind a button', async () => {
    mockOps(all(), [{ at: ago(3), op: 'reboot', action: 'reboot', actor: { id: 8, name: 'Asha' } }]);
    const { unmount } = view();
    const btn = await screen.findByRole('button', { name: 'Recent runs (1)' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Asha')).toBeNull();
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Asha')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('Asha')).toBeNull();
    unmount();
    mockOps(all());
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Recent runs (0)' }));
    expect(screen.getByText('No runs yet')).toBeInTheDocument();
  });

  it('C4 nothing is persisted to localStorage', async () => {
    const set = jest.spyOn(Storage.prototype, 'setItem');
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Run diagnostics' }));
    await waitFor(() => expect(apiService.runDeviceDiagnostics).toHaveBeenCalled());
    expect(set).not.toHaveBeenCalled();
    set.mockRestore();
  });

  it('O1 offline notice, disabled online-only buttons, admin note', async () => {
    view({ ...dev, is_online: false });
    await screen.findByText('Restart', { selector: 'h3' });
    expect(screen.getByText(/This device is offline/)).toBeInTheDocument();
    for (const n of ['Restart', 'Run diagnostics']) expect(screen.getByRole('button', { name: n })).toBeDisabled();
    expect(screen.getByText('Updating many devices at once is for admins.')).toBeInTheDocument();
  });

  it('O2 without device control: statuses show, no run controls', async () => {
    mockCanControl = false;
    mockOps(all({ reboot: op('reboot', 'confirmed', {}, ago(1)) }));
    view();
    await screen.findByText('Restart', { selector: 'h3' });
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
    expect(screen.queryByLabelText(/Type the serial/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull();
  });

  it('O3/O4 loading skeleton, then load error', async () => {
    apiService.getDeviceOperations.mockReturnValue(new Promise(() => {}));
    const { unmount } = view();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    unmount();
    apiService.getDeviceOperations.mockRejectedValue(new Error('x'));
    view();
    expect(await screen.findByText(/Couldn't load the operation history/)).toBeInTheDocument();
  });

  it('O5 a finished run reloads the statuses', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Run diagnostics' }));
    await waitFor(() => expect(apiService.getDeviceOperations).toHaveBeenCalledTimes(2));
  });
});
