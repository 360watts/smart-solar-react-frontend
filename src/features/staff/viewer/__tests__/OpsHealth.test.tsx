import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OpsHealth from '../OpsHealth';

jest.mock('../../../../services/api', () => ({ apiService: { getDeviceEvents: jest.fn(), scanDeviceLogFiles: jest.fn() } }));
const { apiService } = jest.requireMock('../../../../services/api');

const GOOD = { net_active: 1, wifi_status: 0, wifi_rssi: -55, mqtt_status: 0, mqtt_latency_ms: 90, data_status: 0, data_devices: 1, sd_status: 0, sd_size: 8000, sd_free: 4000, cell_status: 22 };
const BAD = { ...GOOD, mqtt_status: 41, sd_status: 31 };
const ev = (id: number, payload: object, minsAgo = 3) => ({ id, event: 'diag', payload, received_at: new Date(Date.now() - minsAgo * 60_000).toISOString(), device_ts: new Date().toISOString() });
const draw = (props: any = {}, url = '/x?tab=ops&ops=logs') =>
  render(<MemoryRouter initialEntries={[url]}><OpsHealth deviceId={47} {...props} /></MemoryRouter>);
const events = (...e: any[]) => apiService.getDeviceEvents.mockResolvedValue({ results: e });

describe('OpsHealth', () => {
  beforeEach(() => { jest.clearAllMocks(); apiService.scanDeviceLogFiles.mockResolvedValue({ files_scanned: 3, total_errors: 2, total_warnings: 0 }); events(ev(1, GOOD)); });

  it('HL1 header: title, All good, last report with minutes', async () => {
    draw();
    expect(await screen.findByText('All good')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gateway health' })).toBeInTheDocument();
    expect(screen.getByText(/Last report/)).toHaveTextContent(/3 min ago/);
  });

  it('HL2 chip counts failing checks', async () => {
    events(ev(1, BAD));
    draw();
    expect(await screen.findByText('2 need a look')).toBeInTheDocument();
  });

  it('HL3 empty state', async () => {
    events();
    draw();
    expect(await screen.findByText('Waiting for the first report')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Actions' })).toHaveAttribute('href', '/x?tab=ops');
    expect(screen.getByText('No health report yet')).toBeInTheDocument();
  });

  it('HL4 Scan logs sends the chosen day and shows error and warning tiles', async () => {
    draw();
    await screen.findByText('All good');
    expect(screen.queryByRole('button', { name: /Check now/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Day to scan'), { target: { value: '2026-10-29' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan logs' }));
    expect(screen.getByRole('button', { name: 'Scanning…' })).toBeDisabled();
    expect(await screen.findByLabelText('Scan errors')).toHaveTextContent('2');
    expect(screen.getByLabelText('Scan warnings')).toHaveTextContent('No warnings logged.');
    expect(screen.getByText('Scanned 3 log files from 2026-10-29.')).toBeInTheDocument();
    expect(apiService.scanDeviceLogFiles).toHaveBeenCalledWith(47, '2026-10-29');
    expect(screen.getByRole('button', { name: 'Scan logs' })).toBeEnabled();
  });

  it('HL5 no log files that day', async () => {
    apiService.scanDeviceLogFiles.mockResolvedValue({ files_scanned: 0, total_errors: 0, total_warnings: 0 });
    draw();
    await screen.findByText('All good');
    fireEvent.click(screen.getByRole('button', { name: 'Scan logs' }));
    expect(await screen.findByText(/No log files from .* to scan\./)).toBeInTheDocument();
  });

  it('HL6 scan failure', async () => {
    apiService.scanDeviceLogFiles.mockRejectedValue(new Error('x'));
    draw();
    await screen.findByText('All good');
    fireEvent.click(screen.getByRole('button', { name: 'Scan logs' }));
    expect(await screen.findByText("Couldn't scan those logs. Try again.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan logs' })).toBeEnabled();
  });

  it('HL10 wifi note with Change Wi-Fi link keeping params', async () => {
    draw({ device: { wifi_failure: { ssid: 'Home', reason: 'auth_failed' } } });
    expect(await screen.findByText(/Couldn't join Wi-Fi Home: wrong password/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change Wi-Fi' })).toHaveAttribute('href', '/x?tab=ops&ops=settings');
    expect(screen.getByText('1 needs a look')).toBeInTheDocument();
  });

  it('HL11 refused settings note', async () => {
    draw({ device: { config_rejected: '12:3' } });
    expect(await screen.findByText(/refused settings 12 v3/)).toBeInTheDocument();
  });

  it('HL12 tiles: failing first, battery added, state chips', async () => {
    events(ev(1, BAD));
    draw({ device: { battery_pct: 80 } });
    await screen.findByText('2 need a look');
    const names = screen.getAllByRole('listitem').map(l => l.getAttribute('aria-label')).filter(n => n?.startsWith('Check '));
    expect(names.slice(0, 2).sort()).toEqual(['Check Cloud', 'Check Memory card']);
    expect(names).toContain('Check Backup battery');
    expect(screen.getAllByText('Look')).toHaveLength(2);
    expect(screen.getAllByText('OK').length).toBeGreaterThan(2);
    expect(screen.getByText('80% charged')).toBeInTheDocument();
  });

  it('HL13 history switches the shown check', async () => {
    events(ev(3, GOOD, 1), ev(2, BAD, 10), ev(1, GOOD, 20));
    draw();
    await screen.findByText('All good');
    const items = screen.getAllByRole('button', { name: /^Health report / });
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(items[1]);
    expect(items[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('2 need a look').length).toBeGreaterThan(0);
  });

  it('HL14 raw values closed until opened', async () => {
    draw();
    await screen.findByText('All good');
    expect(screen.queryByText('Wi-Fi signal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /All raw values/ }));
    expect(screen.getByText('Wi-Fi signal')).toBeInTheDocument();
  });

  it('HL15 no APN form', async () => {
    draw();
    await screen.findByText('All good');
    expect(screen.queryByText(/APN/)).toBeNull();
  });

  it('HL16 loading skeleton', () => {
    apiService.getDeviceEvents.mockReturnValue(new Promise(() => {}));
    draw();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('HL17 load error with Try again', async () => {
    apiService.getDeviceEvents.mockRejectedValueOnce(new Error('no'));
    draw();
    expect(await screen.findByText("Couldn't load the health history")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('All good')).toBeInTheDocument();
    await waitFor(() => expect(apiService.getDeviceEvents).toHaveBeenCalledTimes(2));
  });
});
