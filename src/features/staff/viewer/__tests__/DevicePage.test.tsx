import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DevicePage, { at, type Dev, type Firmware } from '../DevicePage';

jest.mock('../../../../services/api', () => ({
  apiService: {
    rebootDevice: jest.fn().mockResolvedValue({}),
    hardResetDevice: jest.fn().mockResolvedValue({}),
    muteDeviceAlerts: jest.fn().mockResolvedValue({}),
    unmuteDeviceAlerts: jest.fn().mockResolvedValue({}),
    triggerSingleUpdate: jest.fn().mockResolvedValue({}),
    triggerRollback: jest.fn().mockResolvedValue({}),
    getDeviceUpdateLogs: jest.fn(),
    getDeviceLogFiles: jest.fn(),
    getDeviceEvents: jest.fn(() => Promise.resolve({ results: [] })),
    getDeviceLogFileContent: jest.fn().mockResolvedValue('line one'),
    getDeviceLogFileDownloadUrl: jest.fn().mockResolvedValue({ url: 'https://x/log', filename: 'a.log' }),
    downloadDeviceLogFile: jest.fn().mockResolvedValue(undefined),
    toggleDeviceLogs: jest.fn().mockResolvedValue({}),
    setDeviceAutoReboot: jest.fn(),
    getDevice: jest.fn(),
    getRegisterCoverage: jest.fn(),
    getFirmwareVersions: jest.fn().mockResolvedValue([]),
    updateFirmwareVersion: jest.fn().mockResolvedValue({}),
    uploadFirmwareVersion: jest.fn().mockResolvedValue({}),
    scanDeviceLogFiles: jest.fn(),
    bulkDownloadLogFiles: jest.fn(),
  },
}));
const mockCan = jest.fn();
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: mockCan }) }));

const { apiService } = jest.requireMock('../../../../services/api');
const recent = new Date(Date.now() - 4 * 60_000).toISOString();
const DEV: Dev = {
  device_id: 11, device_type: 'gateway', serial: 'GW-1', is_online: true, last_heartbeat: recent,
  firmware_version: '2.2.0', connectivity_type: 'wifi', signal_strength_dbm: -58,
};
const FIRMWARE: Firmware[] = [
  { id: 3, version: '2.1.0', device_type: 'gateway', is_active: true, created_at: '2026-07-01T00:00:00Z', size: 1572864, release_notes: 'Faster reconnects' },
  { id: 4, version: '2.2.0', device_type: 'gateway', is_active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 5, version: '2.3.0', device_type: 'gateway', is_active: true, created_at: '2026-09-01T00:00:00Z' },
  { id: 9, version: '1.1.0', device_type: 'energymeter', is_active: true, created_at: '2026-10-01T00:00:00Z' },
];

const open = (firmware: Firmware[] | null = FIRMWARE, dev: Dev = DEV) =>
  render(<DevicePage isDark={false} dev={dev} firmware={firmware} />);
const dialog = () => screen.getByRole('alertdialog');

beforeEach(() => {
  jest.clearAllMocks();
  apiService.getDeviceUpdateLogs.mockResolvedValue([]);
  apiService.getDeviceLogFiles.mockResolvedValue({ files: [{ id: 3, filename: 'boot.log', created_at: recent }], total: 1 });
  apiService.setDeviceAutoReboot.mockResolvedValue({ device_id: 11, device_serial: 'GW-1', auto_reboot_enabled: false });
  apiService.getDevice.mockResolvedValue({ id: 11, auto_reboot_enabled: true, logs_enabled: false });
  apiService.getRegisterCoverage.mockResolvedValue(COVERAGE);
  apiService.scanDeviceLogFiles.mockResolvedValue({ date: 'x', files_scanned: 2, total_errors: 1, total_warnings: 0, results: [] });
  apiService.bulkDownloadLogFiles.mockResolvedValue(undefined);
  mockCan.mockReturnValue(true);
});
const COVERAGE = {
  total_configured: 45, total_received: 42, last_telemetry_at: recent,
  slaves: [{ device_name: 'Inverter', registers: [
    { id: 1, label: 'PV1 Voltage', unit: 'V', received: false },
    { id: 2, label: 'Grid Frequency', unit: 'Hz', received: true },
  ] }],
};
const future = new Date(Date.now() + 2 * 3600_000).toISOString();
const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('DevicePage', () => {
  it('shows the five sections and the status in words (DR-1, DR-2)', async () => {
    open();
    for (const h of ['Status', 'Readings', 'Firmware updates', 'Update history', 'Logs', 'What you can do']) {
      expect(screen.getByRole('heading', { name: h })).not.toBeNull();
    }
    expect(screen.getByText('Live')).not.toBeNull();
    expect(screen.getByText(/strong signal.*wi-?fi/i)).not.toBeNull();
    expect(await screen.findByText('boot.log')).not.toBeNull();
    expect(apiService.getDeviceLogFiles).toHaveBeenCalledWith(11, 20, 0, undefined, undefined);
    expect(apiService.getDeviceUpdateLogs).toHaveBeenCalledWith('GW-1');
  });

  it('updates to the latest version only after a danger confirm, by serial (FW-1, FW-4)', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /update to 2\.3\.0/i }));
    expect(dialog().textContent).toMatch(/2\.3\.0/);
    expect(apiService.triggerSingleUpdate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: /keep it/i }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(apiService.triggerSingleUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /update to 2\.3\.0/i }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^update$/i }));
    await waitFor(() => expect(apiService.triggerSingleUpdate).toHaveBeenCalledWith('GW-1', 5));
  });

  it('rolls back only after a danger confirm (FW-3)', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /roll back/i }));
    expect(apiService.triggerRollback).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: /^roll back$/i }));
    await waitFor(() => expect(apiService.triggerRollback).toHaveBeenCalledWith('GW-1'));
  });

  it('shows download progress from the latest OTA log (FW-5)', async () => {
    apiService.getDeviceUpdateLogs.mockResolvedValue([
      { status: 'downloading', bytes_downloaded: 500, firmware_version: { version: '2.3.0', size: 1000 } },
    ]);
    open();
    expect(await screen.findByText(/downloading 2\.3\.0 · 50%/i)).not.toBeNull();
  });

  it('asks an admin when the firmware list is refused, rollback still offered (FW-6)', () => {
    open(null);
    expect(screen.getByText(/ask an admin/i)).not.toBeNull();
    expect(screen.queryByRole('button', { name: /update to/i })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('button', { name: /roll back/i })).not.toBeNull();
  });

  it('toggles logs and opens a log file (LG-1..LG-4)', async () => {
    open();
    await screen.findByText('boot.log');
    fireEvent.click(screen.getByRole('switch', { name: /send logs/i }));
    await waitFor(() => expect(apiService.toggleDeviceLogs).toHaveBeenCalledWith(11, true));
    fireEvent.click(screen.getByRole('button', { name: /view boot\.log/i }));
    expect(await screen.findByText('line one')).not.toBeNull();
    expect(apiService.getDeviceLogFileContent).toHaveBeenCalledWith(11, 3);
    fireEvent.click(screen.getByRole('button', { name: /download boot\.log/i }));
    await waitFor(() => expect(apiService.downloadDeviceLogFile).toHaveBeenCalledWith(11, 3));
  });

  it('auto reboot switch calls the API by pk and reverts on failure (AR-1, AR-2)', async () => {
    open();
    const sw = screen.getByRole('switch', { name: /auto reboot/i }) as HTMLInputElement;
    await waitFor(() => expect(sw.checked).toBe(true));
    expect(apiService.getDevice).toHaveBeenCalledWith(11);
    fireEvent.click(sw);
    await waitFor(() => expect(apiService.setDeviceAutoReboot).toHaveBeenCalledWith(11, false));
    await waitFor(() => expect(sw.checked).toBe(false));

    apiService.setDeviceAutoReboot.mockRejectedValueOnce(new Error('403'));
    fireEvent.click(sw);
    expect(await screen.findByText(/couldn't send that to monitor gw-1/i)).not.toBeNull();
    expect(sw.checked).toBe(false);
  });

  it('notes when the current settings cannot be read (AR-3)', async () => {
    apiService.getDevice.mockRejectedValueOnce(new Error('403'));
    open();
    await waitFor(() => expect(apiService.getDevice).toHaveBeenCalled());
    expect(screen.getAllByText(/current setting not reported/i)).toHaveLength(2);
  });

  it('restart asks first, by pk (CF-1, CF-2)', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    expect(apiService.rebootDevice).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: /keep it running/i }));
    expect(apiService.rebootDevice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^restart$/i }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^restart$/i }));
    await waitFor(() => expect(apiService.rebootDevice).toHaveBeenCalledWith(11));
    expect(await screen.findByText(/restart sent to monitor gw-1/i)).not.toBeNull();
  });

  it('hard reset asks with a danger confirm (CF-3)', async () => {
    open();
    click(/engineer only/i);
    click(/^hard reset$/i);
    expect(dialog().textContent).toMatch(/erases/i);
    expect(apiService.hardResetDevice).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: /^reset it$/i }));
    await waitFor(() => expect(apiService.hardResetDevice).toHaveBeenCalledWith(11));
  });

  it('mutes directly and shows a plain error on refusal (CF-4, CF-5)', async () => {
    apiService.getDevice.mockResolvedValue({ id: 11, alerts_muted_until: null });
    apiService.muteDeviceAlerts.mockResolvedValueOnce({ alerts_muted_until: future, indefinite: false });
    open();
    expect(await screen.findByText('On')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /turn alerts back on/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /mute alerts/i }));
    await waitFor(() => expect(apiService.muteDeviceAlerts).toHaveBeenCalledWith(11, 4));
    expect(await screen.findByText(/alerts muted for monitor gw-1/i)).not.toBeNull();
    expect(screen.queryByRole('button', { name: /mute alerts/i })).toBeNull();
    apiService.unmuteDeviceAlerts.mockRejectedValueOnce(new Error('DEVICE_OPS_OFF'));
    fireEvent.click(screen.getByRole('button', { name: /turn alerts back on/i }));
    expect(await screen.findByText(/couldn't send that to monitor gw-1/i)).not.toBeNull();
  });

  it('shows exact last update, settings applied, and only "Turn alerts back on" while muted (DR-4, DR-5, DR-7)', async () => {
    apiService.getDevice.mockResolvedValue({ id: 11, config_version: 'P-7', config_ack_ver: 3, pending_config_update: false, alerts_muted_until: future });
    open();
    expect(await screen.findByText('Applied')).not.toBeNull();
    expect(screen.getByText('Last update')).not.toBeNull();
    expect(screen.getAllByText('2.2.0').length).toBeGreaterThan(0);
    expect(screen.getByText('Muted')).not.toBeNull();
    expect(screen.getByText(/^until /i)).not.toBeNull();
    expect(screen.getByRole('button', { name: /turn alerts back on/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /mute alerts/i })).toBeNull();
  });

  it('says it is waiting for settings, and an indefinite mute in words (DR-5, DR-7)', async () => {
    apiService.getDevice.mockResolvedValue({ id: 11, config_version: 'P-7', pending_config_update: true, alerts_muted_until: '9999-12-31T23:59:59Z' });
    open();
    expect(await screen.findByText('Waiting')).not.toBeNull();
    expect(screen.getByText('to apply settings')).not.toBeNull();
    expect(screen.getByText('Muted')).not.toBeNull();
    expect(screen.getByText('until turned back on')).not.toBeNull();
  });

  it('keeps codes behind Advanced details and never shows Wi-Fi details (DR-6, DR-9)', async () => {
    apiService.getDevice.mockResolvedValue({ id: 11, config_version: 'P-7', config_ack_ver: 3, wifi_ssid: 'HomeNet', network_ip: '10.0.0.9' });
    open();
    await screen.findByText('Applied');
    expect(screen.queryByText('Serial')).toBeNull();
    click(/advanced details/i);
    expect(screen.getByText('GW-1')).not.toBeNull();
    expect(screen.getByText('P-7')).not.toBeNull();
    expect(screen.getByText('3')).not.toBeNull();
    expect(screen.queryByText(/homenet|10\.0\.0\.9/i)).toBeNull();
  });

  it('shows the last automatic restart and debug mode only when on (DR-11, DR-12)', async () => {
    const last = '2026-10-08T08:44:00Z';
    apiService.getDevice.mockResolvedValue({ id: 11, rs485_reboot_at: last, telemetry_debug_until: future });
    open();
    expect(await screen.findByText(at(last))).not.toBeNull();
    expect(screen.getByText(`dashboard data paused until ${at(future)}`)).not.toBeNull();
    expect(screen.queryByRole('switch', { name: /detailed logging/i })).toBeNull();
  });

  it('says none recorded / off, and on until turned off for the 9999 sentinel (DR-11, DR-12)', async () => {
    apiService.getDevice.mockResolvedValue({ id: 11, rs485_reboot_at: null, telemetry_debug_until: null });
    const { unmount } = open();
    expect(await screen.findByText('None recorded')).not.toBeNull();
    expect(screen.queryByText('Debug mode')).toBeNull();
    unmount();
    apiService.getDevice.mockResolvedValue({ id: 11, telemetry_debug_until: '2026-01-01T00:00:00Z' });
    const second = open();
    await screen.findByText('Last auto restart').catch(() => null);
    expect(screen.queryByText('Debug mode')).toBeNull();
    second.unmount();
    apiService.getDevice.mockResolvedValue({ id: 11, telemetry_debug_until: '9999-12-31T23:59:59Z' });
    mockCan.mockReturnValue(false);
    open();
    expect(await screen.findByText('dashboard data paused until turned off')).not.toBeNull();
  });

  it('offers both mute buttons when the mute state is unknown (DR-8)', async () => {
    apiService.getDevice.mockRejectedValueOnce(new Error('403'));
    open();
    await waitFor(() => expect(apiService.getDevice).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /mute alerts/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /turn alerts back on/i })).not.toBeNull();
    expect(screen.queryByText('Applied')).toBeNull();
    expect(screen.queryByText('Alerts')).toBeNull();
  });

  it('hides every write without device control, reads still show (DR-10)', async () => {
    mockCan.mockReturnValue(false);
    open();
    expect(mockCan).toHaveBeenCalledWith('device_control');
    expect(await screen.findByText('boot.log')).not.toBeNull();
    for (const name of [/update to/i, /roll back/i, /^restart$/i, /mute alerts/i, /turn alerts back on/i, /hard reset/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'What you can do' })).toBeNull();
    expect(await screen.findByText('Sending logs')).not.toBeNull();
    expect(screen.getByText('Auto reboot')).not.toBeNull();
    expect(screen.getByText(/version 2\.3\.0 is available/i)).not.toBeNull();
    click(/choose another version/i);
    expect(screen.getByText('2.1.0')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /install/i })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Update history' })).not.toBeNull();
    expect(screen.getByRole('button', { name: /scan this day/i })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Readings' })).not.toBeNull();
  });

  it('lists this type\'s builds newest first with notes; the running one has no install (FW-7)', () => {
    open();
    expect(screen.queryByText('Faster reconnects')).toBeNull();
    click(/choose another version/i);
    const text = document.body.textContent ?? '';
    expect(text.indexOf('2.3.0')).toBeLessThan(text.indexOf('2.1.0'));
    expect(screen.queryByText('1.1.0')).toBeNull();
    expect(screen.getByText('Faster reconnects')).not.toBeNull();
    expect(screen.getByText(/1\.5 MB/)).not.toBeNull();
    expect(screen.getByText('Running now')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /install 2\.2\.0/i })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('installs a chosen older build by serial only after a danger confirm naming it (FW-8)', async () => {
    open();
    click(/choose another version/i);
    click(/install 2\.1\.0/i);
    expect(dialog().textContent).toMatch(/2\.1\.0/);
    expect(apiService.triggerSingleUpdate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: /^update$/i }));
    await waitFor(() => expect(apiService.triggerSingleUpdate).toHaveBeenCalledWith('GW-1', 3));
  });

  it('shows the last updates in words with the failure reason (FW-9, FW-10)', async () => {
    apiService.getDeviceUpdateLogs.mockResolvedValue([
      { id: 2, status: 'failed', error_message: 'Checksum mismatch', firmware_version: { version: '2.3.0' }, last_checked_at: recent },
      { id: 1, status: 'completed', firmware_version: { version: '2.2.0' }, completed_at: recent },
    ]);
    const { unmount } = open();
    await screen.findByText(/update to 2\.3\.0 didn't finish/i);
    expect(screen.getByText('Checksum mismatch')).not.toBeNull();
    expect(screen.getByText("Didn't finish")).not.toBeNull();
    expect(screen.getByText('Installed')).not.toBeNull();
    unmount();

    apiService.getDeviceUpdateLogs.mockResolvedValue([]);
    open();
    expect(await screen.findByText('No updates yet.')).not.toBeNull();
  });

  it('scans a chosen day and downloads the fetched range (LG-5, LG-6)', async () => {
    open();
    await screen.findByText('boot.log');
    click(/scan this day/i);
    expect(await screen.findByText('Checked 2 log files: 1 error, 0 warnings.')).not.toBeNull();
    expect(apiService.scanDeviceLogFiles).toHaveBeenCalledWith(11, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));

    click(/download all/i);
    await waitFor(() => expect(apiService.bulkDownloadLogFiles).toHaveBeenCalledWith(11, undefined, undefined));
    await waitFor(() => expect((screen.getByRole('button', { name: /download all/i }) as HTMLButtonElement).disabled).toBe(false));
    apiService.bulkDownloadLogFiles.mockRejectedValueOnce(new Error('Date range too large. Narrow the date range.'));
    click(/download all/i);
    expect(await screen.findByText(/narrow the date range/i)).not.toBeNull();
  });

  it('fetches a range and pages the log list (LG-7, LG-8)', async () => {
    apiService.getDeviceLogFiles.mockResolvedValue({ files: [{ id: 3, filename: 'boot.log', uploaded_at: recent }], total: 45 });
    open();
    await screen.findByText('boot.log');
    expect(screen.getByText('Page 1 of 3')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /older/i }));
    await waitFor(() => expect(apiService.getDeviceLogFiles).toHaveBeenLastCalledWith(11, 20, 20, undefined, undefined));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }));
    await waitFor(() => expect(apiService.getDeviceLogFiles).toHaveBeenLastCalledWith(11, 20, 0, '2026-10-01T04:30:00.000Z', undefined));
  });

  it('shows only errors and warnings with readable times when asked (LG-9)', async () => {
    apiService.getDeviceLogFileContent.mockResolvedValue('1791788368\u001eE (1229575) modbus_mgr: failure\n1791788367\u001eI (1228439) sys_mon: fine');
    open();
    await screen.findByText('boot.log');
    click(/view boot\.log/i);
    expect((await screen.findByText(/modbus_mgr: failure/)).textContent).toContain('sys_mon: fine');
    fireEvent.click(screen.getByLabelText(/errors and warnings only/i));
    await waitFor(() => expect(document.body.textContent).not.toContain('sys_mon: fine'));
    expect(document.body.textContent).toContain('modbus_mgr: failure');
  });

  it('summarises register coverage and shows at once and lists each missing value when opened (DG-1, DG-2)', async () => {
    open();
    expect(await screen.findByText(/inverter values arriving/i)).not.toBeNull();
    expect(apiService.getRegisterCoverage).toHaveBeenCalledWith(11);
    expect(screen.queryByText('PV1 Voltage (V)')).toBeNull();
    click(/each value not arriving/i);
    expect(screen.getByText('PV1 Voltage (V)')).not.toBeNull();
    expect(screen.queryByText(/grid frequency/i)).toBeNull();
  });

  it('says so when coverage cannot be checked (DG-3)', async () => {
    apiService.getRegisterCoverage.mockRejectedValueOnce(new Error('404'));
    open();
    expect(await screen.findByText(/couldn't check which inverter values arrive yet/i)).not.toBeNull();
  });

  it('has no diagnostics for a whole-home meter (DG-4)', () => {
    open(FIRMWARE, { ...DEV, device_id: 12, device_type: 'energy_meter', serial: 'EM-1' });
    expect(screen.queryByRole('heading', { name: 'Diagnostics' })).toBeNull();
    expect(apiService.getRegisterCoverage).not.toHaveBeenCalled();
  });

  it('meter: no roll back, auto reboot or send logs; hard reset warns about Wi-Fi (S1)', async () => {
    const meter = { ...DEV, device_id: 12, device_type: 'energy_meter', serial: 'EM-1' };
    const { unmount } = open(FIRMWARE, meter);
    await waitFor(() => expect(apiService.getDevice).toHaveBeenCalledWith(12));
    expect(screen.queryByRole('button', { name: /roll back/i })).toBeNull();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    click(/engineer only/i);
    click(/^hard reset$/i);
    expect(dialog().textContent).toMatch(/wi-fi/i);
    expect(dialog().textContent).toMatch(/on site/i);
    unmount();

    mockCan.mockReturnValue(false);
    open(FIRMWARE, meter);
    await waitFor(() => expect(apiService.getDevice).toHaveBeenCalled());
    expect(screen.queryByText('Sending logs')).toBeNull();
    expect(screen.queryByText('Auto reboot')).toBeNull();
  });
});

describe('firmware updates card', () => {
  it('names the highest version as newest, not the latest upload (OTA-6)', async () => {
    const builds: Firmware[] = [
      { id: 1, version: '2.3.0', device_type: 'gateway', is_active: true, created_at: '2026-09-01T00:00:00Z' },
      { id: 2, version: '2.2.5', device_type: 'gateway', is_active: true, created_at: '2026-10-01T00:00:00Z' },
    ];
    open(builds);
    expect(screen.getByText('Newest').nextSibling?.textContent).toBe('2.3.0');
  });

  it('shows the update on the bar, and a failed one in amber text (OTA-7)', async () => {
    apiService.getDeviceUpdateLogs.mockResolvedValue([{ status: 'failed', error_message: 'Checksum mismatch', firmware_version: { version: '2.3.0' }, last_checked_at: recent }]);
    open();
    expect(await screen.findByRole('meter', { name: /update progress/i })).not.toBeNull();
    expect(screen.queryByText('Installing')).toBeNull();
  });
});
