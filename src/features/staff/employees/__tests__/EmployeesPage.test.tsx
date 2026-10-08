import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    getEmployees: jest.fn(), getEmployeeRoleCounts: jest.fn(), getSitesList: jest.fn(), getTeams: jest.fn(),
    deleteEmployee: jest.fn(), updateEmployee: jest.fn(),
  },
}));

const api = apiService as jest.Mocked<typeof apiService>;
const priya: Person = { id: 1, email: 'Priya@Example.com', first_name: 'Priya', last_name: 'Raman', role: 'admin', is_active: true };
const meera: Person = {
  id: 5, email: 'Meera@Example.com', first_name: 'Meera', last_name: 'Iyer', role: 'employee',
  address: '12 Main St', is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  api.getEmployeeRoleCounts.mockResolvedValue({ all: 26, admin: 1, employee: 25, viewer: 0 } as any);
  api.getSitesList.mockResolvedValue([] as any);
  api.getTeams.mockResolvedValue({ results: [] } as any);
});

const openMenuFor = (name: string) => fireEvent.click(screen.getByRole('button', { name: `More actions for ${name}` }));

describe('EmployeesPage', () => {
  it('renders a row per person from the list', async () => {
    api.getEmployees.mockResolvedValue({ results: [priya, meera], count: 2 } as any);
    render(<EmployeesPage />);
    expect(await screen.findByRole('button', { name: 'Meera Iyer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Priya Raman' })).toBeInTheDocument();
  });

  it('loads page 1 again after removing the only person on page 2', async () => {
    // 26 people at 25 per page: page 2 holds just Meera.
    api.getEmployees.mockImplementation(async (_s: any, page: any) =>
      (page === 2 ? { results: [meera], count: 26 } : { results: [priya], count: 26 }) as any);
    api.deleteEmployee.mockResolvedValue(undefined as any);
    render(<EmployeesPage />);
    await screen.findByRole('button', { name: 'Priya Raman' });
    // The search box resets to page 1 once after its 300 ms debounce on mount; let that pass first.
    await new Promise((r) => setTimeout(r, 350));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByRole('button', { name: 'Meera Iyer' });

    // After the delete the backend only has 25 people left.
    api.getEmployees.mockImplementation(async (_s: any, page: any) =>
      (page === 2 ? { results: [], count: 25 } : { results: [priya], count: 25 }) as any);
    openMenuFor('Meera Iyer');
    fireEvent.click(await screen.findByRole('menuitem', { name: /remove/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^remove$/i }));

    await waitFor(() => expect(api.deleteEmployee).toHaveBeenCalledWith(5));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Priya Raman' })).toBeInTheDocument());
    expect(screen.getByText(/showing 1–25 of 25 people/i)).toBeInTheDocument();
  });

  it('sends the real role, the address and no team_id when turning sign-in off', async () => {
    api.getEmployees.mockResolvedValue({ results: [priya, meera], count: 2 } as any);
    api.updateEmployee.mockResolvedValue({} as any);
    render(<EmployeesPage />);
    await screen.findByRole('button', { name: 'Meera Iyer' });
    openMenuFor('Meera Iyer');
    fireEvent.click(await screen.findByRole('menuitem', { name: /turn off sign-in/i }));

    await waitFor(() => expect(api.updateEmployee).toHaveBeenCalled());
    const [id, payload] = api.updateEmployee.mock.calls[0] as [number, Record<string, unknown>];
    expect(id).toBe(5);
    expect(payload).toMatchObject({ role: 'employee', address: '12 Main St', is_active: false, email: 'Meera@Example.com' });
    expect('team_id' in payload).toBe(false);
  });
});
