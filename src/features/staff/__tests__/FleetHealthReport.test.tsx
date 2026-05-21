import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Alerts from '../../features/staff/Alerts';
import { apiService } from '../../services/api';

// Mock the API service
jest.mock('../../services/api');
jest.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));
jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Mock child components
jest.mock('../mobile', () => ({
  MobileAlerts: () => <div>Mobile Alerts</div>,
}));
jest.mock('../AuditTrail', () => () => <div>Audit Trail</div>);
jest.mock('../PageHeader', () => (props: any) => <div>{props.title}</div>);
jest.mock('../EmptyState', () => () => <div>Empty State</div>);
jest.mock('../SkeletonLoader', () => () => <div>Loading...</div>);

const mockFleetHealthReport = {
  id: 42,
  report_date: '2026-04-27',
  generated_at: '2026-04-27T10:00:45.123Z',
  last_accessed_at: '2026-04-28T04:15:30.456Z',
  data: {
    report_date: '2026-04-27',
    window_start: '2026-04-27T00:00:00+05:30',
    window_end: '2026-04-27T23:59:59.999+05:30',
    fleet_summary: {
      total_alerts: 15,
      critical_alerts: 2,
      warning_alerts: 8,
      unresolved_alerts: 5,
      auto_reboots: 1,
      device_offline_events: 1,
      rs485_stale_events: 3,
      complete_failures: 0,
    },
    devices: {
      'SERIAL_001': {
        site_id: 'site_001',
        is_online: true,
        last_heartbeat: '2026-04-27T14:32:45+05:30',
        rs485_stale_count: 0,
        alerts: {
          total: 2,
          by_fault_code: { device_offline: 1, rs485_stale: 1 },
        },
        telemetry: {
          record_count: 5760,
          data_completeness_pct: 100.0,
          largest_gap_minutes: 5.2,
          earliest: '2026-04-27T00:00:15+05:30',
          latest: '2026-04-27T23:59:45+05:30',
        },
      },
      'SERIAL_002': {
        site_id: 'site_001',
        is_online: false,
        last_heartbeat: '2026-04-27T10:00:00+05:30',
        rs485_stale_count: 2,
        alerts: {
          total: 3,
          by_fault_code: { rs485_stale: 2, device_offline: 1 },
        },
        telemetry: {
          record_count: 4200,
          data_completeness_pct: 95.2,
          largest_gap_minutes: 15.3,
          earliest: '2026-04-27T00:05:10+05:30',
          latest: '2026-04-27T18:30:45+05:30',
        },
      },
      'SERIAL_003': {
        site_id: 'site_002',
        is_online: true,
        last_heartbeat: '2026-04-27T23:50:30+05:30',
        rs485_stale_count: 0,
        alerts: {
          total: 0,
          by_fault_code: {},
        },
        telemetry: {
          record_count: 5760,
          data_completeness_pct: 100.0,
          largest_gap_minutes: 0.0,
          earliest: '2026-04-27T00:00:00+05:30',
          latest: '2026-04-27T23:59:59+05:30',
        },
      },
    },
    issues: [
      '⚫ site_001: device offline (last heartbeat 2026-04-27T14:32:45)',
      '🟡 site_001: RS-485 stale count = 2',
    ],
  },
};

describe('Fleet Health Report Tab', () => {
  beforeEach(() => {
    (apiService.getAlerts as jest.Mock).mockResolvedValue([]);
    (apiService.getAlertsAnalytics as jest.Mock).mockResolvedValue({
      lookback_days: 90,
      fault_summaries: [],
      timeline: [],
      recent_instances: {},
      rule_catalogue: [],
    });
    (apiService.getFleetHealthReport as jest.Mock).mockResolvedValue(mockFleetHealthReport);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders Fleet Health tab in tab bar', async () => {
    render(<Alerts />);
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      expect(fleetHealthTab).toBeInTheDocument();
    });
  });

  test('loads and displays fleet health report when tab is clicked', async () => {
    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      // Check for summary cards
      expect(screen.getByText('Health Status')).toBeInTheDocument();
      expect(screen.getByText('Total Alerts')).toBeInTheDocument();
      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    // Verify API was called
    expect(apiService.getFleetHealthReport).toHaveBeenCalled();
  });

  test('displays correct health status indicator', async () => {
    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      // With 2 critical alerts, should show red status
      const healthStatusValue = screen.getByText('🔴 Critical');
      expect(healthStatusValue).toBeInTheDocument();
    });
  });

  test('displays fleet summary metrics', async () => {
    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      // Check summary values
      const cards = screen.getAllByText(/^\d+$/);
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  test('displays site breakdown table with expandable rows', async () => {
    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      // Check for Site Breakdown header
      expect(screen.getByText('Site Breakdown')).toBeInTheDocument();
      
      // Check for site IDs
      expect(screen.getByText('site_001')).toBeInTheDocument();
      expect(screen.getByText('site_002')).toBeInTheDocument();
    });
  });

  test('displays issues when present', async () => {
    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      expect(screen.getByText('Issues Detected')).toBeInTheDocument();
    });
  });

  test('displays error message when API call fails', async () => {
    (apiService.getFleetHealthReport as jest.Mock).mockRejectedValueOnce(
      new Error('Failed to load report')
    );

    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Error loading fleet health/)).toBeInTheDocument();
    });
  });

  test('displays report metadata', async () => {
    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      expect(screen.getByText(/Report Date:/)).toBeInTheDocument();
      expect(screen.getByText(/Generated:/)).toBeInTheDocument();
    });
  });

  test('displays data completeness percentage', async () => {
    render(<Alerts />);
    
    await waitFor(() => {
      const fleetHealthTab = screen.getByText('Fleet Health');
      fireEvent.click(fleetHealthTab);
    });

    await waitFor(() => {
      // Should show 100.0% or 95.2% depending on site
      expect(screen.getByText(/100.0%/)).toBeInTheDocument();
    });
  });
});
