import React from 'react';
import { render, screen } from '@testing-library/react';
import EnergyBreakdownRow from './EnergyBreakdownRow';
import InsightsRow from './InsightsRow';

// docs/test-scenarios/dashboard-redesign.md rows 61-64
const latest = { grid_buy_today_kwh: 2.5, grid_sell_today_kwh: 0.4, batt_charge_today_kwh: 1.2, batt_discharge_today_kwh: 0.9, load_today_kwh: 10, pv_today_kwh: 8 };

it('energy chips render values; dots only on grid and battery', () => {
  const { container } = render(<EnergyBreakdownRow latest={latest} isLatestToday />);
  expect(screen.getByText('2.50')).toBeTruthy();
  expect(screen.getByText('400')).toBeTruthy(); // 0.4 kWh as Wh
  expect(container.querySelectorAll('[data-energy-chip]').length).toBe(5);
  expect(container.querySelectorAll('[data-energy-dot]').length).toBe(4);
  expect(container.innerHTML).not.toMatch(/gradient|box-shadow|#8b5cf6|#ec4899/i);
});

it('insights render values with no accent colours or dots', () => {
  const { container } = render(<InsightsRow latest={latest} isLatestToday />);
  expect(screen.getByText('6.56 kg')).toBeTruthy();
  expect(screen.getByText('79%')).toBeTruthy(); // self-sufficiency
  expect(screen.getByText('21%')).toBeTruthy(); // grid dependency (2.5-0.4)/10
  expect(container.querySelectorAll('[data-insight-tile]').length).toBe(3);
  expect(container.innerHTML).not.toMatch(/gradient|box-shadow|#0F9F8F|#f59e0b|#ef4444/i);
});

it('hide when not today', () => {
  expect(render(<EnergyBreakdownRow latest={latest} isLatestToday={false} />).container.innerHTML).toBe('');
  expect(render(<InsightsRow latest={latest} isLatestToday={false} />).container.innerHTML).toBe('');
});
