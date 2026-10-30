import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import OpsSettings from '../OpsSettings';

jest.mock('../../../../services/api', () => ({ apiService: {
  getDevice: jest.fn(), setDeviceTelemetryDebug: jest.fn(), clearDeviceTelemetryDebug: jest.fn(), setDeviceAutoReboot: jest.fn(), toggleDeviceLogs: jest.fn(), updateDevice: jest.fn(), setDeviceApn: jest.fn(), calibrateMeter: jest.fn(),
} }));
let mockCan = true;
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: () => mockCan }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
const { apiService: api } = jest.requireMock('../../../../services/api');
const gw = { device_id: 47, device_type: 'gateway', serial: 'A1', is_online: true, last_heartbeat: null };
const em = { ...gw, device_type: 'energy_meter' };
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const op = (o: string, state: string, extra: object = {}) => ({ op: o, state, confirmed_at: null, last: { at: ago(5), actor: { id: 7, name: 'T' }, values: {}, ...extra } });
const ops = (list: unknown[] = [], recent: unknown[] = []) => ({ ops: list, recent }) as any;
const done = jest.fn();
const view = (d = gw, data: any = ops()) => render(<OpsSettings dev={d} isDark={false} onDone={done} data={data} />);
const sw = (n: string) => screen.findByRole('switch', { name: n });
const RESTART = 'Restart if the inverter stops answering';

beforeEach(() => {
  mockCan = true; jest.clearAllMocks();
  api.getDevice.mockResolvedValue({ auto_reboot_enabled: false, logs_enabled: false, meter_publish_interval_ms: null });
  ['setDeviceAutoReboot', 'toggleDeviceLogs', 'updateDevice', 'setDeviceApn', 'calibrateMeter', 'setDeviceTelemetryDebug', 'clearDeviceTelemetryDebug'].forEach(f => api[f].mockResolvedValue({}));
});

it('R1 without device control shows only a note', () => {
  mockCan = false; view();
  expect(screen.getByText(/device control/)).toBeInTheDocument();
  expect(screen.queryByRole('tablist')).toBeNull(); expect(api.getDevice).not.toHaveBeenCalled();
});
it('L1 skeleton while loading, L2 error', async () => {
  api.getDevice.mockReturnValue(new Promise(() => {}));
  const { unmount } = view(); expect(screen.getByText('Loading…')).toBeInTheDocument(); unmount();
  api.getDevice.mockRejectedValue(new Error('x')); view();
  expect(await screen.findByText(/Couldn't load/)).toBeInTheDocument();
});
it('G1/G2 gateway groups, APN, no Wi-Fi fields', async () => {
  view();
  const tabs = await screen.findAllByRole('tab');
  expect(tabs.map(t => t.textContent)).toEqual(['Device behaviour 3', 'Connection 3']);
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(tabs[1]);
  expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('APN')).toBeInTheDocument();
  expect(screen.queryByText(/set by an admin/)).toBeNull();
  expect(screen.getByLabelText('Wi-Fi name')).toHaveAttribute('placeholder', 'Leave empty to keep the current one');
  expect(screen.getByRole('button', { name: 'Send Wi-Fi settings' })).toBeDisabled();
});
it('G3 meter has only the Meter tab', async () => {
  view(em);
  expect((await screen.findAllByRole('tab')).map(t => t.textContent)).toEqual(['Meter 2', 'Connection 1']);
  expect(screen.getByLabelText('Publish interval (seconds)')).toBeInTheDocument();
  expect(screen.queryByRole('switch')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: /Connection/ }));
  expect(screen.getByLabelText('Wi-Fi name')).toBeInTheDocument(); expect(screen.queryByLabelText('APN')).toBeNull();
});
it('S1/S2/S3 stage, discard, revert', async () => {
  view();
  fireEvent.click(await sw('Send logs'));
  expect(screen.getByText('Changed, not applied')).toBeInTheDocument();
  expect(screen.getByText('1 change not applied')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect(screen.queryByText('1 change not applied')).toBeNull();
  fireEvent.click(await sw('Send logs')); fireEvent.click(await sw('Send logs'));
  expect(screen.queryByText(/not applied/)).toBeNull();
});
it('A1 review lists old to new, applies, reloads', async () => {
  view();
  fireEvent.click(await sw(RESTART));
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply' }));
  const dlg = await screen.findByRole('alertdialog');
  expect(within(dlg).getByText(/off to on/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(done).toHaveBeenCalled());
  expect(api.setDeviceAutoReboot).toHaveBeenCalledWith(47, true);
  expect(api.getDevice).toHaveBeenCalledTimes(2);
});
it('A2/A3 two changes, one fails: result lines, failed stays staged', async () => {
  api.toggleDeviceLogs.mockRejectedValue(new Error('x'));
  view();
  fireEvent.click(await sw(RESTART)); fireEvent.click(await sw('Send logs'));
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Apply' }));
  expect(await screen.findByText(/Send logs: couldn't send/)).toBeInTheDocument();
  expect(screen.getByText(`${RESTART}: sent.`)).toBeInTheDocument();
  expect(api.toggleDeviceLogs).toHaveBeenCalledWith(47, true);
  expect(screen.getByText('1 change not applied')).toBeInTheDocument();
});
it('A4 offline shows the notice and sends nothing', async () => {
  view({ ...gw, is_online: false });
  fireEvent.click(await sw(RESTART));
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply' }));
  expect(screen.getByText(/device is offline/)).toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).toBeNull(); expect(api.toggleDeviceLogs).not.toHaveBeenCalled();
  expect(screen.getByText('1 change not applied')).toBeInTheDocument();
});
it('SL1-SL5 Send logs wording and chip', async () => {
  const { unmount } = view(gw, ops([op('fetch_logs', 'confirmed', { values: { enabled: true } })]));
  expect(await screen.findByText('The gateway uploads its log files after each restart.')).toBeInTheDocument();
  expect(screen.queryByText(/Upload logs/)).toBeNull();
  expect(screen.queryByText(/Last log file received/)).toBeNull();   // device says off and no confirmation time
  unmount();
  api.getDevice.mockResolvedValue({ logs_enabled: true });
  const a = view(gw, ops([{ ...op('fetch_logs', 'confirmed', { values: { enabled: true } }), confirmed_at: ago(1) }]));
  expect(await screen.findByText(/^On, changed /)).toBeInTheDocument();
  expect(screen.getByText(/^Last log file received /)).toBeInTheDocument();
  a.unmount();
  view(gw, ops([{ ...op('fetch_logs', 'confirmed', { values: { enabled: false } }), confirmed_at: ago(1) }]));
  expect(await screen.findByText(/^On, changed /)).toBeInTheDocument();
  expect(screen.queryByText(/Last log file received/)).toBeNull();
});
it('SL3 Send logs off with no record shows Off and no time', async () => {
  view();
  expect(await screen.findByText('Off', { selector: '.ops-st' })).toBeInTheDocument();
});
it('SL6/SL7 offline: Send logs is queued, other settings still blocked', async () => {
  const off = { ...gw, is_online: false };
  const { unmount } = view(off);
  fireEvent.click(await sw('Send logs'));
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply' }));
  const dlg = await screen.findByRole('alertdialog');
  expect(within(dlg).getByText(/delivered when it reconnects/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(api.toggleDeviceLogs).toHaveBeenCalledWith(47, true));
  unmount();
  view(off);
  fireEvent.click(await sw('Send logs')); fireEvent.click(await sw(RESTART));
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply' }));
  expect(screen.getByText(/device is offline/)).toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('A5 cancel sends nothing', async () => {
  view(); fireEvent.click(await sw('Send logs'));
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Not yet' }));
  expect(api.toggleDeviceLogs).not.toHaveBeenCalled();
});
it('C1/C2/C3 chips come from the operations data', async () => {
  const { unmount } = view(gw, ops([op('auto_reboot', 'sent')]));
  expect(await screen.findByText(/^Applied /)).toBeInTheDocument();
  unmount();
  const r = view(gw, ops([op('auto_reboot', 'failed', { values: { reason: 'bad value' } })]));
  expect(await screen.findByText('Device rejected: bad value')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Connection/ }));
  expect(screen.queryByText(/Applied|Waiting|Not confirmed/)).toBeNull();   // APN never recorded: no chip
  r.unmount();
  view(gw, ops([op('apn', 'waiting')]));
  fireEvent.click(await screen.findByRole('tab', { name: /Connection/ }));
  expect(screen.getByText('Waiting')).toBeInTheDocument();
});
it('M1/M2 interval validation and apply', async () => {
  view(em);
  const iv = await screen.findByLabelText('Publish interval (seconds)');
  fireEvent.change(iv, { target: { value: '4000' } });
  expect(screen.getByText('Enter 1 to 3600 seconds')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review and apply' })).toBeDisabled();
  fireEvent.change(iv, { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review and apply' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(api.updateDevice).toHaveBeenCalledWith(47, { meter_publish_interval_ms: 10000 }));
});
it('M3/M4 calibration confirm and range check', async () => {
  view(em);
  fireEvent.click(await screen.findByRole('button', { name: 'Calibrate meter' }));
  expect(api.calibrateMeter).not.toHaveBeenCalled();
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Calibrate' }));
  await waitFor(() => expect(api.calibrateMeter).toHaveBeenCalledWith(47, { mode: 'single', v: [230], i: [5] }));
  fireEvent.change(screen.getByLabelText('Voltage (V)'), { target: { value: '50' } });
  expect(screen.getByText(/Voltage must be/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Calibrate meter' })).toBeDisabled();
});
it('M5 offline meter cannot calibrate', async () => {
  view({ ...em, is_online: false });
  expect(await screen.findByText(/Calibration needs it online/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Calibrate meter' })).toBeNull();
});
it('P1/P2 APN has its own confirm; ^ blocked', async () => {
  view();
  fireEvent.click(await screen.findByRole('tab', { name: /Connection/ }));
  const send = screen.getByRole('button', { name: 'Send mobile data settings' });
  expect(send).toBeDisabled();
  fireEvent.change(screen.getByLabelText('APN'), { target: { value: 'a^b' } });
  expect(screen.getByRole('alert')).toBeInTheDocument(); expect(send).toBeDisabled();
  fireEvent.change(screen.getByLabelText('APN'), { target: { value: 'internet' } });
  fireEvent.click(send);
  expect(api.setDeviceApn).not.toHaveBeenCalled();
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(api.setDeviceApn).toHaveBeenCalledWith(47, { apn: 'internet' }));
});
it('H1 history lists only applied setting ops; staged ones show once, in the change bar', async () => {
  view(gw, ops([], [{ at: ago(33), op: 'apn', actor: { id: 9, name: 'Dev K.' } }, { at: ago(3), op: 'reboot', actor: null }, { at: ago(2), op: 'auto_reboot', actor: { id: 7, name: 'T' } }]));
  fireEvent.click(await sw('Send logs'));
  const aside = screen.getByRole('complementary');
  expect(within(aside).getByText('Mobile data name')).toBeInTheDocument();
  expect(within(aside).getByText('Restart if stalled')).toBeInTheDocument();
  expect(within(aside).getAllByRole('listitem')).toHaveLength(2);
  expect(within(aside).queryByText(/not applied/)).toBeNull();
  expect(screen.getByText(/change.? not applied/)).toBeInTheDocument();
  expect(within(aside).getByText(/Dev K\./)).toBeInTheDocument();
});

it('D1 detailed readings: confirm with duration before turning on', async () => {
  view();
  fireEvent.click(await sw('Detailed readings'));
  expect(api.setDeviceTelemetryDebug).not.toHaveBeenCalled();
  const dlg = await screen.findByRole('alertdialog');
  fireEvent.change(within(dlg).getByRole('combobox'), { target: { value: '6' } });
  fireEvent.click(within(dlg).getByRole('button', { name: 'Turn on' }));
  await waitFor(() => expect(api.setDeviceTelemetryDebug).toHaveBeenCalledWith(47, { hours: 6 }));
  await waitFor(() => expect(done).toHaveBeenCalled());
});
it('D2 detailed readings: cancel sends nothing; honest help text', async () => {
  view();
  expect(await screen.findByText(/Pauses this page's data/)).toBeInTheDocument();
  fireEvent.click(await sw('Detailed readings'));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Not now' }));
  expect(api.setDeviceTelemetryDebug).not.toHaveBeenCalled();
});
it('D3 detailed readings on: shows end time, turning off needs no confirm', async () => {
  api.getDevice.mockResolvedValue({ telemetry_debug_until: new Date(Date.now() + 3_600_000).toISOString() });
  view();
  expect(await sw('Detailed readings')).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByText(/^On until /)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: 'Detailed readings' }));
  await waitFor(() => expect(api.clearDeviceTelemetryDebug).toHaveBeenCalledWith(47));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('D4 detailed readings until turned off (year 9999)', async () => {
  api.getDevice.mockResolvedValue({ telemetry_debug_until: '9999-12-31T23:59:59Z' });
  view();
  expect(await screen.findByText('On until turned off')).toBeInTheDocument();
});

const wifiTab = async (d = gw, data: any = ops()) => { view(d, data); fireEvent.click(await screen.findByRole('tab', { name: /Connection/ })); };
it('W1/W2/W4 Wi-Fi: confirm first, only typed fields, inputs cleared, show/hide', async () => {
  await wifiTab();
  fireEvent.change(screen.getByLabelText('Wi-Fi name'), { target: { value: 'Home' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Wi-Fi settings' }));
  expect(api.updateDevice).not.toHaveBeenCalled();
  const dlg = await screen.findByRole('alertdialog');
  expect(within(dlg).getByText(/may go offline for about a minute/)).toBeInTheDocument();
  fireEvent.click(within(dlg).getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(api.updateDevice).toHaveBeenCalledWith(47, { wifi_ssid: 'Home' }));
  await waitFor(() => expect(screen.getByLabelText('Wi-Fi name')).toHaveValue(''));
  expect(await screen.findByText(/^Wi-Fi: sent/)).toBeInTheDocument(); expect(done).toHaveBeenCalled();
  const pw = screen.getByLabelText('Wi-Fi password');
  expect(pw).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(pw).toHaveAttribute('type', 'text');
  fireEvent.change(pw, { target: { value: 'secret12' } }); fireEvent.change(screen.getByLabelText('Wi-Fi name'), { target: { value: 'Home2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Wi-Fi settings' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(api.updateDevice).toHaveBeenLastCalledWith(47, { wifi_ssid: 'Home2', wifi_password: 'secret12' }));
});
it('W3 Wi-Fi failure shows a plain error and keeps the input', async () => {
  api.updateDevice.mockRejectedValue(new Error('x'));
  await wifiTab(em);
  fireEvent.change(screen.getByLabelText('Wi-Fi password'), { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Wi-Fi settings' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Send' }));
  expect(await screen.findByText("Wi-Fi: couldn't send.")).toBeInTheDocument();
  expect(screen.getByLabelText('Wi-Fi password')).toHaveValue('abc');
});
it('W5 Wi-Fi chip follows the operations state', async () => {
  await wifiTab(gw, ops([op('wifi', 'waiting')]));
  expect(screen.getByText('Waiting')).toBeInTheDocument();
});
it('W6 Wi-Fi is not part of the staged batch', async () => {
  await wifiTab();
  fireEvent.change(screen.getByLabelText('Wi-Fi name'), { target: { value: 'Home' } });
  expect(screen.queryByText(/not applied/)).toBeNull();
});
