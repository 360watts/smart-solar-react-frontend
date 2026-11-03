import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import Configuration from '../Configuration';

import { apiService } from '../../../services/api';

const mockAddToast = jest.fn();
const mockApi = apiService as any;

jest.mock('../../../services/api', () => ({
  apiService: { getGlobalSlaves: jest.fn(), updateGlobalSlave: jest.fn(), deleteGlobalSlave: jest.fn() },
}));
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ addToast: mockAddToast }) }));
jest.mock('../../../shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
jest.mock('../../mobile/staff/MobileConfiguration', () => () => null);
jest.mock('../SlaveConfigModal', () => () => null);
jest.mock('../../../shared/layout/PageHeader', () => ({ title }: any) => <h1>{title}</h1>);

const reg = (id: number, label: string, enabled: boolean) => ({
  id, label, address: 0xb8 + id, num_registers: 1, function_code: 3, data_type: 0, scale_factor: 1, offset: 0, enabled, unit: 'W',
});
const slave = (id: number, name: string, regs: any[]) => ({
  id, slave_id: id, device_name: name, polling_interval_ms: 5000, timeout_ms: 1000, enabled: true, config_id: null, config_name: 'global', registers: regs,
});
const DATA = {
  count: 2, total_pages: 1,
  results: [
    slave(1, 'Deye inverter', [reg(1, 'Battery SOC', true), reg(2, 'PV1 power', false)]),
    slave(2, 'Energy meter', [reg(3, 'Grid power', true)]),
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.getGlobalSlaves.mockResolvedValue(DATA);
});

const open = async () => {
  render(<Configuration />);
  await screen.findByTestId('slave-row-1');
};

describe('Configuration page', () => {
  it('C1 one row per slave with counts', async () => {
    await open();
    const row = screen.getByTestId('slave-row-1');
    expect(row).toHaveTextContent('Deye inverter');
    expect(row).toHaveTextContent('#1');
    expect(row).toHaveTextContent('5000 ms');
    expect(row).toHaveTextContent('1 / 2');
    expect(screen.getByTestId('slave-row-2')).toHaveTextContent('1 / 1');
  });

  it('C2 first row is selected and its registers show as hex', async () => {
    await open();
    expect(screen.getByText('Deye inverter registers')).toBeInTheDocument();
    expect(screen.getByText('Battery SOC')).toBeInTheDocument();
    expect(screen.getByText('0x00B9')).toBeInTheDocument();
  });

  it('C3 clicking a row shows its registers', async () => {
    await open();
    fireEvent.click(screen.getByTestId('slave-row-2'));
    expect(screen.getByText('Energy meter registers')).toBeInTheDocument();
    expect(screen.getByText('Grid power')).toBeInTheDocument();
    expect(screen.queryByText('Battery SOC')).not.toBeInTheDocument();
  });

  it('C4 flipping a switch saves only that register', async () => {
    mockApi.updateGlobalSlave.mockResolvedValue(slave(1, 'Deye inverter', [reg(1, 'Battery SOC', true), reg(2, 'PV1 power', true)]));
    await open();
    fireEvent.click(screen.getByRole('switch', { name: 'PV1 power enabled' }));
    await waitFor(() => expect(mockApi.updateGlobalSlave).toHaveBeenCalled());
    const [id, payload] = mockApi.updateGlobalSlave.mock.calls[0];
    expect(id).toBe(1);
    expect(payload.registers.map((r: any) => r.enabled)).toEqual([true, true]);
    await waitFor(() => expect(screen.getByTestId('slave-row-1')).toHaveTextContent('2 / 2'));
  });

  it('C6/C7 delete asks first and Cancel deletes nothing', async () => {
    await open();
    fireEvent.click(within(screen.getByTestId('slave-row-1')).getByText('Delete'));
    expect(await screen.findByText(/Deye inverter \(slave #1\) and its 2 registers/)).toBeInTheDocument();
    expect(mockApi.deleteGlobalSlave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockApi.deleteGlobalSlave).not.toHaveBeenCalled();
  });

  it('C8 confirming deletes the slave and toasts', async () => {
    mockApi.deleteGlobalSlave.mockResolvedValue({});
    await open();
    fireEvent.click(within(screen.getByTestId('slave-row-1')).getByText('Delete'));
    fireEvent.click(await screen.findByText('Delete slave'));
    await waitFor(() => expect(mockApi.deleteGlobalSlave).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByTestId('slave-row-1')).not.toBeInTheDocument());
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });
});
