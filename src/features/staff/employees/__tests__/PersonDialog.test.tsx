import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonDialog, changeCount } from '../PersonDialog';
import { apiService } from '../../../../services/api';
import { Person, formFromPerson } from '../roles';

jest.mock('../../../../services/api', () => ({
  apiService: { updateEmployee: jest.fn(), getEmployeeOperations: jest.fn() },
}));
const api = apiService as jest.Mocked<typeof apiService>;

const meera: Person = {
  id: 5, email: 'meera@example.com', first_name: 'Meera', last_name: 'Iyer', role: 'employee', mobile_number: '+91-9840012345',
  address: '12 Main St', is_active: true, employment_status: 'active', device_ops_enabled: true,
};
const props = (over: Partial<React.ComponentProps<typeof PersonDialog>> = {}) => ({
  isDark: false, person: meera, sites: [{ site_id: 'coim_002', display_name: 'Coimbatore home' }], devices: [], teams: [{ id: 3, name: 'Field team' }],
  isSelf: false, onClose: jest.fn(), onSaved: jest.fn(), onToggleActive: jest.fn(), onRemove: jest.fn(),
  onCreateTeam: jest.fn(), onCompareRoles: jest.fn(), ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  api.updateEmployee.mockResolvedValue({} as any);
  api.getEmployeeOperations.mockResolvedValue({ days: 30, rows: [] } as any);
});

describe('PersonDialog', () => {
  it('keeps Save off until something changes, then counts the changes', () => {
    render(<PersonDialog {...props()} />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByText('No changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Viewer' }));
    expect(screen.getByText(/pick at least one site/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('coim_002 · Coimbatore home'.split(' · ')[0], { exact: false }));
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('saves the whole record with the new role and sites', async () => {
    const p = props();
    render(<PersonDialog {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Viewer' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateEmployee).toHaveBeenCalled());
    expect(api.updateEmployee.mock.calls[0][1]).toMatchObject({
      role: 'viewer', assigned_sites: ['coim_002'], first_name: 'Meera', email: 'meera@example.com', address: '12 Main St', team_id: null,
    });
    await waitFor(() => expect(p.onSaved).toHaveBeenCalledWith('Saved. Meera now sees 1 site.'));
  });

  it('asks before making someone an admin', async () => {
    render(<PersonDialog {...props()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(api.updateEmployee).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Make admin' }));
    await waitFor(() => expect(api.updateEmployee.mock.calls[0][1]).toMatchObject({ role: 'admin' }));
  });

  it('turns sign-in off when Employment is set to Left', async () => {
    render(<PersonDialog {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Contact details' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Left' }));
    expect(screen.getByText('Sign-in turns off when you save.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateEmployee.mock.calls[0][1]).toMatchObject({ employment_status: 'terminated', is_active: false }));
  });

  it('warns that a changed email is also the sign-in', () => {
    render(<PersonDialog {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Contact details' }));
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'meera.i@example.com' } });
    expect(screen.getByText(/meera will sign in with the new one/i)).toBeInTheDocument();
  });

  it('shows the stored mobile as 10 digits behind +91 and flags a short one', () => {
    render(<PersonDialog {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Contact details' }));
    const mobile = screen.getByLabelText('Mobile') as HTMLInputElement;
    expect(mobile.value).toBe('9840012345');
    fireEvent.change(mobile, { target: { value: '98400' } });
    fireEvent.blur(mobile);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter all 10 digits');
  });

  it('asks before closing with unsaved changes', () => {
    const p = props();
    render(<PersonDialog {...p} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Viewer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(p.onClose).not.toHaveBeenCalled();
    // Footer has its own Discard; the confirm dialog's is the danger one.
    const confirm = screen.getAllByRole('button', { name: 'Discard' }).find((b) => b.className.includes('danger'))!;
    fireEvent.click(confirm);
    expect(p.onClose).toHaveBeenCalled();
  });

  it('on your own record: role locked, no sign-in or Remove buttons', () => {
    render(<PersonDialog {...props({ isSelf: true })} />);
    expect(screen.getByRole('radio', { name: 'Admin' })).toBeDisabled();
    expect(screen.getByText("You can't change your own role.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /turn off sign-in/i })).not.toBeInTheDocument();
  });

  it('lists device activity in plain words', async () => {
    api.getEmployeeOperations.mockResolvedValue({ days: 30, rows: [
      { at: new Date().toISOString(), op: 'reboot', action: 'reboot', device_id: 1, serial: 'GW-0001', site_id: 'coim_002', values: {} },
    ] } as any);
    render(<PersonDialog {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Device activity' }));
    expect(await screen.findByText('Restarted')).toBeInTheDocument();
    expect(api.getEmployeeOperations).toHaveBeenCalledWith(5, 30);
  });
});

describe('changeCount', () => {
  it('ignores how the mobile was stored and the order of sites', () => {
    const a = formFromPerson({ ...meera, assigned_sites: ['a', 'b'] });
    expect(changeCount(a, { ...a, mobile_number: '+919840012345', assigned_sites: ['b', 'a'] })).toBe(0);
    expect(changeCount(a, { ...a, first_name: 'M' })).toBe(1);
  });
});
