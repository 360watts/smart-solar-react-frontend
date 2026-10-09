import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditDeviceModal from './EditDeviceModal';

// docs/test-scenarios/role-based-hiding.md IP-8, IP-11
jest.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
const mockCan = jest.fn();
jest.mock('../../shared/access/useAccess', () => ({ useAccess: () => ({ can: mockCan }) }));

const DEVICE = { id: 7, device_serial: 'GW-7', device_type: 'gateway' as const, provisioned_at: '2026-01-01T00:00:00Z' };
const save = async (wifi_ssid?: string) => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<EditDeviceModal isOpen device={{ ...DEVICE, wifi_ssid }} isDark={false} onClose={jest.fn()} onSave={onSave} />);
  return onSave;
};
const clickSave = () => fireEvent.click(screen.getByText('Save Changes'));

it('employee: SSID managed by an admin, no Wi-Fi fields sent', async () => {
  mockCan.mockReturnValue(false);
  const onSave = await save(undefined);
  expect(screen.getByText('Managed by an admin')).not.toBeNull();
  expect(screen.queryByPlaceholderText('Network name')).toBeNull();
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  const payload = onSave.mock.calls[0][0];
  expect('wifi_ssid' in payload).toBe(false);
  expect('wifi_password' in payload).toBe(false);
});

it('admin: untouched SSID is not sent', async () => {
  mockCan.mockReturnValue(true);
  const onSave = await save('HomeNet');
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect('wifi_ssid' in onSave.mock.calls[0][0]).toBe(false);
});

it('admin: a changed SSID is sent', async () => {
  mockCan.mockReturnValue(true);
  const onSave = await save('HomeNet');
  fireEvent.change(screen.getByPlaceholderText('Network name'), { target: { value: 'NewNet' } });
  clickSave();
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].wifi_ssid).toBe('NewNet');
});
