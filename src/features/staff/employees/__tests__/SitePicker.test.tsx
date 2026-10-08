import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SitePicker } from '../SitePicker';

const sites = [
  { site_id: 'a', display_name: 'Coimbatore 02' },
  { site_id: 'b', display_name: 'Erode 01' },
  { site_id: 'c', display_name: 'Pollachi 03' },
];

describe('SitePicker', () => {
  it('toggles a site on and off', () => {
    const onChange = jest.fn();
    const { rerender } = render(<SitePicker isDark={false} sites={sites} value={['a']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /erode 01/i }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: /coimbatore 02/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    rerender(<SitePicker isDark={false} sites={sites} value={['a', 'b']} onChange={onChange} />);
    expect(screen.getByText('2 of 3 chosen')).toBeInTheDocument();
  });

  it('filters by the search box', () => {
    render(<SitePicker isDark={false} sites={sites} value={[]} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/find a site/i), { target: { value: 'erode' } });
    expect(screen.getByRole('button', { name: /erode 01/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /coimbatore/i })).toBeNull();
  });

  it('says so when nothing matches', () => {
    render(<SitePicker isDark={false} sites={sites} value={[]} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/find a site/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/no sites match/i)).toBeInTheDocument();
  });
});
