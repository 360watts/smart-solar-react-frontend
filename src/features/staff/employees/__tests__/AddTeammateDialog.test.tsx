import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddTeammateDialog } from '../AddTeammateDialog';
import { apiService } from '../../../../services/api';

jest.mock('../../../../services/api', () => ({
  apiService: { createEmployee: jest.fn(), createTeam: jest.fn() },
}));

const sites = [{ site_id: 'a', display_name: 'Coimbatore 02' }, { site_id: 'b', display_name: 'Erode 01' }];
const teams = [{ id: 1, name: 'Operations' }];

const setup = (props: Partial<React.ComponentProps<typeof AddTeammateDialog>> = {}) => {
  const handlers = { onClose: jest.fn(), onCreated: jest.fn(), onTeamAdded: jest.fn() };
  render(<AddTeammateDialog isDark={false} sites={sites} teams={teams} {...handlers} {...props} />);
  return handlers;
};
const fill = () => {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Meera' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Iyer' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Meera@Example.com' } });
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '+91 90000 00002' } });
};

beforeEach(() => jest.clearAllMocks());

describe('AddTeammateDialog', () => {
  it('preselects Employee and hides the site picker', () => {
    setup();
    expect(screen.getByRole('radio', { name: /employee/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/which sites can/i)).toBeNull();
  });

  it('shows the site picker for Viewer and needs one site before sending', () => {
    setup();
    fill();
    fireEvent.click(screen.getByRole('radio', { name: /viewer/i }));
    expect(screen.getByText(/which sites can meera work on/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send invite/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /erode 01/i }));
    expect(screen.getByRole('button', { name: /send invite/i })).toBeEnabled();
  });

  it('warns when making an admin', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: /admin/i }));
    expect(screen.getByText(/admins can see billing and customer details/i)).toBeInTheDocument();
  });

  it('creates the account with role, sites and team', async () => {
    (apiService.createEmployee as jest.Mock).mockResolvedValue({ id: 9 });
    const { onCreated } = setup();
    fill();
    fireEvent.click(screen.getByRole('radio', { name: /viewer/i }));
    fireEvent.click(screen.getByRole('button', { name: /erode 01/i }));
    // The <select>'s label text also contains its option names, so match the start of it.
    fireEvent.change(screen.getByLabelText(/^team/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => expect(apiService.createEmployee).toHaveBeenCalled());
    expect((apiService.createEmployee as jest.Mock).mock.calls[0][0]).toMatchObject({
      email: 'meera@example.com', role: 'viewer', assigned_sites: ['b'], team_id: 1,
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('Meera', 'meera@example.com'));
  });

  it('omits team_id when no team is chosen', async () => {
    (apiService.createEmployee as jest.Mock).mockResolvedValue({ id: 9 });
    setup();
    fill();
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => expect(apiService.createEmployee).toHaveBeenCalled());
    expect('team_id' in (apiService.createEmployee as jest.Mock).mock.calls[0][0]).toBe(false);
  });

  it('adds a team inline and selects it', async () => {
    (apiService.createTeam as jest.Mock).mockResolvedValue({ id: 7, name: 'Partners' });
    const { onTeamAdded } = setup();
    fireEvent.click(screen.getByRole('button', { name: /add a team/i }));
    fireEvent.change(screen.getByLabelText('New team name'), { target: { value: 'Partners' } });
    fireEvent.click(screen.getByRole('button', { name: /^add team$/i }));
    await waitFor(() => expect(apiService.createTeam).toHaveBeenCalledWith({ name: 'Partners' }));
    await waitFor(() => expect(onTeamAdded).toHaveBeenCalledWith({ id: 7, name: 'Partners' }));
  });

  it('maps a duplicate-email failure to a plain sentence', async () => {
    (apiService.createEmployee as jest.Mock).mockRejectedValue(new Error('Email already registered. Please use a different email.'));
    setup();
    fill();
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(await screen.findByText('That email already has an account.')).toBeInTheDocument();
  });
});
