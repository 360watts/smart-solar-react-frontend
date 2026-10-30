import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { STAFF_NAV_ITEMS, visibleNavItems } from '../staffNavigation';
import type { Feature } from '../../access/features';
import { RoleRedirect } from '../../../app/App';

// App.tsx pulls in these pages, which import .png files jest cannot parse.
jest.mock('../../../features/auth/components/Login', () => () => null);
jest.mock('../../../features/auth/components/VerifyEmailPage', () => () => null);

const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const ALL: Feature[] = [
  'dashboard', 'sites', 'alerts', 'devices', 'bookings', 'support', 'configuration', 'presets',
  'catalog', 'quotations', 'users', 'employees', 'teams', 'ai_chat', 'site_billing', 'destructive',
  'ota', 'analytics', 'site_credentials', 'site_monitoring', 'device_control',
];
const EMPLOYEE: Feature[] = [
  'dashboard', 'sites', 'alerts', 'devices', 'bookings', 'support', 'configuration', 'presets',
  'site_monitoring', 'device_control',
];

const labels = (can: (f: Feature) => boolean) => visibleNavItems(STAFF_NAV_ITEMS, can).map((i) => i.label);

describe('visibleNavItems', () => {
  it('admin sees everything, with one Dashboard entry', () => {
    const l = labels((f) => ALL.includes(f));
    expect(l).toEqual(expect.arrayContaining(['Dashboard', 'Employees', 'Teams', 'OTA', 'Quotation', 'Profile']));
    expect(l.filter((x) => x === 'Dashboard')).toHaveLength(1);
  });

  it('employee does not see Employees, Teams, OTA or Quotation', () => {
    const l = labels((f) => EMPLOYEE.includes(f));
    ['Employees', 'Teams', 'OTA', 'Quotation'].forEach((x) => expect(l).not.toContain(x));
    expect(l.filter((x) => x === 'Dashboard')).toHaveLength(1);
    expect(l).toEqual(expect.arrayContaining(['Dashboard', 'Sites', 'Devices', 'Profile']));
  });

  it('viewer sees only Dashboard (their sites and devices) and Profile, which has no feature', () => {
    expect(labels((f) => f === 'my_sites')).toEqual(['Dashboard', 'Profile']);
  });
});

describe('RoleRedirect', () => {
  const run = (role: string | null, access?: Feature[]) => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'u', email: '', first_name: '', last_name: '', is_staff: true, is_superuser: false, role, access },
      isAuthenticated: true,
      isAdmin: false,
      isStaff: true,
      loading: false,
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/my-sites" element={<div>viewer home</div>} />
          <Route path="/dashboard" element={<div>staff home</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('sends a viewer to /my-sites', () => {
    run('viewer', ['my_sites']);
    expect(screen.getByText('viewer home')).toBeInTheDocument();
  });

  it('sends everyone else to /dashboard', () => {
    run('employee', ['dashboard']);
    expect(screen.getByText('staff home')).toBeInTheDocument();
  });
});
