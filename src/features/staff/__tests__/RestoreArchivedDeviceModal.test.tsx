import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import RestoreArchivedDeviceModal from '../RestoreArchivedDeviceModal';

const mockCan = jest.fn();
jest.mock('../../../shared/access/useAccess', () => ({ useAccess: () => ({ can: mockCan }) }));
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../services/api', () => ({
  apiService: {
    getArchivedDevices: jest.fn().mockResolvedValue({
      results: [{
        id: 1, device_serial: 'SN-001', device_type: 'gateway', hw_id: null, model: null, site_id: null,
        last_heartbeat: null, provisioned_at: '2026-01-01T00:00:00Z', deleted_at: '2026-02-01T00:00:00Z',
        created_by_username: null,
      }],
    }),
  },
}));

const renderModal = () =>
  render(<RestoreArchivedDeviceModal open onClose={() => {}} onRestored={() => {}} />);

describe('RestoreArchivedDeviceModal destructive gating', () => {
  it('shows select + permanent-delete controls when destructive is allowed', async () => {
    mockCan.mockImplementation((f: string) => f === 'destructive');
    renderModal();
    expect(await screen.findByLabelText('Permanently delete device')).toBeInTheDocument();
    expect(screen.getByLabelText('Select device')).toBeInTheDocument();
  });

  it('hides them (but keeps the row) when destructive is not allowed', async () => {
    mockCan.mockReturnValue(false);
    renderModal();
    expect(await screen.findByText('SN-001')).toBeInTheDocument();
    expect(screen.queryByLabelText('Permanently delete device')).toBeNull();
    expect(screen.queryByLabelText('Select device')).toBeNull();
  });
});
