import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAccess } from '../useAccess';
import RequireAccess from '../RequireAccess';
import { LEGACY_ADMIN_ONLY } from '../features';

const mockUseAuth = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const auth = (user: any, extra: any = {}) => {
  mockUseAuth.mockReturnValue({
    user,
    isAuthenticated: !!user,
    isAdmin: !!user?.is_superuser,
    isStaff: !!(user && (user.is_staff || user.is_superuser)),
    loading: false,
    ...extra,
  });
};

const base = { id: 1, username: 'u', email: 'u@x.com', first_name: '', last_name: '' };

describe('useAccess', () => {
  it('uses user.access when the backend sends it', () => {
    auth({ ...base, is_staff: true, is_superuser: false, role: 'employee', access: ['dashboard', 'employees'] });
    const { result } = renderHook(() => useAccess());
    expect(result.current.can('employees')).toBe(true);
    expect(result.current.can('teams')).toBe(false);
  });

  it('falls back for a superuser: everything except my_sites', () => {
    auth({ ...base, is_staff: true, is_superuser: true });
    const { result } = renderHook(() => useAccess());
    expect(result.current.can('employees')).toBe(true);
    expect(result.current.can('dashboard')).toBe(true);
    expect(result.current.can('my_sites')).toBe(false);
  });

  it('fails closed for a viewer when the backend sends no access list', () => {
    auth({ ...base, is_staff: true, is_superuser: false, role: 'viewer' });
    const { result } = renderHook(() => useAccess());
    expect(result.current.can('dashboard')).toBe(false);
    expect(result.current.can('devices')).toBe(false);
    expect(result.current.can('site_monitoring')).toBe(false);
  });

  it('falls back for non-superuser staff: no admin-only features', () => {
    auth({ ...base, is_staff: true, is_superuser: false });
    const { result } = renderHook(() => useAccess());
    LEGACY_ADMIN_ONLY.forEach((f) => expect(result.current.can(f)).toBe(false));
    expect(result.current.can('my_sites')).toBe(false);
    expect(result.current.can('dashboard')).toBe(true);
    expect(result.current.can('devices')).toBe(true);
  });

  it('denies everything when signed out or not staff', () => {
    auth(null);
    expect(renderHook(() => useAccess()).result.current.can('dashboard')).toBe(false);
    auth({ ...base, is_staff: false, is_superuser: false });
    expect(renderHook(() => useAccess()).result.current.can('dashboard')).toBe(false);
  });

  it('isViewer follows role and picks the home path', () => {
    auth({ ...base, is_staff: true, is_superuser: false, role: 'viewer', access: ['my_sites'] });
    const v = renderHook(() => useAccess()).result.current;
    expect(v.isViewer).toBe(true);
    expect(v.home).toBe('/my-sites');
    auth({ ...base, is_staff: true, is_superuser: false, role: 'employee', access: ['dashboard'] });
    const e = renderHook(() => useAccess()).result.current;
    expect(e.isViewer).toBe(false);
    expect(e.home).toBe('/dashboard');
  });

  it('home never points at a page the person cannot open', () => {
    auth({ ...base, is_staff: true, is_superuser: false, role: 'employee', access: [] });
    expect(renderHook(() => useAccess()).result.current.home).toBe('/profile');
    auth({ ...base, is_staff: true, is_superuser: false, role: 'viewer' });
    expect(renderHook(() => useAccess()).result.current.home).toBe('/profile');
  });
});

describe('RequireAccess', () => {
  const ui = () => (
    <MemoryRouter initialEntries={['/employees']}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route
          path="/employees"
          element={<RequireAccess feature="employees"><div>secret</div></RequireAccess>}
        />
      </Routes>
    </MemoryRouter>
  );

  it('renders children when allowed', () => {
    auth({ ...base, is_staff: true, is_superuser: false, role: 'admin', access: ['employees'] });
    render(ui());
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('shows a message and a home link to /dashboard when denied', () => {
    auth({ ...base, is_staff: true, is_superuser: false, role: 'employee', access: ['dashboard'] });
    render(ui());
    expect(screen.queryByText('secret')).toBeNull();
    expect(screen.getByText(/isn't available/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your home/i })).toHaveAttribute('href', '/dashboard');
  });

  it('links a denied viewer to /my-sites', () => {
    auth({ ...base, is_staff: true, is_superuser: false, role: 'viewer', access: ['my_sites'] });
    render(ui());
    expect(screen.getByRole('link', { name: /go to your home/i })).toHaveAttribute('href', '/my-sites');
  });

  it('shows the loading placeholder while loading', () => {
    auth(null, { loading: true });
    render(ui());
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    auth(null);
    render(ui());
    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
