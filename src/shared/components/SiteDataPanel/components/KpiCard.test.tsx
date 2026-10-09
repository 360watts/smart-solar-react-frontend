import React from 'react';
import { render, screen } from '@testing-library/react';
import KpiCard from './KpiCard';

// docs/test-scenarios/dashboard-redesign.md rows 53, 54, 56
it('renders label, value, unit and sub-line without a dot by default', () => {
  const { container } = render(<KpiCard label="Load" value="1.2" unit="kW" sub="3 kWh today" />);
  expect(screen.getByText('Load')).toBeTruthy();
  expect(screen.getByText('3 kWh today')).toBeTruthy();
  expect(container.querySelector('[data-kpi-dot]')).toBeNull();
  expect(container.querySelector('[data-kpi-tile]')).not.toBeNull();
});

it('shows the colour dot and badge when given, and no sub-line when absent', () => {
  const { container } = render(<KpiCard label="Solar PV" value="2" dot="#f5b942" badge={<span>Stale</span>} />);
  expect(container.querySelector('[data-kpi-dot]')).not.toBeNull();
  expect(screen.getByText('Stale')).toBeTruthy();
  expect(container.querySelectorAll('[data-kpi-tile] > div').length).toBe(3); // label row, value, badge
});
