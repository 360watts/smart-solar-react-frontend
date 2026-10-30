import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityList, EmptyState, Notice } from './Feedback';

const iso = (daysAgo: number, h: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, 0, 0, 0); return d.toISOString(); };

describe('Feedback', () => {
  it('FB1 ActivityList groups by day, says You for the signed-in user, and ends with the origin note', () => {
    render(<ActivityList meId={1} origin="Recording started on 29 Oct." items={[
      { at: iso(0, 10), title: 'Restart', actor: { id: 1, name: 'Nandha Kumar' } },
      { at: iso(0, 9), title: 'Update', actor: { id: 2, name: 'Rajeev Nair' } },
      { at: iso(1, 9), title: 'Calibration', actor: null },
    ]} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('You');
    expect(within(rows[1]).getByText('RN')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('Unknown');
    expect(screen.getByText('Recording started on 29 Oct.')).toBeInTheDocument();
  });

  it('FB2 EmptyState with onRetry is an alert with a working Try again', () => {
    const retry = jest.fn();
    render(<EmptyState title="Couldn't load" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('FB3 EmptyState action with `to` is a link', () => {
    render(<MemoryRouter><EmptyState title="Not yours" action={{ label: 'Go home', to: '/home' }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/home');
  });

  it('FB4 Notice shows the muted second sentence after the main one', () => {
    render(<Notice tone="lock" more="Ask an admin.">Admins only.</Notice>);
    expect(screen.getByText('Ask an admin.')).toHaveClass('fb-more');
  });
});
