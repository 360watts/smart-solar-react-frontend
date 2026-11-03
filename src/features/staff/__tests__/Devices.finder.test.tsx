import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Devices from '../Devices';

const mockGetDevices = jest.fn();
jest.mock('../../../services/api', () => ({
  apiService: new Proxy({}, {
    get: (_t, name) => (name === 'getDevices' ? (...a: unknown[]) => mockGetDevices(...a) : () => Promise.resolve([])),
  }),
}));
jest.mock('../../../shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { is_staff: true, is_superuser: true } }) }));
jest.mock('../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: () => true }) }));
jest.mock('../../../shared/components/SiteDataPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../shared/components/EnergyMeterDashboard', () => ({ __esModule: true, default: () => null }));
jest.mock('../AuditTrail', () => ({ __esModule: true, default: () => null }));
jest.mock('../EditDeviceModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../DeleteDeviceModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../RestoreArchivedDeviceModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../ManageProvisionsModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../GatewayActivity', () => ({ __esModule: true, default: () => null }));
jest.mock('../../mobile/staff/MobileDevices', () => ({ __esModule: true, default: () => null }));

const row = (o: object) => ({ provisioned_at: '2026-10-01T00:00:00Z', is_active: true, coverage: Array(24).fill('full'), open_alerts: 0, ...o });
const PAGE = {
  count: 2, total_pages: 1, current_page: 1, page_size: 25,
  facets: { all: 2, online: 1, offline: 1, attention: 1 },
  results: [
    row({ id: 1, device_serial: 'F82CE8D1CCB6', device_type: 'energy_meter', is_online: true, last_heartbeat: new Date().toISOString(), site_name: null, customer_name: null }),
    row({ id: 2, device_serial: 'A4CF12B8E9A0', is_online: false, last_heartbeat: null, site_name: 'Rao Residence', customer_name: 'Lakshmi Rao', open_alerts: 2 }),
  ],
};

beforeEach(() => { mockGetDevices.mockReset().mockResolvedValue(PAGE); });

it('shows the finder, facet chips, rows and a side panel for the first device', async () => {
  render(<MemoryRouter><Devices /></MemoryRouter>);
  expect(await screen.findByPlaceholderText('Find a device by serial, site or customer')).toBeTruthy();
  expect(await screen.findByRole('button', { name: /Needs attention\s*1/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Online\s*1/ })).toBeTruthy();
  expect(screen.getAllByText('F82CE8D1CCB6').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Rao Residence').length).toBeGreaterThan(0);
  expect(screen.getAllByText('No site yet').length).toBe(2); // row + side panel
  expect(screen.getByLabelText('Selected device')).toHaveProperty("textContent", expect.stringContaining('Energy meter'));
  fireEvent.click(screen.getByText('A4CF12B8E9A0'));
  expect(screen.getByLabelText('Selected device')).toHaveProperty("textContent", expect.stringContaining('2 open alerts on this device.'));
});

it('asks the server for the chosen state and type', async () => {
  render(<MemoryRouter><Devices /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /^Offline\s*1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Meters' }));
  await waitFor(() => expect(mockGetDevices).toHaveBeenLastCalledWith(undefined, 1, expect.any(Number), { state: 'offline', deviceType: 'energy_meter' }));
});

const Here = () => <span data-testid="here">{useLocation().pathname}</span>;
const withRoutes = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/devices" element={<Devices />} /><Route path="/devices/:id/dashboard" element={<Here />} /></Routes>
  </MemoryRouter>,
);

it('N1 Open device and a double-click both go to the device page', async () => {
  const first = withRoutes('/devices');
  fireEvent.click(await screen.findByRole('button', { name: 'Open device' }));
  expect(screen.getByTestId('here')).toHaveTextContent('/devices/1/dashboard');
  first.unmount();
  withRoutes('/devices');
  fireEvent.doubleClick(await screen.findByText('A4CF12B8E9A0'));
  expect(screen.getByTestId('here')).toHaveTextContent('/devices/2/dashboard');
});

it('N2 an old ?deviceId link goes to the device page', async () => {
  withRoutes('/devices?deviceId=2');
  await waitFor(() => expect(screen.getByTestId('here')).toHaveTextContent('/devices/2/dashboard'));
});

it('B2 side panel: one main button, supporting buttons, red Delete', async () => {
  render(<MemoryRouter><Devices /></MemoryRouter>);
  const open = await screen.findByRole('button', { name: 'Open device' });
  expect(open.className).toContain('ui-btn--main');
  expect(screen.getByRole('button', { name: 'Edit' }).className).toContain('ui-btn--support');
  expect(screen.getByRole('button', { name: 'Reboot' }).className).toContain('ui-btn--support');
  expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('ui-btn--danger');
  expect(screen.getByLabelText('Selected device').querySelectorAll('.ui-btn--main').length).toBe(1);
});
