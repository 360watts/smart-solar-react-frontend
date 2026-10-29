import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ui';

describe('ConfirmDialog confirmDisabled', () => {
  it('disables the confirm button and blocks the click', () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog isDark={false} open title="T" confirmLabel="Go" confirmDisabled onConfirm={onConfirm} onCancel={() => {}} />);
    const b = screen.getByRole('button', { name: 'Go' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
