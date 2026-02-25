import { cacheService, DEFAULT_TTL } from './cacheService';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smart-solar-django-backend.vercel.app/api';

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

    if (response.status === 204) return null;
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
    const cacheKey = 'alerts';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.request('/alerts/');
    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async getSystemHealth(): Promise<any> {
    const cacheKey = 'system_health';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.request('/health/');
    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async getKPIs(): Promise<any> {
    const cacheKey = 'kpis';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.request('/kpis/');
    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async getUsers(search?: string): Promise<any[]> {
    const cacheKey = `users_${search || 'all'}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await this.request(`/users/${params}`);
    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async createUser(userData: any): Promise<any> {
    const result = await this.request('/users/create/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    // Invalidate users cache
    cacheService.clear('users_all');
    cacheService.clearAll(); // Clear all cache for safety
    return result;
  }

  async createEmployee(employeeData: any): Promise<any> {
    const result = await this.request('/users/create/', {
      method: 'POST',
      body: JSON.stringify({ ...employeeData, is_staff: true }),
    });
    cacheService.clear('users_all');
    return result;
  }

  async getUserDevices(userId: number): Promise<any[]> {
    return this.request(`/users/${userId}/devices/`);
  }

  async getUserSite(userId: number): Promise<any> {
    return this.request(`/users/${userId}/site/`);
  }

  async createUserSite(userId: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/users/${userId}/site/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUserSite(userId: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/users/${userId}/site/update/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getDeviceSite(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/site/`);
  }

  async createDeviceSite(deviceId: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/devices/${deviceId}/site/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeviceSite(deviceId: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/devices/${deviceId}/site/update/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DynamoDB site data
  async getSiteTelemetry(siteId: string, params?: { start_date?: string; end_date?: string; days?: number }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.days) query.append('days', params.days.toString());
    const url = `/sites/${siteId}/telemetry/${query.toString() ? '?' + query.toString() : ''}`;
    return this.request(url);
  }

  async getSiteForecast(siteId: string, params?: { date?: string; start_date?: string; end_date?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    const url = `/sites/${siteId}/forecast/${query.toString() ? '?' + query.toString() : ''}`;
    return this.request(url);
  }

  /**
   * Returns { current: WeatherObs | null, hourly_forecast: WeatherFcst[] }
   *   current.obs_timestamp    — ISO UTC of the observation
   *   current.ghi_wm2          — global horizontal irradiance (W/m²)
   *   current.temperature_c    — air temperature (°C)
   *   current.humidity_pct     — relative humidity (%)
   *   current.wind_speed_ms    — wind speed (m/s)
   *   current.cloud_cover_pct  — cloud cover (%)
   *   hourly_forecast[n].forecast_for — ISO UTC of the forecast slot
   *   hourly_forecast[n].ghi_wm2 …   — same fields as current
   */
  async getSiteWeather(siteId: string): Promise<{ current: any | null; hourly_forecast: any[] } | null> {
    return this.request(`/sites/${siteId}/weather/`);
  }

  async updateUser(userId: number, data: any): Promise<any> {
    const result = await this.request(`/users/${userId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    cacheService.clear('users_all');
    return result;
  }

  async deleteUser(userId: number): Promise<any> {
    const result = await this.request(`/users/${userId}/delete/`, {
      method: 'DELETE',
    });
    cacheService.clear('users_all');
    return result;
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
    const cacheKey = 'presets';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.request('/presets/');
    // Use longer TTL for presets as they change less frequently
    cacheService.set(cacheKey, data, 30 * 60 * 1000); // 30 minutes
    return data;
  }

  async createPreset(data: any): Promise<any> {
    const result = await this.request('/presets/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    cacheService.clear('presets');
    return result;
  }

  async updatePreset(id: number, data: any): Promise<any> {
    const result = await this.request(`/presets/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    cacheService.clear('presets');
    return result;
  }

  async deletePreset(id: number): Promise<any> {
    const result = await this.request(`/presets/${id}/delete/`, {
      method: 'DELETE',
    });
    cacheService.clear('presets');
    return result;
  }

  async getGlobalSlaves(): Promise<any[]> {
    return this.request('/slaves/');
  }

  async createGlobalSlave(slaveData: any): Promise<any> {
    return this.request('/slaves/create/', {
      method: 'POST',
      body: JSON.stringify(slaveData),
    });
  }

  async updateGlobalSlave(slaveId: number, slaveData: any): Promise<any> {
    return this.request(`/slaves/${slaveId}/`, {
      method: 'PUT',
      body: JSON.stringify(slaveData),
    });
  }

  async deleteGlobalSlave(slaveId: number): Promise<any> {
    return this.request(`/slaves/${slaveId}/delete/`, {
      method: 'DELETE',
    });
  }

  async getDevices(search?: string, page: number = 1, pageSize: number = 25): Promise<any> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    const queryString = params.toString();
    return this.request(`/devices/?${queryString}`);
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

  async rebootDevice(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/reboot/`, {
      method: 'POST',
    });
  }

  async hardResetDevice(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/hard-reset/`, {
      method: 'POST',
    });
  }

  async getDeviceLogs(deviceId: number, limit: number = 100, offset: number = 0): Promise<any> {
    return this.request(`/devices/${deviceId}/logs/?limit=${limit}&offset=${offset}`);
  }

  async toggleDeviceLogs(deviceId: number, enabled: boolean): Promise<any> {
    return this.request(`/devices/${deviceId}/logs/toggle/`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
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

  async addSlavesToPreset(configId: string, slaveIds: number[]): Promise<any> {
    return this.request(`/presets/${configId}/slaves/add/`, {
      method: 'POST',
      body: JSON.stringify({ slave_ids: slaveIds }),
    });
  }

  async detachSlaveFromPreset(configId: string, slaveId: number): Promise<any> {
    return this.request(`/presets/${configId}/slaves/${slaveId}/detach/`, {
      method: 'POST',
    });
  }

  // OTA (Over-The-Air) Update Endpoints
  async getFirmwareVersions(activeOnly: boolean = true): Promise<any> {
    const params = new URLSearchParams();
    params.append('active', activeOnly.toString());
    return this.request(`/ota/firmware/?${params.toString()}`);
  }

  async uploadFirmwareVersion(formData: FormData): Promise<any> {
    const url = `${API_BASE_URL}/ota/firmware/create/`;
    const tokens = localStorage.getItem('authTokens');
    
    if (!tokens) {
      throw new Error('Authentication required');
    }
    
    const parsedTokens = JSON.parse(tokens);
    let headers: HeadersInit = {
      'Authorization': `Bearer ${parsedTokens.access}`,
    };
    // Don't set Content-Type - let browser set it with boundary for multipart/form-data
    
    let response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Handle 401 with token refresh
    if (response.status === 401) {
      const refreshSuccess = await this.refreshToken();
      if (refreshSuccess) {
        const newTokens = JSON.parse(localStorage.getItem('authTokens') || '{}');
        headers = {
          'Authorization': `Bearer ${newTokens.access}`,
        };
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
      }
    }

    if (response.status === 401) {
      localStorage.removeItem('authTokens');
      localStorage.removeItem('authUser');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async updateFirmwareVersion(firmwareId: number, data: any): Promise<any> {
    return this.request(`/ota/firmware/${firmwareId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFirmwareVersion(firmwareId: number): Promise<any> {
    return this.request(`/ota/firmware/${firmwareId}/delete/`, {
      method: 'DELETE',
    });
  }

  async getDeviceUpdateLogs(deviceId: string): Promise<any> {
    return this.request(`/ota/devices/${deviceId}/logs`);
  }

  async getOTAConfig(): Promise<any> {
    return this.request(`/ota/config/`);
  }

  async updateOTAConfig(config: any): Promise<any> {
    return this.request(`/ota/config/update/`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  async getOTAHealth(): Promise<any> {
    return this.request(`/ota/health/`);
  }

  async triggerRollback(deviceSerial: string, notes?: string): Promise<any> {
    return this.request(`/ota/updates/rollback/`, {
      method: 'POST',
      body: JSON.stringify({
        device_serial: deviceSerial,
        notes: notes || ''
      }),
    });
  }

  async deployFirmware(firmwareId: number, deviceSerials: string[], notes?: string): Promise<any> {
    return this.request(`/ota/updates/multiple/`, {
      method: 'POST',
      body: JSON.stringify({
        firmware_id: firmwareId,
        device_serials: deviceSerials,
        notes: notes || ''
      }),
    });
  }

  async listTargetedUpdates(): Promise<any> {
    return this.request(`/ota/updates/`);
  }

  async getTargetedUpdate(updateId: number): Promise<any> {
    return this.request(`/ota/updates/${updateId}/`);
  }
}

export const apiService = new ApiService();