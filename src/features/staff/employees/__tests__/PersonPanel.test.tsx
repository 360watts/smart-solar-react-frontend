import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PersonPanel } from '../PersonPanel';
import { apiService } from '../../../../services/api';
import { Person } from '../roles';

jest.mock('../../../../services/api', () => ({ apiService: { updateEmployee: jest.fn() } }));

const sites = [
  { site_id: 'a', display_name: 'Coimbatore 02' },
  { site_id: 'b', display_name: 'Erode 01' },
  { site_id: 'c', display_name: 'Pollachi 03' },
];
const meera: Person = {
  id: 5, email: 'meera@example.com', first_name: 'Meera', last_name: 'Iyer', mobile_number: '+91 90000 00002',
  address: '12 Main St', role: 'viewer', assigned_sites: ['a', 'b'], is_active: true, team: { id: 2, name: 'Partners' },
};
const teams = [{ id: 1, name: 'Operations' }, { id: 2, name: 'Partners' }];

const setup = (over: Partial<React.ComponentProps<typeof PersonPanel>> = {}) => {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  render(<PersonPanel isDark={false} person={meera} sites={sites} teams={teams} isSelf={false} onClose={onClose} onSaved={onSaved} {...over} />);
  return { onClose, onSaved };
};

beforeEach(() => jest.clearAllMocks());

describe('PersonPanel', () => {
  it('starts with Save disabled and the access preview using the first name', () => {
    setup();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(screen.getByText('What Meera can do')).toBeInTheDocument();
    expect(screen.getByText("What Meera can't do")).toBeInTheDocument();
  });

  it('blocks saving a viewer with no sites and says why', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /coimbatore 02/i }));
    fireEvent.click(screen.getByRole('button', { name: /erode 01/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    expect(screen.getAllByText(/won't see anything/i).length).toBeGreaterThan(0);
  });

  it('locks the role cards on your own record', () => {
    setup({ isSelf: true });
    expect(screen.getByRole('radio', { name: /admin/i })).toBeDisabled();
    expect(screen.getByText(/can't change your own role/i)).toBeInTheDocument();
  });

  it('asks before discarding edits', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: /pollachi 03/i }));
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('saves role and sites and reports the result', async () => {
    (apiService.updateEmployee as jest.Mock).mockResolvedValue({});
    const { onSaved } = setup();
    fireEvent.click(screen.getByRole('button', { name: /pollachi 03/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(apiService.updateEmployee).toHaveBeenCalled());
    const [id, payload] = (apiService.updateEmployee as jest.Mock).mock.calls[0];
    expect(id).toBe(5);
    expect(payload).toMatchObject({ role: 'viewer', assigned_sites: ['a', 'b', 'c'], address: '12 Main St', team_id: 2 });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Saved. Meera now sees 3 sites.'));
  });

  it('sends team_id null when the team is cleared', async () => {
    (apiService.updateEmployee as jest.Mock).mockResolvedValue({});
    setup();
    fireEvent.click(screen.getByRole('button', { name: /contact details/i }));
    fireEvent.change(screen.getByLabelText(/^team/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(apiService.updateEmployee).toHaveBeenCalled());
    const [, payload] = (apiService.updateEmployee as jest.Mock).mock.calls[0];
    expect(payload.team_id).toBeNull();
  });

  it('shows a friendly error when the save fails', async () => {
    (apiService.updateEmployee as jest.Mock).mockRejectedValue(new Error('Cannot demote the last admin'));
    setup();
    fireEvent.click(screen.getByRole('button', { name: /pollachi 03/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/at least one admin/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cannot demote the last admin/)).toBeNull();
  });

  it('tells you the site list is cleared when a viewer becomes an employee', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: /employee/i }));
    expect(screen.getByText(/site list will be cleared/i)).toBeInTheDocument();
  });
});
