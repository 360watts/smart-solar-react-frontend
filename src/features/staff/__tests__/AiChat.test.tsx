import React from 'react';
import { render, screen } from '@testing-library/react';
import AiChat from '../AiChat';

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('../../../shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

describe('AiChat', () => {
  test('renders an icon-only closed chat trigger', () => {
    render(<AiChat />);

    expect(screen.getByLabelText('Open Fleet AI')).toBeInTheDocument();
    expect(screen.queryByText('Fleet AI')).not.toBeInTheDocument();
  });
});
