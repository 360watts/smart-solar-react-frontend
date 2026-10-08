import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoleCards } from '../RoleCards';

describe('RoleCards', () => {
  it('marks the selected role and reports a click', () => {
    const onChange = jest.fn();
    render(<RoleCards isDark={false} value="employee" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: /employee/i })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: /viewer/i }));
    expect(onChange).toHaveBeenCalledWith('viewer');
  });

  it('moves with the arrow keys', () => {
    const onChange = jest.fn();
    render(<RoleCards isDark={false} value="employee" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: /employee/i }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('viewer');
    fireEvent.keyDown(screen.getByRole('radio', { name: /employee/i }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('admin');
  });

  it('does nothing when disabled', () => {
    const onChange = jest.fn();
    render(<RoleCards isDark={false} value="employee" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('radio', { name: /admin/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
