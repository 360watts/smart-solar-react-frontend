import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Users from '../Users';
import { apiService } from '../../../services/api';

const mockAddToast = jest.fn();
const mockNavigate = jest.fn();
const mockApi = apiService as any;

jest.mock('../../../services/api', () => ({
  apiService: {
    getUsers: jest.fn(), createUser: jest.fn(), updateUser: jest.fn(), deleteUser: jest.fn(),
    activateUser: jest.fn(), getUserDevices: jest.fn(),
  },
}));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
jest.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ addToast: mockAddToast }) }));
jest.mock('../../../shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
jest.mock('../../mobile/staff/MobileUsers', () => () => null);
jest.mock('../../../shared/layout/PageHeader', () => ({ title }: any) => <h1>{title}</h1>);
jest.mock('../../../shared/components/PhoneInput', () => ({ value, onChange }: any) => (
  <input aria-label="Mobile" value={value} onChange={(e) => onChange(e.target.value)} />
));

const user = (id: number, first: string, active: boolean) => ({
  id, username: first.toLowerCase(), email: `${first.toLowerCase()}@x.com`, first_name: first, last_name: 'Nair',
  mobile_number: '+919900000000', address: 'Coimbatore', is_active: active, customer_id: null, date_joined: '2026-10-01T00:00:00Z',
});
const DATA = { count: 3, total_pages: 1, results: [user(1, 'Asha', true), user(2, 'Ravi', false), user(3, 'Meena', true)] };
const DEV = { id: 9, device_serial: 'SN-9', hw_id: 'HW9', model: 'M1', config_version: '3', provisioned_at: '2026-10-02T00:00:00Z' };

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.getUsers.mockResolvedValue(DATA);
  mockApi.getUserDevices.mockResolvedValue([DEV]);
  mockApi.createUser.mockResolvedValue({});
  mockApi.updateUser.mockResolvedValue({});
  mockApi.deleteUser.mockResolvedValue({});
  mockApi.activateUser.mockResolvedValue({});
});

const open = async () => { render(<Users />); await screen.findByTestId('user-row-1'); };
const fill = (label: string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

describe('Users page', () => {
  it('U1 one row per user with status', async () => {
    await open();
    expect(screen.getByTestId('user-row-1')).toHaveTextContent('Asha Nair');
    expect(screen.getByTestId('user-row-1')).toHaveTextContent('@asha');
    expect(screen.getByTestId('user-row-1')).toHaveTextContent('Active');
    expect(screen.getByTestId('user-row-2')).toHaveTextContent('Inactive');
  });

  it('U2 first user selected with devices', async () => {
    await open();
    expect(await screen.findByTestId('device-row-9')).toHaveTextContent('SN-9');
    expect(mockApi.getUserDevices).toHaveBeenCalledWith(1);
  });

  it('U3 clicking a row switches the details', async () => {
    await open();
    fireEvent.click(screen.getByTestId('user-row-2'));
    await waitFor(() => expect(mockApi.getUserDevices).toHaveBeenCalledWith(2));
  });

  it('U4 only inactive rows have Activate', async () => {
    await open();
    expect(screen.getAllByRole('button', { name: 'Activate' })).toHaveLength(1);
  });

  it('U5 Activate calls the API and toasts', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(mockApi.activateUser).toHaveBeenCalledWith(2));
    await waitFor(() => expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('ravi@x.com') })));
  });

  it('U7 Delete asks first and Cancel deletes nothing', async () => {
    await open();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(await screen.findByText('Delete this user?')).toBeInTheDocument();
    expect(mockApi.deleteUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockApi.deleteUser).not.toHaveBeenCalled();
  });

  it('U8 confirming deletes and reloads', async () => {
    await open();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete user' }));
    await waitFor(() => expect(mockApi.deleteUser).toHaveBeenCalledWith(1));
    await waitFor(() => expect(mockApi.getUsers).toHaveBeenCalledTimes(2));
  });

  it('U9 empty Add form shows messages and does not create', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save user' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(mockApi.createUser).not.toHaveBeenCalled();
  });

  it('U10 filled Add form creates', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    await screen.findByRole('button', { name: 'Save user' });
    fill('Email', 'n@x.com'); fill('First name', 'New'); fill('Last name', 'Person'); fill('Mobile', '+919811111111');
    fireEvent.click(screen.getByRole('button', { name: 'Save user' }));
    await waitFor(() => expect(mockApi.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'n@x.com', first_name: 'New', last_name: 'Person', mobile_number: '+919811111111' })));
    await waitFor(() => expect(mockApi.getUsers).toHaveBeenCalledTimes(2));
  });

  it('U11 Edit prefills and saves', async () => {
    await open();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(await screen.findByLabelText('First name')).toHaveValue('Asha');
    fill('First name', 'Asha2');
    fireEvent.click(screen.getByRole('button', { name: 'Save user' }));
    await waitFor(() => expect(mockApi.updateUser).toHaveBeenCalledWith(1, expect.objectContaining({ first_name: 'Asha2' })));
  });

  it('U12 device row navigates', async () => {
    await open();
    fireEvent.click(await screen.findByTestId('device-row-9'));
    expect(mockNavigate).toHaveBeenCalledWith('/devices/9/dashboard');
  });

  it('U13 no devices shows the empty state', async () => {
    mockApi.getUserDevices.mockResolvedValue([]);
    await open();
    expect(await screen.findByText('No devices assigned yet')).toBeInTheDocument();
  });

  it('U15 a failing create keeps the dialog open with the error', async () => {
    mockApi.createUser.mockRejectedValue(new Error('Email already used'));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
    await screen.findByRole('button', { name: 'Save user' });
    fill('Email', 'n@x.com'); fill('First name', 'N'); fill('Last name', 'P'); fill('Mobile', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Save user' }));
    expect(await screen.findByText('Email already used')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save user' })).toBeInTheDocument();
  });
});
