import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Alerts from '../Alerts';

const mockInc = { id: 7, severity: 'critical', status: 'open', title: 'Inverter offline', message: 'No data', deviceSerial: 'AAA111', siteName: 'Rao Residence', siteId: 's1', triggeredAt: new Date().toISOString(), diagnostic: { root_cause: 'Wi-Fi dropped', recommendation: 'Restart the router' } };
const mockReport = { report_date: '2026-11-02', generated_at: '2026-11-03T01:00:00Z', data: {
  fleet_summary: { total_alerts: 3, critical_alerts: 1, unresolved_alerts: 2, rs485_stale_events: 0, auto_reboots: 1 },
  issues: ['⚫ AAA111: device offline (last heartbeat 2026-10-17T10:41:18+00:00)', '⚫ AAA111: zero telemetry records on 2026-11-02'],
  devices: { AAA111: { site_id: 'Rao Residence', is_online: false, alerts: { total: 2 }, telemetry: { data_completeness_pct: 40 } } } } };
const mockAnalytics = {
  fault_summaries: [{ fault_code: 'DEV-001', alert_type: 'x', severity: 'critical', title: 'Inverter offline', reason: 'No data', total_occurrences: 5, active_count: 1, resolved_count: 4, first_seen: '', last_seen: '', avg_resolution_seconds: 3600 }],
  timeline: [{ date: '2026-11-01', faults: [{ fault_code: 'DEV-001', severity: 'critical', count: 5 }] }],
  recent_instances: { 'DEV-001': [] },
  rule_catalogue: [{ fault_code: 'DEV-001', title: 'Inverter offline', severity: 'critical', reason: 'No readings arrived', cooldown_hours: 2, fix_guidance: 'Check the Wi-Fi' }],
};
jest.mock('../../../services/api', () => ({
  apiService: new Proxy({}, { get: (_t, n) => (
    n === 'getIncidents' ? () => Promise.resolve({ results: [mockInc] }) :
    n === 'getFleetHealthReport' ? () => Promise.resolve(mockReport) :
    n === 'getAlertsAnalytics' ? () => Promise.resolve(mockAnalytics) : () => Promise.resolve([])) }),
}));
jest.mock('../../../shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
jest.mock('../../mobile/staff/MobileAlerts', () => ({ __esModule: true, default: () => null }));

it('shows triage, then fleet health, then analytics', async () => {
  render(<MemoryRouter><Alerts /></MemoryRouter>);
  expect((await screen.findAllByText('Inverter offline')).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('tab', { name: 'Fleet health' }));
  expect(await screen.findByText('Needs attention')).toBeTruthy();
  expect(screen.getByText(/1 site needs a look/)).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
  expect(await screen.findByText('What fires most')).toBeTruthy();
  expect(screen.getByText('Check the Wi-Fi')).toBeTruthy();
});
