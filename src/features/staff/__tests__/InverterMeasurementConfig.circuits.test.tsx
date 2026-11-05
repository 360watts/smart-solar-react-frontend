import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InverterMeasurementConfig from '../InverterMeasurementConfig';
import { apiService } from '../../../services/api';

jest.mock('../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: () => true }) }));
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../services/api', () => ({
  apiService: {
    getSmartDevices: jest.fn().mockResolvedValue([]),
    getCircuitLines: jest.fn().mockResolvedValue([]),
    getSiteStaffDetail: jest.fn(),
    getDevices: jest.fn().mockResolvedValue({ results: [] }),
    getSitesList: jest.fn().mockResolvedValue([]),
  },
}));

const api = apiService as jest.Mocked<any>;
const site = (withHw: boolean) => ({
  display_name: 'Coimbatore 02',
  gateway_device: withHw ? { device_id: 1, id: 1, device_serial: 'GW-1', last_seen_at: null } : null,
  energy_meters: withHw ? [{ device_id: 2, device_serial: 'EM-1', last_seen_at: null }] : [],
});
const renderIt = () => render(<InverterMeasurementConfig siteId="coim_002" />);

describe('Circuits card', () => {
  beforeEach(() => { api.getCircuitLines.mockResolvedValue([]); });

  it('C1 shows the inverter side and grid board with what measures them', async () => {
    api.getSiteStaffDetail.mockResolvedValue(site(true));
    renderIt();
    expect(await screen.findByText(/Measured by monitor GW-1/)).toBeInTheDocument();
    expect(screen.getByText(/Measured by meter EM-1/)).toBeInTheDocument();
  });

  it('C2 says not measured yet without hardware', async () => {
    api.getSiteStaffDetail.mockResolvedValue(site(false));
    renderIt();
    expect(await screen.findAllByText('Not measured yet')).toHaveLength(2);
  });

  it('C3/C4 warns and blocks a circuit named Grid, allows an EV charger', async () => {
    api.getSiteStaffDetail.mockResolvedValue(site(true));
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: /something else/i }));
    const name = screen.getByPlaceholderText(/garage ev charger/i);
    fireEvent.change(name, { target: { value: 'Grid' } });
    expect(screen.getByText(/already measured by the monitor and the meter/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Inverter backup' } });
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Garage EV charger' } });
    expect(screen.queryByText(/already measured by the monitor and the meter/i)).toBeNull();
    expect(screen.getByRole('button', { name: /^add$/i })).toBeEnabled();
  });

  it('C5 marks a saved line named Grid for removal', async () => {
    api.getSiteStaffDetail.mockResolvedValue(site(true));
    api.getCircuitLines.mockResolvedValue([{ id: 2, circuit: 'ev_line', label: 'Grid', device: null, is_monitored: false }]);
    renderIt();
    expect(await screen.findByText(/Already covered by the monitor or meter/)).toBeInTheDocument();
  });
});
