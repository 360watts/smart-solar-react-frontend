import '@testing-library/jest-dom';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ViewerHome from '../ViewerHome';

jest.mock('../../../../services/api', () => ({ apiService: { getAccessSummary: jest.fn() } }));
const { apiService } = jest.requireMock('../../../../services/api');
const get = apiService.getAccessSummary as jest.Mock;

const cov = (n: number) => Array.from({ length: 48 }, (_, i) => (i < n ? 'full' : i === n ? 'partial' : 'empty'));
const dev = (o: object) => ({ device_id: 1, device_type: 'gateway', serial: 'S1', firmware_version: '2.2.3', site_id: null, is_online: true, last_reading_at: new Date().toISOString(), coverage: cov(40), ...o });
const site = (o: object) => ({ site_id: 'coim_001', display_name: 'Home', devices_total: 2, devices_sending: 1, latest_incident: null, ...o });

const Where = () => <div data-testid="loc">{useLocation().pathname}</div>;
const show = () => render(
  <MemoryRouter initialEntries={['/my-sites']}>
    <Routes><Route path="/my-sites" element={<ViewerHome />} /><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => get.mockReset());

it('H1 headline counts devices and sites', async () => {
  get.mockResolvedValue({ devices: [dev({}), dev({ device_id: 2, serial: 'S2' })], sites: [site({})] });
  show();
  expect(await screen.findByText('You can test 2 devices and 1 site')).toBeInTheDocument();
});

it('H2 wording adapts', async () => {
  get.mockResolvedValue({ devices: [dev({})], sites: [] });
  const { unmount } = show();
  expect(await screen.findByText('You can test 1 device')).toBeInTheDocument();
  unmount();
  get.mockResolvedValue({ devices: [], sites: [site({}), site({ site_id: 'b' })] });
  show();
  expect(await screen.findByText('You can test 2 sites')).toBeInTheDocument();
});

it('H3 empty state', async () => {
  get.mockResolvedValue({ devices: [], sites: [] });
  show();
  expect(await screen.findByText('Nothing has been given to you yet. An admin assigns devices and sites.')).toBeInTheDocument();
});

it('H4/H5 table rows in API order with serial, firmware, status; site-less says bench', async () => {
  get.mockResolvedValue({ devices: [
    dev({ device_id: 1, serial: 'SILENT1', is_online: false, last_reading_at: null, firmware_version: '1.0.5' }),
    dev({ device_id: 2, serial: 'LIVE2', site_id: 'coim_001', device_type: 'energy_meter' }),
  ], sites: [] });
  show();
  await screen.findByText('SILENT1');
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows[0]).toHaveTextContent('SILENT1');
  expect(rows[0]).toHaveTextContent('1.0.5');
  expect(rows[0]).toHaveTextContent('Silent');
  expect(rows[0]).toHaveTextContent('bench, no site');
  expect(rows[0]).toHaveTextContent('no data yet');
  expect(rows[1]).toHaveTextContent('Meter');
  expect(rows[1]).toHaveTextContent('coim_001');
  expect(rows[1]).toHaveTextContent('Sending');
  expect(rows[1]).toHaveTextContent('last update');
});

it('H6 strip has 48 cells with state classes and a label', async () => {
  get.mockResolvedValue({ devices: [dev({ coverage: cov(10) })], sites: [] });
  show();
  const strip = await screen.findByRole('img', { name: /last 24 hours/i });
  expect(strip.children).toHaveLength(48);
  expect(strip.querySelectorAll('.full')).toHaveLength(10);
  expect(strip.querySelectorAll('.partial')).toHaveLength(1);
  expect(strip.querySelectorAll('.empty')).toHaveLength(37);
});

it('H7 row click opens the device dashboard', async () => {
  get.mockResolvedValue({ devices: [dev({ device_id: 7, serial: 'F82C' })], sites: [] });
  show();
  fireEvent.click((await screen.findByText('Monitor')).closest('tr')!);
  expect(screen.getByTestId('loc')).toHaveTextContent('/devices/7/dashboard');
});

it('H8/H9 site cards show sending count and fault, no power; click opens the site', async () => {
  get.mockResolvedValue({ devices: [], sites: [
    site({ latest_incident: { title: 'Grid voltage low', severity: 'warning', opened_at: '2026-10-29T00:00:00Z' } }),
    site({ site_id: 'b', display_name: 'Farm', devices_total: 1, devices_sending: 1 }),
  ] });
  show();
  expect((await screen.findByRole('link', { name: /Home/ })).textContent).toContain('1 of 2 devices sending');
  expect(screen.getByText('Grid voltage low')).toBeInTheDocument();
  expect(screen.getByText('No open faults')).toBeInTheDocument();
  expect(screen.queryByText(/kW/)).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: /Farm/ }));
  expect(screen.getByTestId('loc')).toHaveTextContent('/my-sites/b');
});

it('H10 access line links to profile', async () => {
  get.mockResolvedValue({ devices: [dev({})], sites: [] });
  show();
  expect(await screen.findByRole('link', { name: 'See your access' })).toHaveAttribute('href', '/profile');
  expect(screen.getByText(/You can run every operation on these devices/)).toBeInTheDocument();
});

it('H11 failure shows Try again, which refetches', async () => {
  get.mockRejectedValueOnce(new Error('x')).mockResolvedValue({ devices: [dev({})], sites: [] });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('You can test 1 device')).toBeInTheDocument();
  expect(get).toHaveBeenCalledTimes(2);
});

it('H12 refetches every 60 s and on focus, and stops after unmount', async () => {
  jest.useFakeTimers();
  try {
    get.mockResolvedValue({ devices: [dev({})], sites: [] });
    const { unmount } = show();
    await act(async () => {});
    expect(get).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(get).toHaveBeenCalledTimes(3);
    unmount();
    jest.advanceTimersByTime(120_000);
    window.dispatchEvent(new Event('focus'));
    expect(get).toHaveBeenCalledTimes(3);
  } finally { jest.useRealTimers(); }
});

it('H12 ignores an out-of-order older response', async () => {
  let first!: (v: unknown) => void;
  get.mockReturnValueOnce(new Promise(r => { first = r; }))
    .mockResolvedValueOnce({ devices: [dev({ serial: 'NEW' })], sites: [] });
  show();
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await screen.findByText('NEW');
  await act(async () => { first({ devices: [dev({ serial: 'OLD' })], sites: [] }); });
  await waitFor(() => expect(screen.queryByText('OLD')).toBeNull());
  expect(screen.getByText('NEW')).toBeInTheDocument();
});

it('H13 /my-sites renders the new home (MySites.tsx deleted, no imports left)', async () => {
  get.mockResolvedValue({ devices: [dev({})], sites: [] });
  show();
  expect(await screen.findByText(/You can test/)).toBeInTheDocument();
});
