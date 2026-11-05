import React from 'react';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmployeesPage from '../EmployeesPage';
import { apiService } from '../../../../services/api';
import { Person } from '../roles';

jest.mock('../../../../shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
jest.mock('../../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
const mockAddToast = jest.fn();
jest.mock('../../../../contexts/ToastContext', () => ({ useToast: () => ({ addToast: mockAddToast }) }));
jest.mock('../../../../services/api', () => ({
  apiService: {
    getEmployees: jest.fn(), getEmployeeRoleCounts: jest.fn(), getSitesList: jest.fn(), getTeams: jest.fn(), getDevices: jest.fn(),
    deleteEmployee: jest.fn(), updateEmployee: jest.fn(), createTeam: jest.fn(), getEmployeeOperations: jest.fn(),
  },
}));

// The page debounces search by 300 ms; under a full parallel run the 1 s default wait was too tight.
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(20000);

const api = apiService as jest.Mocked<typeof apiService>;
const priya: Person = { id: 1, email: 'Priya@Example.com', first_name: 'Priya', last_name: 'Raman', role: 'admin', is_active: true };
const meera: Person = {
  id: 5, email: 'Meera@Example.com', first_name: 'Meera', last_name: 'Iyer', role: 'employee',
  address: '12 Main St', is_active: true, last_login: null,
};
const lastCall = () => api.getEmployees.mock.calls[api.getEmployees.mock.calls.length - 1] as any[];

beforeEach(() => {
  jest.clearAllMocks();
  api.getEmployeeRoleCounts.mockResolvedValue({ all: 26, admin: 1, employee: 25, viewer: 0, inactive: 0 } as any);
  api.getSitesList.mockResolvedValue([] as any);
  api.getTeams.mockResolvedValue({ results: [] } as any);
  api.getDevices.mockResolvedValue({ results: [], has_next: false } as any);
});

const openMenuFor = (name: string) => fireEvent.click(screen.getByRole('button', { name: `More actions for ${name}` }));

describe('EmployeesPage', () => {
  it('renders a row per person, sorted by name A to Z by default', async () => {
    api.getEmployees.mockResolvedValue({ results: [priya, meera], count: 2 } as any);
    render(<EmployeesPage />);
    expect(await screen.findByRole('row', { name: 'Meera Iyer' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Priya Raman' })).toBeInTheDocument();
    expect(lastCall()[4]).toMatchObject({ ordering: 'name' });
    expect(screen.getByText(/sorted by name a to z/i)).toBeInTheDocument();
    expect(screen.getAllByText('Not yet recorded')).toHaveLength(2);
  });

  it('sorts from a column header, newest first for dates, and resets to Name A to Z', async () => {
    api.getEmployees.mockResolvedValue({ results: [priya, meera], count: 2 } as any);
    render(<EmployeesPage />);
    await screen.findByRole('row', { name: 'Meera Iyer' });
    fireEvent.click(screen.getByRole('button', { name: /last sign-in/i }));
    await waitFor(() => expect(lastCall()[4]).toMatchObject({ ordering: '-last_active' }));
    fireEvent.click(screen.getByRole('button', { name: /last sign-in/i }));
    await waitFor(() => expect(lastCall()[4]).toMatchObject({ ordering: 'last_active' }));
    fireEvent.click(screen.getByRole('button', { name: /reset to name a to z/i }));
    await waitFor(() => expect(lastCall()[4]).toMatchObject({ ordering: 'name' }));
  });

  it("asks for people who can't sign in from the Can't sign in view", async () => {
    api.getEmployees.mockResolvedValue({ results: [meera], count: 1 } as any);
    render(<EmployeesPage />);
    await screen.findByRole('row', { name: 'Meera Iyer' });
    fireEvent.click(screen.getByRole('tab', { name: /can't sign in/i }));
    await waitFor(() => expect(lastCall()[4]).toMatchObject({ isActive: false }));
    expect(lastCall()[3]).toBeUndefined();
  });

  it('applies a filter chip, labels it, and clears it with Clear all', async () => {
    api.getEmployees.mockResolvedValue({ results: [meera], count: 1 } as any);
    render(<EmployeesPage />);
    await screen.findByRole('row', { name: 'Meera Iyer' });
    fireEvent.click(screen.getByRole('button', { name: '+ Device controls' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /device controls filter/i })).getByLabelText('No'));
    await waitFor(() => expect(lastCall()[4]).toMatchObject({ deviceOps: false }));
    expect(screen.getByRole('button', { name: 'Device controls: No' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    await waitFor(() => expect(lastCall()[4].deviceOps).toBeUndefined());
  });

  it('shows "No one matches" with a way out when filters leave nobody', async () => {
    api.getEmployees.mockResolvedValue({ results: [], count: 0 } as any);
    render(<EmployeesPage />);
    fireEvent.change(screen.getByRole('searchbox', { name: /search people/i }), { target: { value: 'zzz' } });
    expect(await screen.findByText('No one matches', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('loads page 1 again after removing the only person on page 2', async () => {
    // 26 people at 25 per page: page 2 holds just Meera.
    api.getEmployees.mockImplementation(async (_s: any, page: any) =>
      (page === 2 ? { results: [meera], count: 26 } : { results: [priya], count: 26 }) as any);
    api.deleteEmployee.mockResolvedValue(undefined as any);
    render(<EmployeesPage />);
    await screen.findByRole('row', { name: 'Priya Raman' });
    await new Promise((r) => setTimeout(r, 350)); // let the search debounce settle first
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByRole('row', { name: 'Meera Iyer' });

    api.getEmployees.mockImplementation(async (_s: any, page: any) =>
      (page === 2 ? { results: [], count: 25 } : { results: [priya], count: 25 }) as any);
    openMenuFor('Meera Iyer');
    fireEvent.click(await screen.findByRole('menuitem', { name: /remove/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^remove$/i }));

    await waitFor(() => expect(api.deleteEmployee).toHaveBeenCalledWith(5));
    await waitFor(() => expect(screen.getByRole('row', { name: 'Priya Raman' })).toBeInTheDocument());
    expect(screen.getByText(/showing 1 to 25 of 25 people/i)).toBeInTheDocument();
  });

  it('sends the real role, the address and no team_id when turning sign-in off', async () => {
    api.getEmployees.mockResolvedValue({ results: [priya, meera], count: 2 } as any);
    api.updateEmployee.mockResolvedValue({} as any);
    render(<EmployeesPage />);
    await screen.findByRole('row', { name: 'Meera Iyer' });
    openMenuFor('Meera Iyer');
    fireEvent.click(await screen.findByRole('menuitem', { name: /turn off sign-in/i }));

    await waitFor(() => expect(api.updateEmployee).toHaveBeenCalled());
    const [id, payload] = api.updateEmployee.mock.calls[0] as [number, Record<string, unknown>];
    expect(id).toBe(5);
    expect(payload).toMatchObject({ role: 'employee', address: '12 Main St', is_active: false, email: 'Meera@Example.com' });
    expect('team_id' in payload).toBe(false);
  });

  it('has no row menu on your own row', async () => {
    api.getEmployees.mockResolvedValue({ results: [priya, meera], count: 2 } as any);
    render(<EmployeesPage />);
    await screen.findByRole('row', { name: 'Meera Iyer' });
    expect(screen.queryByRole('button', { name: 'More actions for Priya Raman' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for Meera Iyer' })).toBeInTheDocument();
  });

  it('opens the person popup when a row is clicked, and Compare roles from the header', async () => {
    api.getEmployees.mockResolvedValue({ results: [meera], count: 1 } as any);
    render(<EmployeesPage />);
    fireEvent.click(await screen.findByRole('row', { name: 'Meera Iyer' }));
    expect(screen.getByRole('dialog', { name: 'Access for Meera Iyer' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Compare roles' })[0]);
    expect(screen.getByRole('dialog', { name: 'Compare roles' })).toBeInTheDocument();
  });
});
