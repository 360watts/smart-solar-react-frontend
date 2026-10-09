import React from 'react';
import { render, screen } from '@testing-library/react';
import HealthBand from './HealthBand';

const base = { devicesOnline: 3, devicesTotal: 3, pvKw: 5, inverterKw: 5, latitude: 11.0, longitude: 76.9, timezone: 'Asia/Kolkata', isActive: true, alertCount: 0, hasCritical: false, onToggleAlerts: () => {}, equipmentHealth: 90, isDark: true };

it('all good', () => {
  render(<HealthBand {...base} />);
  expect(screen.queryByText('Online')).not.toBeNull();
  expect(screen.queryByText('No active alerts')).not.toBeNull();
  expect(screen.queryByText('3 / 3 online')).not.toBeNull();
  // no alerts -> no alerts button (scenario 14: nothing to open)
  expect(screen.queryByRole('button')).toBeNull();
});
it('partly online', () => {
  render(<HealthBand {...base} devicesOnline={1} />);
  expect(screen.queryByText('Partly online')).not.toBeNull();
});
it('offline', () => {
  render(<HealthBand {...base} devicesOnline={0} />);
  expect(screen.queryByText('Offline')).not.toBeNull();
});
it('alerts button', () => {
  const onToggle = jest.fn();
  render(<HealthBand {...base} alertCount={2} hasCritical onToggleAlerts={onToggle} />);
  const btn = screen.getByRole('button', { name: /2 open alerts/i });
  btn.click();
  expect(onToggle).toHaveBeenCalledTimes(1);
  // amber-not-red colour can't be asserted: jsdom drops var(--x) colours. Visual check only.
});
it('one alert is singular', () => {
  render(<HealthBand {...base} alertCount={1} />);
  expect(screen.queryByRole('button', { name: /^1 open alert$/i })).not.toBeNull();
});
it('missing inverter capacity shows a dash', () => {
  render(<HealthBand {...base} inverterKw={null} />);
  expect(screen.queryByText('—')).not.toBeNull();
});
// docs/test-scenarios/dashboard-redesign.md rows 46-47
it('shows the equipment health score', () => {
  render(<HealthBand {...base} />);
  expect(screen.queryByText('Equipment health')).not.toBeNull();
  expect(screen.queryByText('90%')).not.toBeNull();
});
it('unknown equipment health shows a dash', () => {
  render(<HealthBand {...base} equipmentHealth={null} />);
  expect(screen.queryByText('Equipment health')).not.toBeNull();
  expect(screen.queryByText('—')).not.toBeNull();
});
it('inactive site shows a pill', () => {
  render(<HealthBand {...base} isActive={false} />);
  expect(screen.queryByText('Inactive')).not.toBeNull();
});
