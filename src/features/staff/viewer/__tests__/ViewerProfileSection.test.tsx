/// <reference types="node" />
import '@testing-library/jest-dom';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ViewerProfileSection from '../ViewerProfileSection';
import Profile from '../../Profile';

const mockUseAuth = jest.fn();
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../services/api', () => ({
  apiService: { getMyOperations: jest.fn(), getProfile: jest.fn() },
}));
let mockViewer = true;
let mockOps = true;
jest.mock('../../../../shared/access/useAccess', () => ({
  useAccess: () => ({ can: () => mockOps, isViewer: mockViewer }),
}));
jest.mock('../../../../shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
jest.mock('../../security/SecurityCard', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../mobile/staff/MobileProfile', () => ({ __esModule: true, default: () => null }));

const { apiService } = jest.requireMock('../../../../services/api');
const row = (at: string, op: string, serial: string, id = 7) => ({ at, op, action: op, device_id: id, serial, site_id: null, values: {} });

beforeEach(() => {
  mockViewer = true; mockOps = true;
  mockUseAuth.mockReturnValue({ user: {
    role: 'viewer',
    assigned_devices: [{ device_id: 7, serial: 'F82CE8D1CCB6', device_type: 'energy_meter' }],
    assigned_sites: [{ site_id: 'coim_009', display_name: 'Coimbatore bench' }],
  } });
  apiService.getMyOperations.mockResolvedValue({ days: 30, rows: [] });
});
const ui = () => render(<MemoryRouter><ViewerProfileSection /></MemoryRouter>);
const list = (title: string) => within(screen.getByText(title).closest('.vh-card') as HTMLElement);

describe('ViewerProfileSection', () => {
  it('P1: devices and sites cards with links', async () => {
    ui();
    expect(screen.getByText("What you've been given")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /F82CE8D1CCB6/ })).toHaveAttribute('href', '/devices/7/dashboard');
    expect(screen.getByRole('link', { name: /coim_009/ })).toHaveAttribute('href', '/my-sites/coim_009');
    expect(screen.getByText('Meter')).toBeInTheDocument();
    await waitFor(() => expect(apiService.getMyOperations).toHaveBeenCalledWith(30));
  });

  it('P2: operations sit under "On everything given to you" when device control is on', () => {
    ui();
    expect(list('On everything given to you').getByText('Reboot a device')).toBeInTheDocument();
    expect(list('Ask an admin for').queryByText('Reboot a device')).toBeNull();
    expect(list('Ask an admin for').getByText('Change Wi-Fi settings')).toBeInTheDocument();
  });

  it('P3: operations move to "Ask an admin for" when device control is off', () => {
    mockOps = false;
    ui();
    expect(list('On everything given to you').queryByText('Reboot a device')).toBeNull();
    expect(list('Ask an admin for').getByText('Reboot a device')).toBeInTheDocument();
  });

  it('P4: no extra ask-your-admin line (the Ask an admin card says it), no email button', () => {
    ui();
    expect(screen.queryByText('Need more? Ask your admin.')).toBeNull();
    expect(screen.queryByText(/email an admin/i)).toBeNull();
  });

  it('P5: trail rows keep the API order (newest first) with serial links', async () => {
    apiService.getMyOperations.mockResolvedValue({ days: 30, rows: [row('2026-10-29T10:00:00Z', 'reboot', 'F82CE8D1CCB6'), row('2026-10-28T10:00:00Z', 'mute_buzzer', 'F82CE8D1CCB6')] });
    ui();
    await screen.findByText('Reboot');
    const body = screen.getAllByRole('listitem').filter(li => li.closest('.fb-act'));
    expect(body[0]).toHaveTextContent('Reboot');
    expect(body[1]).toHaveTextContent('Mute buzzer');
    expect(within(body[0]).getByRole('link', { name: 'F82CE8D1CCB6' })).toHaveAttribute('href', '/devices/7/dashboard');
  });

  it('P6: empty state', async () => {
    ui();
    expect(await screen.findByText('No operations in the last 30 days')).toBeInTheDocument();
  });

  it('P6: a load error offers Try again', async () => {
    apiService.getMyOperations.mockRejectedValueOnce(new Error('x'));
    ui();
    fireEvent.click(await screen.findByText('Try again'));
    expect(await screen.findByText('No operations in the last 30 days')).toBeInTheDocument();
  });

  it('P7: Profile shows the section for a viewer, not for admin or employee', async () => {
    apiService.getProfile.mockResolvedValue({ id: 1, username: 'a', email: 'a@b.c', first_name: 'A', last_name: 'B', is_staff: true, is_superuser: false, date_joined: '2026-01-01T00:00:00Z' });
    const { unmount } = render(<MemoryRouter><Profile /></MemoryRouter>);
    expect(await screen.findByText("What you've been given")).toBeInTheDocument();
    unmount();
    mockViewer = false;
    render(<MemoryRouter><Profile /></MemoryRouter>);
    await screen.findByText(/contact information/i);
    expect(screen.queryByText("What you've been given")).toBeNull();
  });

  it('P8: copy file sits beside roles.ts and is marked KEEP IN SYNC', () => {
    const dir = path.join(__dirname, '../../employees');
    expect(fs.existsSync(path.join(dir, 'roles.ts'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'viewerAccessCopy.ts'), 'utf8')).toMatch(/KEEP IN SYNC with smart-solar-django-backend\/api\/staff_roles\.py/);
  });
});
