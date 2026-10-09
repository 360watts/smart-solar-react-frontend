import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MySites from '../MySites';
import ViewerSite from '../ViewerSite';

const mockUseAuth = jest.fn();
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../services/api', () => ({
  apiService: { getSitesList: jest.fn(), getSites: jest.fn() },
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

describe('MySites', () => {
  const ui = () => (
    <MemoryRouter initialEntries={['/my-sites']}>
      <Routes><Route path="/my-sites" element={<MySites />} /></Routes>
    </MemoryRouter>
  );

  it('shows a card with an Open link per assigned site, without listing all sites', () => {
    sites([{ site_id: 's1', display_name: 'Home' }, { site_id: 's2', display_name: 'Farm' }]);
    render(ui());
    expect(screen.getByText('Your sites')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Farm')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /open/i });
    expect(links.map(l => l.getAttribute('href'))).toEqual(['/my-sites/s1', '/my-sites/s2']);
    Object.values(apiService).forEach((fn: any) => expect(fn).not.toHaveBeenCalled());
  });

  it('shows the empty state when nothing is assigned', () => {
    sites([]);
    render(ui());
    expect(screen.getByText('No sites yet')).toBeInTheDocument();
    expect(screen.getByText(/ask an admin/i)).toBeInTheDocument();
  });
});

describe('ViewerSite', () => {
  const ui = (path: string) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/my-sites/:siteId" element={<ViewerSite />} /></Routes>
    </MemoryRouter>
  );

  it('shows the monitoring panel for an assigned site (incl. plugs, PV-6)', () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    render(ui('/my-sites/s1'));
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to your sites/i })).toHaveAttribute('href', '/my-sites');
    expect(screen.getByTestId('panel').textContent).toBe('s1:overview,history,forecast,weather,phase-load,plugs,usage');
  });

  it('adds the devices tab only with device control (TB-1, TB-2)', () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    mockCan.mockImplementation((f: string) => f === 'device_control');
    render(ui('/my-sites/s1'));
    expect(screen.getByTestId('panel').textContent).toBe('s1:overview,history,forecast,weather,phase-load,plugs,usage,devices');
    mockCan.mockReturnValue(false);
  });

  it('shows the not-available message for a site outside the list', () => {
    sites([{ site_id: 's1', display_name: 'Home' }]);
    render(ui('/my-sites/other'));
    expect(screen.queryByTestId('panel')).toBeNull();
    expect(screen.getByText(/isn't available/i)).toBeInTheDocument();
  });
});
