import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ViewerSite from '../ViewerSite';
import ViewerEvents from '../ViewerEvents';

const mockUseAuth = jest.fn();
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../services/api', () => ({
  apiService: { getSitesList: jest.fn(), getSites: jest.fn(), getAccessSummary: jest.fn(), getSiteEvents: jest.fn() },
}));
const mockCan = jest.fn().mockReturnValue(false);
jest.mock('../../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: mockCan }) }));
jest.mock('../../../../shared/components/SiteDataPanel', () => ({
  __esModule: true,
  default: (p: any) => <div data-testid="panel">{p.siteId}:{(p.visibleTabs || []).join(',')}</div>,
}));

const { apiService } = jest.requireMock('../../../../services/api');
const sites = (list: { site_id: string; display_name: string }[]) =>
  mockUseAuth.mockReturnValue({ user: { assigned_sites: list } });

const dev = (id: number, site: string | null) => ({ device_id: id, device_type: 'gateway', serial: `SN${id}`, firmware_version: null, site_id: site, is_online: true, last_reading_at: null, coverage: Array(48).fill('full') });

describe('ViewerSite', () => {
  beforeEach(() => { apiService.getAccessSummary.mockResolvedValue({ devices: [], sites: [] }); });

  const ui = (path: string) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/my-sites/:siteId" element={<ViewerSite />} /></Routes>
    </MemoryRouter>
  );

  it('shows the monitoring panel for an assigned site (V3, V4: no forecast/weather; plugs, usage, events kept)', () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    render(ui('/my-sites/s1'));
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to your sites/i })).toHaveAttribute('href', '/my-sites');
    expect(screen.getByTestId('panel').textContent).toBe('s1:overview,history,phase-load,plugs,usage,events');
  });

  it('adds the devices tab only with device control (TB-1, TB-2)', () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    mockCan.mockImplementation((f: string) => f === 'device_control');
    render(ui('/my-sites/s1'));
    expect(screen.getByTestId('panel').textContent).toBe('s1:overview,history,phase-load,plugs,usage,events,devices');
    mockCan.mockReturnValue(false);
  });

  it('shows the not-available message for a site outside the list', () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    render(ui('/my-sites/other'));
    expect(screen.queryByTestId('panel')).toBeNull();
    expect(screen.getByText(/isn't available/i)).toBeInTheDocument();
  });

  it('V1: one strip per device at this site, linking to the device dashboard', async () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    apiService.getAccessSummary.mockResolvedValue({ devices: [dev(1, 's1'), dev(2, 's2'), dev(3, 's1')], sites: [] });
    render(ui('/my-sites/s1'));
    expect(await screen.findByLabelText(/SN1, last 24 hours/)).toBeInTheDocument();
    expect(screen.getByLabelText(/SN3, last 24 hours/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/SN2/)).toBeNull();
    expect(screen.getByRole('link', { name: /SN3/ })).toHaveAttribute('href', '/devices/3/dashboard');
  });

  it('V2: no devices at the site, no strip block', async () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    apiService.getAccessSummary.mockResolvedValue({ devices: [dev(2, 's2')], sites: [] });
    const { container } = render(ui('/my-sites/s1'));
    await waitFor(() => expect(apiService.getAccessSummary).toHaveBeenCalled());
    expect(container.querySelector('.vh-strip')).toBeNull();
    expect(container.querySelector('.vh')).toBeNull();
  });
});

describe('ViewerEvents', () => {
  const ev = (at: string, title: string, kind = 'incident') => ({ at, kind, title, severity: null, status: null, actor: kind === 'operation' ? { id: 1, name: 'Asha' } : null, device_id: 5, serial: 'SN5' });

  it('V5: lists events in the order given with kind, title, actor, serial', async () => {
    apiService.getSiteEvents.mockResolvedValue({ days: 7, events: [ev('2026-10-29T10:00:00Z', 'Restart', 'operation'), ev('2026-10-28T10:00:00Z', 'Grid down')] });
    render(<ViewerEvents siteId="s1" />);
    await screen.findByText('Restart');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent(/Operation.*Restart.*Asha.*SN5/);
    expect(rows[1]).toHaveTextContent(/Incident.*Grid down/);
    expect(apiService.getSiteEvents).toHaveBeenCalledWith('s1', 7);
  });

  it('V6: empty state', async () => {
    apiService.getSiteEvents.mockResolvedValue({ days: 7, events: [] });
    render(<ViewerEvents siteId="s1" />);
    expect(await screen.findByText('Nothing happened in the last 7 days')).toBeInTheDocument();
  });

  it('V7: error with Try again that retries', async () => {
    apiService.getSiteEvents.mockRejectedValueOnce(new Error('x')).mockResolvedValue({ days: 7, events: [] });
    render(<ViewerEvents siteId="s1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nothing happened in the last 7 days')).toBeInTheDocument();
  });
});
