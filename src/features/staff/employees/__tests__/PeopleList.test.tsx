import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PeopleList } from '../PeopleList';
import { Person } from '../roles';

jest.mock('../../../../shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

const people: Person[] = [
  { id: 1, email: 'priya@example.com', first_name: 'Priya', last_name: 'Raman', role: 'admin', is_active: true, team: { id: 1, name: 'Operations' } },
  { id: 5, email: 'meera@example.com', first_name: 'Meera', last_name: 'Iyer', role: 'viewer', assigned_sites: ['a', 'b'], is_active: true, team: { id: 2, name: 'Partners' } },
  { id: 7, email: 'sana@example.com', first_name: 'Sana', last_name: 'Fatima', role: 'employee', is_active: false },
];

const base = {
  isDark: false, people, siteNames: { a: 'Coimbatore 02', b: 'Erode 01' }, loading: false, error: null as string | null,
  onRetry: jest.fn(), tab: 'all' as const, onTab: jest.fn(),
  counts: { all: 3, admin: 1, employee: 1, viewer: 1 },
  search: '', onSearch: jest.fn(), page: 1, pageSize: 25, total: 3, onPage: jest.fn(),
  currentUserId: 1, onOpen: jest.fn(), onToggleActive: jest.fn(), onRemove: jest.fn(), onAdd: jest.fn(),
};

describe('PeopleList', () => {
  it('shows tabs with counts, sites for viewers and a calm Inactive chip', () => {
    render(<PeopleList {...base} />);
    expect(screen.getByRole('tab', { name: /viewers 1/i })).toBeInTheDocument();
    expect(screen.getByText('2 sites')).toBeInTheDocument();
    expect(screen.getByText('Coimbatore 02, Erode 01')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText(/showing 1–3 of 3 people/i)).toBeInTheDocument();
  });

  it('opens a person and changes tab', () => {
    render(<PeopleList {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /^meera iyer$/i }));
    expect(base.onOpen).toHaveBeenCalledWith(people[1]);
    fireEvent.click(screen.getByRole('tab', { name: /admins/i }));
    expect(base.onTab).toHaveBeenCalledWith('admin');
  });

  it("hides Turn off and Remove on the signed-in user's own row", () => {
    render(<PeopleList {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /more actions for priya/i }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Edit access')).toBeInTheDocument();
    expect(within(menu).queryByText(/turn off sign-in/i)).toBeNull();
    expect(within(menu).queryByText('Remove')).toBeNull();
  });

  it('offers Turn on sign-in for an inactive person', () => {
    render(<PeopleList {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /more actions for sana/i }));
    fireEvent.click(screen.getByText(/turn on sign-in/i));
    expect(base.onToggleActive).toHaveBeenCalledWith(people[2]);
  });

  it('has a friendly empty state for the viewers tab', () => {
    const onAdd = jest.fn();
    render(<PeopleList {...base} people={[]} total={0} tab="viewer" counts={{ all: 3, admin: 1, employee: 2, viewer: 0 }} onAdd={onAdd} />);
    expect(screen.getByText('No viewers yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add a viewer/i }));
    expect(onAdd).toHaveBeenCalledWith('viewer');
  });

  it('shows a retry card on error', () => {
    render(<PeopleList {...base} people={[]} error="boom" />);
    expect(screen.queryByText('boom')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(base.onRetry).toHaveBeenCalled();
  });
});
