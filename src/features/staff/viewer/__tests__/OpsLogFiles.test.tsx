import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OpsLogFiles from '../OpsLogFiles';

jest.mock('../../../../services/api', () => ({ apiService: {
  getDeviceLogFiles: jest.fn(), getDeviceLogFileContent: jest.fn(), downloadDeviceLogFile: jest.fn(), bulkDownloadLogFiles: jest.fn(), scanDeviceLogFiles: jest.fn(),
} }));
const { apiService } = jest.requireMock('../../../../services/api');
const files = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ id: from + i, filename: `log_${from + i}.txt`, file_size: 2048, uploaded_at: '2026-10-29T10:00:00Z' }));
const draw = (url = '/x?tab=ops&ops=logs') => render(<MemoryRouter initialEntries={[url]}><OpsLogFiles deviceId={47} isDark={false} /></MemoryRouter>);
const LOG = '1761700000 E (100) wifi: bad\n1761700001 W (101) mqtt: slow\n1761700002 I (102) app: ok\nplain';

describe('OpsLogFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getDeviceLogFiles.mockResolvedValue({ files: files(3), total: 3 });
    apiService.getDeviceLogFileContent.mockResolvedValue(LOG);
    apiService.downloadDeviceLogFile.mockResolvedValue(undefined);
    apiService.bulkDownloadLogFiles.mockResolvedValue(undefined);
    apiService.scanDeviceLogFiles.mockResolvedValue({ files_scanned: 3, total_errors: 2, total_warnings: 5 });
  });

  it('LG1 toolbar: chips, Download all (N); From/To hidden until Custom', async () => {
    draw();
    expect(await screen.findByRole('button', { name: 'Download all (3)' })).toBeEnabled();
    ['Last 24 hours', 'Last 7 days', 'Custom'].forEach(n => expect(screen.getByRole('button', { name: n })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^(Fetch|Reset)$/ })).toBeNull();
    expect(screen.queryByLabelText('From')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('LG2 chips and Custom refetch from offset 0', async () => {
    draw();
    await screen.findByText('log_1.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() => expect(apiService.getDeviceLogFiles).toHaveBeenCalledTimes(2));
    expect(apiService.getDeviceLogFiles.mock.calls[1].slice(0, 3)).toEqual([47, 20, 0]);
    expect(apiService.getDeviceLogFiles.mock.calls[1][3]).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01T08:00' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-02T08:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(apiService.getDeviceLogFiles).toHaveBeenCalledTimes(3));
    expect(apiService.getDeviceLogFiles.mock.calls[2].slice(3)).toEqual(['2026-10-01T02:30:00.000Z', '2026-10-02T02:30:00.000Z']);
  });

  it('LG3 Download all uses the applied range', async () => {
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Download all (3)' }));
    await waitFor(() => expect(apiService.bulkDownloadLogFiles).toHaveBeenCalledWith(47, undefined, undefined));
  });

  it('LG4 the day scan lives in Gateway health, not in this toolbar', async () => {
    draw();
    await screen.findByText('log_1.txt');
    expect(screen.queryByRole('button', { name: 'Check' })).toBeNull();
    expect(screen.queryByLabelText('Day to check')).toBeNull();
  });

  it('LG5 rows show name, size; Download per row', async () => {
    draw();
    const row = (await screen.findByText('log_2.txt')).closest('li')!;
    expect(within(row).getByText(/2 KB/)).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Download log_2.txt' }));
    expect(apiService.downloadDeviceLogFile).toHaveBeenCalledWith(47, 2);
  });

  it('LG6/LG7 click a row opens it in the viewer; latest click wins', async () => {
    draw();
    expect(await screen.findByText('Pick a log file to read it.')).toBeInTheDocument();
    let slow: (t: string) => void = () => {};
    apiService.getDeviceLogFileContent.mockImplementationOnce(() => new Promise(r => { slow = r; }));
    fireEvent.click(screen.getByRole('button', { name: 'Open log_1.txt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open log_2.txt' }));
    expect(await screen.findByRole('heading', { name: 'log_2.txt' })).toBeInTheDocument();
    slow('1761700000 E (1) late: stale');
    await Promise.resolve();
    expect(screen.queryByText(/stale/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Open log_2.txt' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('switch', { name: 'Errors and warnings only' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Wrap lines' })).toBeInTheDocument();
  });

  it('LG8 level colouring and errors-only', async () => {
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Open log_1.txt' }));
    expect(await screen.findByText(/wifi: bad/)).toHaveClass('lvl-e');
    expect(screen.getByText(/mqtt: slow/)).toHaveClass('lvl-w');
    expect(screen.getByText(/app: ok/)).not.toHaveClass('lvl-e');
    fireEvent.click(screen.getByRole('switch', { name: 'Errors and warnings only' }));
    expect(screen.queryByText(/app: ok/)).toBeNull();
    expect(screen.getByText(/mqtt: slow/)).toBeInTheDocument();
  });

  it('LG9 open failure', async () => {
    apiService.getDeviceLogFileContent.mockRejectedValue(new Error('x'));
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'Open log_1.txt' }));
    expect(await screen.findByText("Couldn't open that log file.")).toBeInTheDocument();
  });

  it('LG10 empty state links to settings keeping params', async () => {
    apiService.getDeviceLogFiles.mockResolvedValue({ files: [], total: 0 });
    draw();
    expect(await screen.findByText('No log files in this range')).toBeInTheDocument();
    expect(screen.getByText(/Turn on Send logs in/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/x?tab=ops&ops=settings');
    expect(screen.getByRole('button', { name: 'Download all (0)' })).toBeDisabled();
  });

  it('LG11 loading skeleton, then failure with Try again', async () => {
    apiService.getDeviceLogFiles.mockRejectedValueOnce(new Error('x'));
    draw();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load the log files")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('log_1.txt')).toBeInTheDocument();
  });

  it('LG12 paging and retention note', async () => {
    apiService.getDeviceLogFiles.mockResolvedValue({ files: files(20), total: 45 });
    draw();
    await screen.findByText('log_1.txt');
    expect(screen.getByText(/kept for 90 days/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Newer' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Older' }));
    await waitFor(() => expect(apiService.getDeviceLogFiles.mock.calls[1].slice(1, 3)).toEqual([20, 20]));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });
});
