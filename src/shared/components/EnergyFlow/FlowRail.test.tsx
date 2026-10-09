import { render } from '@testing-library/react';
import { Sparkline } from './FlowRail';

it('breaks the line at null hours instead of zero-filling', () => {
  const { container } = render(<Sparkline color="#3fb98a" points={[1, 2, null, null, 3, 4]} />);
  expect(container.querySelectorAll('polyline').length).toBe(2); // two runs, gap between
});

it('renders nothing with fewer than two known points', () => {
  const { container } = render(<Sparkline color="#3fb98a" points={[null, 1, null]} />);
  expect(container.querySelector('svg')).toBeNull();
});
