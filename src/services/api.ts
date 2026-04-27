import { cacheService, DEFAULT_TTL } from './cacheService';
import { DEFAULT_PAGE_SIZE } from '../constants';

// ─── Alerts Analytics ────────────────────────────────────────────────────────

export interface AlertAnalyticsFaultSummary {
  fault_code: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  reason: string;
  total_occurrences: number;
  active_count: number;
  resolved_count: number;
  first_seen: string;
  last_seen: string;
  avg_resolution_seconds: number | null;
}

export interface AlertAnalyticsTimelineEntry {
  fault_code: string;
  severity: 'critical' | 'warning' | 'info';
  count: number;
}

export interface AlertAnalyticsTimelineDay {
  date: string;
  faults: AlertAnalyticsTimelineEntry[];
}

export interface AlertAnalyticsRecentInstance {
  id: number;
  triggered_at: string;
  resolved_at: string | null;
  status: string;
  message: string;
  device_serial: string;
  site_id: string;
}

export interface AlertAnalyticsRuleCatalogueEntry {
  fault_code: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  reason: string;
  cooldown_hours: number | null;
  fix_guidance: string;
}

export interface AlertAnalyticsResponse {
  lookback_days: number;
  fault_summaries: AlertAnalyticsFaultSummary[];
  timeline: AlertAnalyticsTimelineDay[];
  recent_instances: Record<string, AlertAnalyticsRecentInstance[]>;
  rule_catalogue: AlertAnalyticsRuleCatalogueEntry[];
}

// ─── Alert item ───────────────────────────────────────────────────────────────

/** Combined alert item returned by GET /api/alerts/ */
export interface AlertItem {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  device_id: string;
  device_serial?: string;
  timestamp: string;
  resolved: boolean;
  created_by_username?: string;
  created_at?: string;
  /** false = persistent DB-backed fault alert; true or absent = ephemeral */
  generated?: boolean;
  /** e.g. 'BAT-001', 'GRID-001' — present on fault alerts */
  fault_code?: string;
  /** 'active' | 'acknowledged' | 'resolved' — present on fault alerts */
  status?: 'active' | 'acknowledged' | 'resolved';
  /** AI diagnostic report */
  metadata?: {
    diagnostic?: {
      root_cause: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      recommendation: string;
      llm_model?: string;
      call_duration_ms?: number;
      timestamp?: string;
      parse_error?: string;
    };
  };
}

/** Per-alert result from POST /api/alerts/diagnose-batch/ */
export interface AlertDiagnosticResult {
  alert_id: number;
  fault_code: string;
  device_serial: string | null;
  triggered_at: string | null;
  queue_status?: 'queued' | 'done';
  diagnostic: {
    root_cause: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    recommendation: string;
    llm_model?: string;
    call_duration_ms?: number;
    timestamp?: string;
    parse_error?: string;
  } | null;
}

export interface DiagnoseBatchResponse {
  queued: number;
  skipped: number;
  no_api_key: boolean;
  results: AlertDiagnosticResult[];
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.360watts.com/api';

class ApiService {
  private refreshTokenPromise: Promise<boolean> | null = null;

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

  /** Normalize backend error: supports { error }, { detail }, or raw text. */
  private async parseErrorResponse(response: Response): Promise<string> {
    const text = await response.text();
    try {
      const body = JSON.parse(text);
      if (body?.error) return body.error;
      if (body?.detail) return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore
    }
    return text || `API request failed: ${response.status} ${response.statusText}`;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    let headers = this.getAuthHeaders();

    // Abort after 60 s — Railway cold starts can take up to ~50 s.
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Server is warming up — please try again in a moment.', 'AbortError')),
      60000,
    );

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401) {
      // Try to refresh token
      const refreshSuccess = await this.refreshToken();
      if (refreshSuccess) {
        // Retry with new token
        headers = this.getAuthHeaders();
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(
          () => retryController.abort(new DOMException('Server is warming up — please try again in a moment.', 'AbortError')),
          40000,
        );
        try {
          response = await fetch(url, {
            ...options,
            headers: { ...headers, ...options.headers },
            signal: retryController.signal,
          });
        } finally {
          clearTimeout(retryTimeoutId);
        }
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
      const message = await this.parseErrorResponse(response);
      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    // Singleton: if a refresh is already in flight, all callers share the same promise.
    // This prevents refresh token rotation failures when Promise.all fires multiple
    // simultaneous 401s — without this each caller would consume the rotated token.
    if (this.refreshTokenPromise) return this.refreshTokenPromise;
    this.refreshTokenPromise = this._doRefreshToken().finally(() => {
      this.refreshTokenPromise = null;
    });
    return this.refreshTokenPromise!;
  }

  private async _doRefreshToken(): Promise<boolean> {
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
          refresh: data.refresh ?? parsedTokens.refresh, // Use rotated token if server sent one
        };
        localStorage.setItem('authTokens', JSON.stringify(newTokens));
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return false;
  }

  /**
   * Fetches gateway configuration. Returns null when none exists (404),
   * so the UI can treat it as "no config" / global mode.
   */
  async getConfiguration(): Promise<any> {
    const url = `${API_BASE_URL}/config/`;
    const headers = this.getAuthHeaders();
    let response = await fetch(url, { headers });

    if (response.status === 401) {
      const refreshSuccess = await this.refreshToken();
      if (refreshSuccess) {
        response = await fetch(url, { headers: this.getAuthHeaders() });
      }
    }
    if (response.status === 401) {
      localStorage.removeItem('authTokens');
      localStorage.removeItem('authUser');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
    if (response.status === 404) return null;
    if (!response.ok) {
      const message = await this.parseErrorResponse(response);
      throw new Error(message);
    }
    return response.json();
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

  async getAlerts(): Promise<AlertItem[]> {
    const cacheKey = 'alerts_manage';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    // /alerts/manage/ returns all statuses (active, acknowledged, resolved)
    // /alerts/ only returned active alerts
    const raw: any[] = await this.request('/alerts/manage/');

    // Normalize field differences between /alerts/ and /alerts/manage/ responses
    const data: AlertItem[] = raw.map(a => ({
      ...a,
      // /alerts/manage/ uses alert_type; component expects type
      type: a.type ?? a.alert_type ?? '',
      // /alerts/manage/ uses triggered_at; component expects timestamp
      timestamp: a.timestamp ?? a.triggered_at ?? '',
      // /alerts/manage/ uses device_serial; component expects device_id
      device_id: a.device_id ?? a.device_serial ?? a.metadata?.device_serial ?? '',
      // normalise resolved boolean from status field
      resolved: a.resolved ?? (a.status === 'resolved'),
    }));

    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async diagnoseBatch(): Promise<DiagnoseBatchResponse> {
    return this.request('/alerts/diagnose-batch/', { method: 'POST' });
  }

  async getSystemHealth(): Promise<any> {
    const cacheKey = 'system_health';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.request('/health/');
    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async getTelemetryBufferStats(): Promise<any> {
    const cacheKey = 'telemetry_buffer_stats';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.request('/telemetry-buffer/stats/');
    cacheService.set(cacheKey, data, 30 * 1000); // 30s TTL
    return data;
  }

  async getUsers(search?: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<any> {
    const cacheKey = `users_${search || 'all'}_${page}_${pageSize}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    const data = await this.request(`/users/?${params.toString()}`);
    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async createUser(userData: any): Promise<any> {
    const result = await this.request('/users/create/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    cacheService.clearPattern(/^users_/);
    return result;
  }

  async getEmployees(search?: string, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<any> {
    const cacheKey = `employees_${search || 'all'}_${page}_${pageSize}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    const data = await this.request(`/employees/?${params.toString()}`);
    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }

  async createEmployee(employeeData: any): Promise<any> {
    const result = await this.request('/users/create/', {
      method: 'POST',
      body: JSON.stringify({ ...employeeData, is_staff: true }),
    });
    cacheService.clearPattern(/^users_/);
    cacheService.clearPattern(/^employees_/);
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
  async getSiteTelemetry(siteId: string, params?: { start_date?: string; end_date?: string; days?: number; aggregate?: 'none' | '5min' | '15min' }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.days) query.append('days', params.days.toString());
    if (params?.aggregate) query.append('aggregate', params.aggregate);
    const url = `/sites/${siteId}/telemetry/${query.toString() ? '?' + query.toString() : ''}`;
    // 55-second TTL: slightly under the 60-second auto-refresh interval so the
    // next poll always fetches fresh data rather than hitting a same-age cache.
    const cacheKey = `telemetry_${siteId}_${query.toString()}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(url);
    cacheService.set(cacheKey, data, 55 * 1000);
    return data;
  }

  /**
   * Historical telemetry from S3 (older than DynamoDB's 7-day TTL window).
   * S3 path: telemetry_csv/{site_id}/{YYYY}/{MM}/{DD}/{HH}/data.csv
   * Returns same shape as getSiteTelemetry.
   */
  async getSiteHistory(siteId: string, params: { start_date: string; end_date: string; aggregate?: '5min' | '15min' }): Promise<any[]> {
    const query = new URLSearchParams({ start_date: params.start_date, end_date: params.end_date });
    if (params.aggregate) query.append('aggregate', params.aggregate);
    // 5-minute TTL: S3 history is immutable for past data, very safe to cache
    const cacheKey = `history_${siteId}_${query.toString()}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${siteId}/history/?${query.toString()}`);
    cacheService.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  async getSiteForecast(siteId: string, params?: { date?: string; start_date?: string; end_date?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    const url = `/sites/${siteId}/forecast/${query.toString() ? '?' + query.toString() : ''}`;
    // 15-minute TTL: scheduler refreshes forecast every 15 min, so this is the ideal cache window
    const cacheKey = `forecast_${siteId}_${query.toString()}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(url);
    cacheService.set(cacheKey, data, 15 * 60 * 1000);
    return data;
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
    // 15-minute TTL: weather data refreshes at the same cadence as the forecast scheduler
    const cacheKey = `weather_${siteId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${siteId}/weather/`);
    cacheService.set(cacheKey, data, 15 * 60 * 1000);
    return data;
  }

  async getPhaseLoad(siteId: string, hours: number = 24, aggregate: string = 'hourly'): Promise<any[]> {
    const enc = encodeURIComponent(siteId);
    const cacheKey = `phase_load_${siteId}_${hours}_${aggregate}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${enc}/phase-load/?hours=${hours}&aggregate=${aggregate}`);
    cacheService.set(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  async getForecastAccuracy(siteId: string, days: number = 30): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const cacheKey = `forecast_accuracy_${siteId}_${days}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${enc}/forecast-accuracy/?days=${days}`);
    cacheService.set(cacheKey, data, 30 * 60 * 1000);
    return data;
  }

  async getLoadForecastAccuracy(siteId: string, days: number = 30): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const cacheKey = `load_forecast_accuracy_${siteId}_${days}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${enc}/load-forecast-accuracy/?days=${days}`);
    cacheService.set(cacheKey, data, 30 * 60 * 1000);
    return data;
  }

  async getLoadForecast(siteId: string, days: number = 7): Promise<any[]> {
    const enc = encodeURIComponent(siteId);
    const cacheKey = `load_forecast_${siteId}_${days}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${enc}/load-forecast/?days=${days}`);
    cacheService.set(cacheKey, data, 15 * 60 * 1000);
    return data;
  }

  async getWeatherAccuracy(siteId: string, days: number = 7): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const cacheKey = `weather_accuracy_${siteId}_${days}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${enc}/weather-accuracy/?days=${days}`);
    cacheService.set(cacheKey, data, 30 * 60 * 1000);
    return data;
  }

  async updateUser(userId: number, data: any): Promise<any> {
    const result = await this.request(`/users/${userId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    cacheService.clearPattern(/^users_/);
    cacheService.clearPattern(/^employees_/);
    return result;
  }

  async deleteUser(userId: number): Promise<any> {
    const result = await this.request(`/users/${userId}/delete/`, {
      method: 'DELETE',
    });
    cacheService.clearPattern(/^users_/);
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

  async getPresets(search?: string, page?: number, pageSize?: number): Promise<any> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (page !== undefined) {
      params.set('page', String(page));
      params.set('page_size', String(pageSize ?? DEFAULT_PAGE_SIZE));
    }
    const qs = params.toString();
    const cacheKey = `presets_${qs || 'all'}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const data = await this.request(`/presets/${qs ? `?${qs}` : ''}`);
    cacheService.set(cacheKey, data, 30 * 60 * 1000); // 30 minutes
    return data;
  }

  async getPresetFresh(configId: string): Promise<any> {
    // Bypass cache — used when we need the real current version (e.g. after a config bump)
    cacheService.clearPattern(new RegExp(`^presets_search=${configId}`));
    const params = new URLSearchParams({ search: configId });
    const data = await this.request(`/presets/?${params}`);
    return data;
  }

  async createPreset(data: any): Promise<any> {
    const result = await this.request('/presets/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    cacheService.clearPattern(/^presets_/);
    return result;
  }

  async updatePreset(id: number, data: any): Promise<any> {
    const result = await this.request(`/presets/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    cacheService.clearPattern(/^presets_/);
    return result;
  }

  async deletePreset(id: number): Promise<any> {
    const result = await this.request(`/presets/${id}/delete/`, {
      method: 'DELETE',
    });
    cacheService.clearPattern(/^presets_/);
    return result;
  }

  async getGlobalSlaves(search?: string, page?: number, pageSize?: number): Promise<any> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (page !== undefined) {
      params.set('page', String(page));
      params.set('page_size', String(pageSize ?? DEFAULT_PAGE_SIZE));
    }
    const qs = params.toString();
    return this.request(`/slaves/${qs ? `?${qs}` : ''}`);
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

  async getSitesList(opts?: { includeInactive?: boolean }): Promise<any[]> {
    const q = opts?.includeInactive ? '?include_inactive=1' : '';
    return this.request(`/sites/${q}`);
  }

  /** Operational sites only (commissioning + active) unless staff passes includeInactive. */
  async getAllSites(): Promise<any[]> {
    return this.getSitesList();
  }

  async getSiteStaffDetail(siteId: string): Promise<any> {
    const enc = encodeURIComponent(siteId);
    return this.request(`/sites/${enc}/detail/`);
  }

  async getNextSiteId(): Promise<{ site_id: string }> {
    return this.request('/sites/next-id/');
  }

  async createSiteStaff(data: Record<string, unknown>): Promise<any> {
    const result = await this.request('/sites/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    cacheService.clearPattern(/^sites/);
    cacheService.clearPattern(/^telemetry_/);
    return result;
  }

  async patchSiteStaff(siteId: string, data: Record<string, unknown>): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const result = await this.request(`/sites/${enc}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    cacheService.clearPattern(/^sites/);
    cacheService.clearPattern(/^telemetry_/);
    return result;
  }

  async siteLifecycle(siteId: string, toStatus: string): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const result = await this.request(`/sites/${enc}/lifecycle/`, {
      method: 'POST',
      body: JSON.stringify({ to_status: toStatus }),
    });
    cacheService.clearPattern(/^sites/);
    cacheService.clearPattern(/^telemetry_/);
    return result;
  }

  async siteAttachDevice(siteId: string, devicePk: number): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const result = await this.request(`/sites/${enc}/devices/${devicePk}/attach/`, { method: 'POST' });
    cacheService.clearPattern(/^sites/);
    cacheService.clearPattern(/^telemetry_/);
    return result;
  }

  async siteDetachDevice(siteId: string, devicePk: number): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const result = await this.request(`/sites/${enc}/devices/${devicePk}/detach/`, { method: 'POST' });
    cacheService.clearPattern(/^sites/);
    cacheService.clearPattern(/^telemetry_/);
    return result;
  }

  async siteMoveDevice(siteId: string, devicePk: number, fromSiteId: string): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const result = await this.request(`/sites/${enc}/devices/${devicePk}/move/`, {
      method: 'POST',
      body: JSON.stringify({ from_site_id: fromSiteId }),
    });
    cacheService.clearPattern(/^sites/);
    cacheService.clearPattern(/^telemetry_/);
    return result;
  }

  // Equipment
  async getSiteEquipment(siteId: string): Promise<{ inverters: any[]; batteries: any[]; panels: any[] }> {
    return this.request(`/sites/${siteId}/equipment/`);
  }

  async createInverter(siteId: string, data: any): Promise<any> {
    return this.request(`/sites/${siteId}/inverters/`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateInverter(siteId: string, pk: number, data: any): Promise<any> {
    return this.request(`/sites/${siteId}/inverters/${pk}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteInverter(siteId: string, pk: number): Promise<any> {
    return this.request(`/sites/${siteId}/inverters/${pk}/delete/`, { method: 'DELETE' });
  }

  async createBattery(siteId: string, data: any): Promise<any> {
    return this.request(`/sites/${siteId}/batteries/`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateBattery(siteId: string, pk: number, data: any): Promise<any> {
    return this.request(`/sites/${siteId}/batteries/${pk}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteBattery(siteId: string, pk: number): Promise<any> {
    return this.request(`/sites/${siteId}/batteries/${pk}/delete/`, { method: 'DELETE' });
  }

  async createPanel(siteId: string, data: any): Promise<any> {
    return this.request(`/sites/${siteId}/panels/`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updatePanel(siteId: string, pk: number, data: any): Promise<any> {
    return this.request(`/sites/${siteId}/panels/${pk}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deletePanel(siteId: string, pk: number): Promise<any> {
    return this.request(`/sites/${siteId}/panels/${pk}/delete/`, { method: 'DELETE' });
  }

  async getDevices(search?: string, page: number = 1, pageSize: number = DEFAULT_PAGE_SIZE): Promise<any> {
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

  async patchDevice(deviceId: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/devices/${deviceId}/`, {
      method: 'PATCH',
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

  async muteDeviceAlerts(deviceId: number, hours: number | null): Promise<any> {
    const body = hours === null ? { indefinite: true } : { hours };
    return this.request(`/devices/${deviceId}/mute-alerts/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async unmuteDeviceAlerts(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/unmute-alerts/`, {
      method: 'DELETE',
    });
  }

  async getDeviceLogs(deviceId: number, limit: number = 500, offset: number = 0, start?: string, end?: string): Promise<any> {
    let url = `/devices/${deviceId}/logs/?limit=${limit}&offset=${offset}`;
    if (start) url += `&start=${encodeURIComponent(start)}`;
    if (end) url += `&end=${encodeURIComponent(end)}`;
    return this.request(url);
  }

  async getDeviceLogFiles(deviceId: number, limit = 20, offset = 0, start?: string, end?: string): Promise<any> {
    let url = `/devices/${deviceId}/logs/files/?limit=${limit}&offset=${offset}`;
    if (start) url += `&start=${encodeURIComponent(start)}`;
    if (end) url += `&end=${encodeURIComponent(end)}`;
    return this.request(url);
  }

  async bulkDownloadLogFiles(deviceId: number, start?: string, end?: string): Promise<void> {
    let url = `${API_BASE_URL}/devices/${deviceId}/logs/files/bulk-download/`;
    const params: string[] = [];
    if (start) params.push(`start=${encodeURIComponent(start)}`);
    if (end) params.push(`end=${encodeURIComponent(end)}`);
    if (params.length) url += `?${params.join('&')}`;
    const response = await fetch(url, { headers: this.getAuthHeaders() });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Bulk download failed: ${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `logs_${deviceId}.txt`;
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objUrl);
  }

  async getDeviceLogFileDownloadUrl(deviceId: number, fileId: number): Promise<{ url: string; filename: string }> {
    return this.request(`/devices/${deviceId}/logs/files/${fileId}/download/`);
  }


  async getRegisterCoverage(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/register-coverage/`);
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

  async uploadFirmwareVersion(formData: FormData, onProgress?: (pct: number) => void): Promise<any> {
    const url = `${API_BASE_URL}/ota/firmware/create/`;
    const tokens = localStorage.getItem('authTokens');
    if (!tokens) throw new Error('Authentication required');
    const parsedTokens = JSON.parse(tokens);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Bearer ${parsedTokens.access}`);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.onload = () => {
        if (xhr.status === 401) {
          localStorage.removeItem('authTokens');
          localStorage.removeItem('authUser');
          window.location.href = '/login';
          return reject(new Error('Authentication required'));
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          return reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
        }
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Invalid response from server'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
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

  async getOTADevices(): Promise<any[]> {
    return this.request(`/ota/devices/status/`);
  }

  async cancelTargetedUpdate(updateId: number): Promise<any> {
    return this.request(`/ota/updates/${updateId}/cancel/`, { method: 'POST' });
  }

  async getTargetedUpdate(updateId: number): Promise<any> {
    return this.request(`/ota/updates/${updateId}/`);
  }

  async getAlertsAnalytics(days = 90, device?: string, site?: string): Promise<AlertAnalyticsResponse> {
    const params = new URLSearchParams({ days: String(days) });
    if (device) params.set('device', device);
    if (site) params.set('site', site);
    return this.request(`/alerts/analytics/?${params}`);
  }
}

export const apiService = new ApiService();