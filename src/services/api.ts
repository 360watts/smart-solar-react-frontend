const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const tokens = localStorage.getItem('authTokens');
    if (tokens) {
      try {
        const parsedTokens = JSON.parse(tokens);
        return {
          'Authorization': `Bearer ${parsedTokens.access}`,
          'Content-Type': 'application/json',
        };
      } catch (error) {
        console.error('Error parsing auth tokens:', error);
      }
    }
    return {
      'Content-Type': 'application/json',
    };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    let headers = this.getAuthHeaders();

    let response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Try to refresh token
      const refreshSuccess = await this.refreshToken();
      if (refreshSuccess) {
        // Retry with new token
        headers = this.getAuthHeaders();
        response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            ...options.headers,
          },
        });
      }
    }

    if (response.status === 401) {
      // Token refresh failed or not attempted, logout
      localStorage.removeItem('authTokens');
      localStorage.removeItem('authUser');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    const tokens = localStorage.getItem('authTokens');
    if (!tokens) return false;

    try {
      const parsedTokens = JSON.parse(tokens);
      const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: parsedTokens.refresh }),
      });

      if (response.ok) {
        const data = await response.json();
        const newTokens = {
          access: data.access,
          refresh: parsedTokens.refresh, // Keep the same refresh token
        };
        localStorage.setItem('authTokens', JSON.stringify(newTokens));
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }

  async getConfiguration(): Promise<any> {
    return this.request('/config/');
  }

  async getTelemetry(): Promise<any[]> {
    return this.request('/telemetry/');
  }

  async provisionDevice(data: any): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/devices/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Provisioning failed: ${response.statusText}`);
    }
    return response.json();
  }

  async getAlerts(): Promise<any[]> {
    return this.request('/alerts/');
  }

  async getSystemHealth(): Promise<any> {
    return this.request('/health/');
  }

  async getKPIs(): Promise<any> {
    return this.request('/kpis/');
  }

  async getUsers(search?: string): Promise<any[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/users/${params}`);
  }

  async createUser(userData: any): Promise<any> {
    return this.request('/users/create/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async createEmployee(employeeData: any): Promise<any> {
    return this.request('/users/create/', {
      method: 'POST',
      body: JSON.stringify({ ...employeeData, is_staff: true }),
    });
  }

  async getUserDevices(userId: number): Promise<any[]> {
    return this.request(`/users/${userId}/devices/`);
  }

  async updateUser(userId: number, data: any): Promise<any> {
    return this.request(`/users/${userId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(userId: number): Promise<any> {
    return this.request(`/users/${userId}/delete/`, {
      method: 'DELETE',
    });
  }

  // Profile Management (for current logged-in user)
  async getProfile(): Promise<any> {
    return this.request('/profile/');
  }

  async updateProfile(data: any): Promise<any> {
    return this.request('/profile/update/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { current_password: string; new_password: string }): Promise<any> {
    return this.request('/profile/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Customer Management (separate from staff users/employees)
  async getCustomers(search?: string): Promise<any[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/customers/${params}`);
  }

  async createCustomer(customerData: any): Promise<any> {
    return this.request('/customers/create/', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  async getCustomer(customerId: number): Promise<any> {
    return this.request(`/customers/${customerId}/`);
  }

  async updateCustomer(customerId: number, data: any): Promise<any> {
    return this.request(`/customers/${customerId}/update/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(customerId: number): Promise<any> {
    return this.request(`/customers/${customerId}/delete/`, {
      method: 'DELETE',
    });
  }

  async getPresets(): Promise<any[]> {
    return this.request('/presets/');
  }

  async createPreset(data: any): Promise<any> {
    return this.request('/presets/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePreset(id: number, data: any): Promise<any> {
    return this.request(`/presets/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePreset(id: number): Promise<any> {
    return this.request(`/presets/${id}/delete/`, {
      method: 'DELETE',
    });
  }

  async getDevices(search?: string): Promise<any[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/devices/${params}`);
  }

  async createDevice(deviceData: any): Promise<any> {
    return this.request('/devices/create/', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    });
  }

  async updateDevice(deviceId: number, data: any): Promise<any> {
    return this.request(`/devices/${deviceId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDevice(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/delete/`, {
      method: 'DELETE',
    });
  }

  async deleteDevicesBulk(deviceIds: number[]): Promise<any> {
    return this.request(`/devices/delete-bulk/`, {
      method: 'POST',
      body: JSON.stringify({ device_ids: deviceIds }),
    });
  }

  async getSlaves(configId: string): Promise<any[]> {
    return this.request(`/presets/${configId}/slaves/`);
  }

  async createSlave(configId: string, slaveData: any): Promise<any> {
    return this.request(`/presets/${configId}/slaves/create/`, {
      method: 'POST',
      body: JSON.stringify(slaveData),
    });
  }

  async updateSlave(configId: string, slaveId: number, slaveData: any): Promise<any> {
    return this.request(`/presets/${configId}/slaves/${slaveId}/`, {
      method: 'PUT',
      body: JSON.stringify(slaveData),
    });
  }

  async deleteSlave(configId: string, slaveId: number): Promise<any> {
    return this.request(`/presets/${configId}/slaves/${slaveId}/delete/`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();