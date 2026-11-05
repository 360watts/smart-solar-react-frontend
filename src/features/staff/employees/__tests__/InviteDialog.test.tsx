import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InviteDialog } from '../InviteDialog';
import { apiService } from '../../../../services/api';

jest.mock('../../../../services/api', () => ({ apiService: { createEmployee: jest.fn() } }));
const api = apiService as jest.Mocked<typeof apiService>;

const props = (over: Partial<React.ComponentProps<typeof InviteDialog>> = {}) => ({
  isDark: false, sites: [{ site_id: 'coim_002', display_name: 'Coimbatore home' }], devices: [{ site_id: '7', display_name: 'EM-1234 (coim_002)' }],
  teams: [{ id: 3, name: 'Field team' }], onClose: jest.fn(), onCreated: jest.fn(),
  onCreateTeam: jest.fn(async (name: string) => ({ id: 9, name })), onCompareRoles: jest.fn(), ...over,
});
const fill = () => {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Arun' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Mani' } });
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'Arun@Example.in' } });
  fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '98400 12345' } });
};

beforeEach(() => { jest.clearAllMocks(); api.createEmployee.mockResolvedValue({} as any); });

describe('InviteDialog', () => {
  it('says what is missing, then what will happen', () => {
    render(<InviteDialog {...props()} />);
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeDisabled();
    expect(screen.getByText('Add a first and last name.')).toBeInTheDocument();
    fill();
    expect(screen.getByText('Arun gets a welcome email with sign-in details.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeEnabled();
  });

  it('sends +91 and the digits, and the email in lower case', async () => {
    const p = props();
    render(<InviteDialog {...p} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    await waitFor(() => expect(api.createEmployee).toHaveBeenCalled());
    expect(api.createEmployee.mock.calls[0][0]).toMatchObject({ mobile_number: '+919840012345', email: 'arun@example.in', role: 'employee' });
    await waitFor(() => expect(p.onCreated).toHaveBeenCalledWith('Arun', 'arun@example.in'));
  });

  it('a viewer needs a site or a device; picks show as chips', () => {
    render(<InviteDialog {...props()} />);
    fill();
    fireEvent.click(screen.getByRole('radio', { name: /viewer/i }));
    expect(screen.getByText(/pick at least one site or device/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /single devices/i }));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Remove EM-1234 (coim_002) (device)' })).toBeInTheDocument();
    expect(screen.getByText('Arun gets a welcome email with sign-in details, and will see 1 device.')).toBeInTheDocument();
  });

  it('creates a team from the Team box and picks it', async () => {
    const p = props();
    render(<InviteDialog {...p} />);
    const team = screen.getByRole('combobox');
    fireEvent.focus(team);
    fireEvent.change(team, { target: { value: 'Night shift' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Create team “Night shift”' }));
    await waitFor(() => expect(p.onCreateTeam).toHaveBeenCalledWith('Night shift'));
  });

  it('opens Compare roles from the Access section', () => {
    const p = props();
    render(<InviteDialog {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Compare roles' }));
    expect(p.onCompareRoles).toHaveBeenCalled();
  });
});
