import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import InverterMeasurementConfig from '../InverterMeasurementConfig';

const mockCan = jest.fn();
jest.mock('../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: mockCan }) }));
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../services/api', () => ({
  apiService: {
    getSmartDevices: jest.fn().mockResolvedValue([
      { id: 7, display_name: 'Fridge plug', appliance_label: 'fridge', latest: null },
    ]),
    getCircuitLines: jest.fn().mockResolvedValue([]),
    getSiteStaffDetail: jest.fn().mockResolvedValue({
      display_name: 'Coimbatore 02',
      gateway_device: { device_id: 1, id: 1, device_serial: 'GW-1', last_seen_at: null },
      energy_meters: [{ device_id: 2, device_serial: 'EM-1', last_seen_at: null }],
    }),
    getDevices: jest.fn().mockResolvedValue({ results: [] }),
    getSitesList: jest.fn().mockResolvedValue([]),
  },
}));

const renderIt = () => render(<InverterMeasurementConfig siteId="coim_002" />);

describe('InverterMeasurementConfig device operations gating', () => {
  it('shows the plug and hardware controls when device control is allowed', async () => {
    mockCan.mockImplementation((f: string) => f === 'device_control');
    renderIt();
    expect(await screen.findByText('Fridge plug')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a smart plug/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a meter/i })).toBeInTheDocument();
    // one overflow menu per gateway, meter and plug
    expect(screen.getAllByRole('button', { name: /more|actions|menu/i }).length).toBeGreaterThanOrEqual(3);
  });

  it('hides every device-writing control but keeps the read-only rows', async () => {
    mockCan.mockReturnValue(false);
    renderIt();
    expect(await screen.findByText('Fridge plug')).toBeInTheDocument();
    expect(screen.getByText('Monitor GW-1')).toBeInTheDocument();
    expect(screen.getByText('Meter EM-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add a smart plug/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /add a meter/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /more|actions|menu/i })).toBeNull();
  });
});
