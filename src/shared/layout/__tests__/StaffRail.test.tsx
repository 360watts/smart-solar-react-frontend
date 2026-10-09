import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StaffLayout from '../StaffLayout';
import type { Feature } from '../../access/features';

jest.mock('../../../assets/finalLogo.png', () => 'logo.png');
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: true, toggleTheme: () => {} }) }));
const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const asRole = (access: Feature[]) => mockUseAuth.mockReturnValue({
  user: { id: 1, username: 'nk', first_name: 'Nandha', last_name: 'Kumar', is_staff: true, is_superuser: false, role: 'employee', access },
  isAdmin: false, isStaff: true, logout: jest.fn(),
});

const renderAt = (path = '/dashboard') => render(<MemoryRouter initialEntries={[path]}><StaffLayout /></MemoryRouter>);
const rail = () => screen.getByRole('navigation', { name: 'Main' });

beforeEach(() => { try { localStorage.clear(); } catch { /* no storage */ } });

// docs/test-scenarios/dashboard-redesign.md row 50
it('desktop shows the slim icon rail by default, labels as aria-label + hover tooltip', () => {
  asRole(['dashboard', 'sites', 'alerts', 'devices']);
  renderAt();
  const link = within(rail()).getByRole('link', { name: 'Dashboard' });
  expect(link.getAttribute('aria-label')).toBe('Dashboard');
  expect(link.className).toContain('active');
  expect(within(rail()).getByRole('link', { name: 'Sites' }).className).not.toContain('active');
  expect(screen.queryByRole('button', { name: 'Expand menu' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeNull();
});

// docs/test-scenarios/dashboard-redesign.md row 51
it('rail keeps the can() gating: no Employees/Teams/OTA for an employee', () => {
  asRole(['dashboard', 'sites', 'alerts', 'devices', 'configuration']);
  renderAt();
  ['Employees', 'Teams', 'OTA Updates', 'Quotation'].forEach(l => expect(within(rail()).queryByRole('link', { name: l })).toBeNull());
  expect(within(rail()).queryByRole('link', { name: 'Configuration' })).not.toBeNull();
});

// docs/test-scenarios/dashboard-redesign.md row 52
it('rail lists every destination an admin can reach', () => {
  asRole(['dashboard', 'sites', 'alerts', 'devices', 'bookings', 'support', 'configuration', 'presets',
    'catalog', 'quotations', 'users', 'employees', 'teams', 'ota', 'analytics']);
  renderAt();
  ['Dashboard', 'Devices', 'Alerts', 'Configuration', 'Users', 'Device Presets', 'Sites', 'Product Catalog',
    'Quotation', '360Care Bookings', 'Support Inbox', 'OTA Updates', 'Employees', 'Teams', 'Analytics']
    .forEach(l => expect(within(rail()).queryByRole('link', { name: l })).not.toBeNull());
});
