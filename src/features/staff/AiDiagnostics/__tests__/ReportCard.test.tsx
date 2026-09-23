import '@testing-library/jest-dom';
// ^ Not wired up repo-wide (no jest.config.js setupFiles) despite being a dependency - even
// AiChat.test.tsx's existing toBeInTheDocument() calls would hit the same failure if run. Scoped
// fix here only, not touching shared jest config for this prototype's sake.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportCard } from '../ReportCard';
import { EventListView } from '../EventListView';
import type { DiagnosticReport, UnderperformanceEvent } from '../types';

jest.mock('../../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Hand-written fixture, not live-wired - verifies layout/citations logic independent of the
// backend (per the plan's step 12: static rendering before wiring the real API in step 13).
const FIXTURE: DiagnosticReport = {
  headline: 'Site h_0011 — underperformance detected',
  likely_component: null,
  site_id: 'h_0011',
  ts_start: '2024-11-12T07:00:00',
  ts_end: '2024-11-12T08:00:00',
  severity: 'high',
  metric_summary: 'Average deficit of 86.7%.',
  root_cause_text: 'Matches a known RS-485 caching fault [1], grid connection issue less likely [2].',
  citations: [
    { index: 1, source: 'fault_log_history', ref: 'F-001', text: 'RS-485 register caching bug detail.' },
    { index: 2, source: 'fault_log_history', ref: 'F-H002', text: 'RS-485 gateway failure detail.' },
  ],
  recommended_action: 'Inspect the RS-485 gateway and physical wiring at h_0011.',
  confidence: 0.35,
};

describe('ReportCard', () => {
  test('renders headline, severity, confidence, and the prototype badge', () => {
    render(<ReportCard report={FIXTURE} />);
    expect(screen.getByText(FIXTURE.headline)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('PROTOTYPE · SYNTHETIC DATA')).toBeInTheDocument();
    expect(screen.getByText(/Inspect the RS-485 gateway/)).toBeInTheDocument();
  });

  test('renders valid citation markers as clickable buttons showing the right evidence', () => {
    render(<ReportCard report={FIXTURE} />);
    const marker1 = screen.getByLabelText('Show citation 1');
    expect(marker1).toBeInTheDocument();
    fireEvent.click(marker1);
    expect(screen.getByText('RS-485 register caching bug detail.')).toBeInTheDocument();
  });

  test('does not crash on an orphaned marker with no matching citation (defense in depth - the backend already strips these, this is a second layer)', () => {
    const withOrphan: DiagnosticReport = {
      ...FIXTURE,
      root_cause_text: 'No real evidence found [1] [3].', // [3] has no citation entry
      citations: [FIXTURE.citations[0]],
    };
    render(<ReportCard report={withOrphan} />);
    expect(screen.getByLabelText('Show citation 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show citation 3')).not.toBeInTheDocument();
    expect(screen.getByText(/\[3\]/)).toBeInTheDocument(); // rendered as plain, inert text
  });
});

describe('EventListView', () => {
  const EVENTS: UnderperformanceEvent[] = [
    { site_id: 'h_0011', ts_start: '2024-11-12T07:00:00', ts_end: '2024-11-12T08:00:00', avg_deficit_pct: 86.7 },
    { site_id: 'h_0015', ts_start: '2024-12-03T07:00:00', ts_end: '2024-12-03T09:00:00', avg_deficit_pct: 96.1 },
  ];

  test('groups by day by default, worst group expanded, click drills in and calls onSelect', () => {
    const onSelect = jest.fn();
    render(<EventListView events={EVENTS} loading={false} selectedIndex={null} onSelect={onSelect} />);

    // Two different days -> two collapsed day groups; only the worst (h_0015, 96.1%) starts open.
    expect(screen.getByRole('button', { name: /h_0015/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /h_0011/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /h_0015/ }));
    expect(onSelect).toHaveBeenCalledWith(EVENTS[1], 1);

    // Expand the second (collapsed) day group by its date header, then select h_0011.
    fireEvent.click(screen.getByRole('button', { name: /2024-11-12/ }));
    fireEvent.click(screen.getByRole('button', { name: /h_0011/ }));
    expect(onSelect).toHaveBeenCalledWith(EVENTS[0], 0);
  });

  test('grouping by severity puts both same-band events in one open group', () => {
    const onSelect = jest.fn();
    render(<EventListView events={EVENTS} loading={false} selectedIndex={null} onSelect={onSelect} />);

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'severity' } });

    // Both 86.7% and 96.1% fall in the HIGH band -> a single group, open by default.
    expect(screen.getByRole('button', { name: /h_0011/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /h_0015/ })).toBeInTheDocument();
    expect(screen.getByText('−87%')).toBeInTheDocument();
  });

  test('shows an empty state with zero events, not a blank screen', () => {
    render(<EventListView events={[]} loading={false} selectedIndex={null} onSelect={jest.fn()} />);
    expect(screen.getByText(/NO EVENTS IN THIS WINDOW/)).toBeInTheDocument();
  });
});
