import React from 'react';
import { render, screen } from '@testing-library/react';
import FlowRing from './FlowRing';

// docs/test-scenarios/dashboard-redesign.md row 43: the interior holds only HOME USES + value; the caption is outside.
it('shows home use only', () => {
  render(<FlowRing shares={{ solar: 0.78, battery: 0.14, grid: 0.08 }} homeKw={0.31} isDark />);
  expect(screen.queryByText('HOME USES')).not.toBeNull();
  expect(screen.queryByText('310')).not.toBeNull();
  expect(screen.queryByText('W')).not.toBeNull();
  expect(screen.queryByText('Running mostly on sun')).toBeNull();
});

it('empty track when no shares', () => {
  const { container } = render(<FlowRing shares={null} homeKw={0} isDark />);
  expect(container.querySelectorAll('circle[data-seg]').length).toBe(0);
});

// row 51: parts line sits inside the ring box, under the value
it('shows the whole-home parts line', () => {
  render(<FlowRing shares={null} homeKw={2.92} partsText="Backup 237 W · EV 2.68 kW" isDark />);
  expect(screen.queryByText('Backup 237 W')).not.toBeNull(); // one part per line
  expect(screen.queryByText('EV 2.68 kW')).not.toBeNull();
});
