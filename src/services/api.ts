import { cacheService, DEFAULT_TTL } from './cacheService';
import { DEFAULT_PAGE_SIZE } from '../app/constants';

// ─── CT Energy Meter ──────────────────────────────────────────────────────────

export interface CtMeterReading {
  timestamp: string;
  node_id: string;
  voltage_l1: number | null;
  voltage_l2: number | null;
  voltage_l3: number | null;
  current_l1: number | null;
  current_l2: number | null;
  current_l3: number | null;
  frequency_l1: number | null;
  frequency_l2: number | null;
  frequency_l3: number | null;
  active_power_l1: number | null;
  active_power_l2: number | null;
  active_power_l3: number | null;
  active_power_total: number | null;
  reactive_power_l1: number | null;
  reactive_power_l2: number | null;
  reactive_power_l3: number | null;
  reactive_power_total: number | null;
  apparent_power_l1: number | null;
  apparent_power_l2: number | null;
  apparent_power_l3: number | null;
  apparent_power_total: number | null;
  power_factor_l1: number | null;
  power_factor_l2: number | null;
  power_factor_l3: number | null;
  power_factor_total: number | null;
}

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
  site_id?: string;
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

// ─── Incident item (Phase C /incidents/, /data-quality-gaps/, /uptime/) ───────

export type IncidentCategory =
  | 'hardware' | 'connectivity' | 'data_quality' | 'weather_environmental' | 'maintenance' | 'grid';

export type IncidentStatus = 'active' | 'acknowledged' | 'resolved';

export interface IncidentItem {
  id: number;
  deviceId: number | null;
  deviceSerial: string | null;
  category: IncidentCategory;
  incidentType: string;
  incidentTypeTitle: string;
  severity: 'critical' | 'warning' | 'info';
  status: IncidentStatus;
  tsStart: string;
  tsEnd: string | null;
  durationSeconds: number | null;
  title: string;
  summary: string;
  detectedBy: string;
  evidenceCount: number;
}

export interface SiteIncidentsResponse {
  count: number;
  limit: number;
  offset: number;
  results: IncidentItem[];
}

function _mapIncidentDict(raw: any): IncidentItem {
  return {
    id: raw.id,
    deviceId: raw.device_id ?? null,
    deviceSerial: raw.device_serial ?? null,
    category: raw.category,
    incidentType: raw.incident_type,
    incidentTypeTitle: raw.incident_type_title,
    severity: raw.severity,
    status: raw.status,
    tsStart: raw.ts_start,
    tsEnd: raw.ts_end ?? null,
    durationSeconds: raw.duration_seconds ?? null,
    title: raw.title,
    summary: raw.summary ?? '',
    detectedBy: raw.detected_by,
    evidenceCount: raw.evidence_count ?? 0,
  };
}

export type BookingStatus = 'pending' | 'scheduled' | 'completed' | 'closed' | 'cancelled';

export interface Technician {
  id: number;
  vendor: number;
  vendor_company?: string;
  name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceVendor {
  id: number;
  company_name: string;
  technician_name: string;
  phone: string;
  email: string;
  is_active: boolean;
  technicians?: Technician[];
  created_at: string;
  updated_at: string;
}

export interface ServiceBooking {
  id: number;
  booking_number: string;
  customer: number;
  customer_name?: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  site: number;
  site_id: string;
  site_name?: string;
  site_latitude?: number | null;
  site_longitude?: number | null;
  issue_category: 'panel' | 'inverter' | 'battery' | 'monitoring' | 'cleaning' | 'other';
  issue_description: string;
  status: BookingStatus;
  preferred_date: string | null;
  preferred_slot: 'morning' | 'afternoon' | '';
  vendor: number | null;
  vendor_company?: string | null;
  vendor_name?: string | null;
  vendor_phone?: string | null;
  // Who's actually showing up for this visit — the assigned roster
  // Technician if one was picked, else the vendor's default contact
  // (vendor_name/vendor_phone). Prefer these two for "who to expect".
  technician: number | null;
  technician_name?: string | null;
  technician_phone?: string | null;
  service_date: string | null;
  service_time: string | null;
  technician_notes: string;
  created_at: string;
  updated_at: string;
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

// ─── Appliance Inventory (Phase 3A) ────────────────────────────────────────

export interface SiteProfile {
  // ── Topology (Gateway Settings) ─────────────────────────────────────────
  inverter_model: string;
  firmware_version: string;
  work_mode: string;
  ct_present: boolean;
  ct_placement: string;
  meter_present: boolean;
  whole_home_backup: boolean;
  topology_type: string;
  zero_export_enabled: boolean;
  grid_charge_enabled: boolean;
  time_of_use_active: boolean;

  // ── Appliances (Appliances tab / CommissioningWizard) ────────────────────
  num_ac_units: number;
  ac_total_capacity_kw: number | null;
  ac_typical_setpoint_c: number | null;
  num_geysers: number;
  geyser_total_capacity_kw: number | null;
  geyser_type: 'instant' | 'storage_tank' | 'solar_backup' | '';
  num_refrigerators: number;
  num_washing_machines: number;
  num_ev_chargers: number;
  ev_type: 'two_wheeler' | 'three_wheeler' | 'four_wheeler' | '';
  ev_typical_charging_capacity_kw: number | null;
  has_water_pump: boolean;
  water_pump_capacity_hp: number | null;
  has_microwave: boolean;
  has_desert_cooler: boolean;
  estimated_household_daily_kwh: number | null;
  appliance_notes: string;
  appliance_inventory_source: 'installation_survey' | 'load_inference' | 'user_reported' | '';

  // ── Inverter circuit counts ──────────────────────────────────────────────
  ac_units_on_inverter: number | null;
  geysers_on_inverter: number | null;
  ev_charger_on_inverter: boolean | null;
  pump_on_inverter: boolean | null;
  ct_load_forecast_enabled: boolean;

  // ── Audit ────────────────────────────────────────────────────────────────
  last_updated?: string;
}

// Backward-compat alias — remove once all callers use SiteProfile directly
export type ApplianceInventory = SiteProfile;

// ── Product Catalog types ──────────────────────────────────────────────────
export type ProductCatalogCategory =
  | 'panels' | 'inverters' | 'batteries'
  | 'dcdb' | 'acdb' | 'mounting' | 'earthing' | 'lightning'
  | 'mc4' | 'wiring' | 'accessories' | 'installation' | 'iot';

export interface ProductCatalogItem {
  id: number;
  category: ProductCatalogCategory;
  brand: string;
  model_name: string;
  specs: Record<string, unknown>;          // {wp, dcr, technology} | {kw, phases, type} | {kwh, chemistry}
  price_per_unit: string;                  // decimal string from DRF
  price_unit: string;                      // 'Wp' | 'nos' | 'kWh'
  display_label: string;                   // computed by backend
  unit_price_per_panel: number;            // price_per_unit × specs.wp (panels only)
  in_stock: boolean;
  stock_notes: string;
  retail_or_pallet: string;
  dealer_name: string;
  dealer_location: string;
  price_updated_on: string | null;
  margin_pct: string;
  gst_pct: string;
  sort_order: number;
  is_active: boolean;
  updated_at: string;
}

// ── Quotation types ────────────────────────────────────────────────────────
export interface QuotationListItem {
  id: number;
  public_id: string;
  quote_number: string;
  revision_number: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  customer_name: string;
  customer_phone: string;
  system_type: string;
  system_kw: string;
  net_investment: string;
  currency: string;
  valid_until: string;
  pdf_status: string;
  is_archived: boolean;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface QuotationDetail extends QuotationListItem {
  schema_version: number;
  version: number;
  site_address: string;
  snapshot_hash: string;
  form_data: Record<string, unknown>;
  pricing_snapshot: Record<string, unknown>;
  root_quote_number: string | null;
  parent_quote_number: string | null;
  pdf_url: string | null;
  pdf_checksum: string;
  pdf_generated_at: string | null;
  pdf_status_updated_at: string | null;
  notes: string;
  sent_at: string | null;
  accepted_at: string | null;
  events: QuotationEvent[];
}

export interface QuotationEvent {
  id: number;
  event_type: string;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
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
      // DRF field-level validation errors: { field: ["msg", ...], ... }
      if (typeof body === 'object' && body !== null) return JSON.stringify(body);
    } catch {
      // ignore
    }
    return text || `API request failed: ${response.status} ${response.statusText}`;
  }

  async request_(endpoint: string, options: RequestInit = {}): Promise<any> {
    return this.request(endpoint, options);
  }

  // Per-endpoint 429 cooldown shared by every caller (pollers, retries, etc.) that routes
  // through request() — without this, each caller's own setInterval keeps retrying into the
  // same throttle window and the backend never gets a chance to recover.
  private throttleCooldowns = new Map<string, number>();

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    // Keyed on path only, not the full querystring — polling with a changing page/search
    // param would otherwise mint a fresh cooldown key every tick and never actually cool down.
    const cooldownKey = endpoint.split('?')[0];
    const cooldownUntil = this.throttleCooldowns.get(cooldownKey);
    if (cooldownUntil && Date.now() < cooldownUntil) {
      throw new Error('Request was throttled. Expected available in ' +
        Math.ceil((cooldownUntil - Date.now()) / 1000) + ' seconds.');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    let headers = this.getAuthHeaders();

    // Backend request timeout — long enough for cold starts, short enough to fail fast.
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Server is warming up — please try again in a moment.', 'AbortError')),
      15000,
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
          12000,
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
      if (response.status === 429) {
        const retryAfterHeader = Number(response.headers.get('Retry-After'));
        const match = message.match(/(\d+)\s*seconds?/i);
        const waitSeconds = retryAfterHeader || (match ? Number(match[1]) : 10);
        this.throttleCooldowns.set(cooldownKey, Date.now() + (waitSeconds + 1) * 1000);
      }
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

  invalidateAlertsCache(): void {
    cacheService.clear('alerts_manage');
  }

  // Incident (Phase C/D) → AlertItem shape, for consumers not yet migrated to
  // the native IncidentItem type (MobileAlerts.tsx, Dashboard.tsx, Devices.tsx).
  // Backed by /incidents/*, not the removed
  // /api/alerts/* shim.
  private _incidentToAlertItem(inc: any): AlertItem {
    return {
      id: String(inc.id),
      type: inc.incident_type ?? '',
      severity: inc.severity,
      message: inc.summary || inc.title || '',
      device_id: inc.device_serial ?? '',
      device_serial: inc.device_serial ?? undefined,
      timestamp: inc.ts_start ?? '',
      resolved: inc.status === 'resolved',
      generated: false,
      fault_code: inc.incident_type ?? undefined,
      status: inc.status,
    };
  }

  async getAlerts(): Promise<AlertItem[]> {
    const cacheKey = 'alerts_manage';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const raw = await this.request('/incidents/');
    const data: AlertItem[] = (raw.results || []).map((inc: any) => this._incidentToAlertItem(inc));

    cacheService.set(cacheKey, data, DEFAULT_TTL);
    return data;
  }


  async getSiteIncidents(
    siteId: string,
    opts?: { limit?: number; offset?: number; category?: IncidentCategory; status?: IncidentStatus },
  ): Promise<SiteIncidentsResponse> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.category) params.set('category', opts.category);
    if (opts?.status) params.set('status', opts.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const raw = await this.request(`/sites/${encodeURIComponent(siteId)}/incidents/${qs}`);
    return {
      count: raw.count,
      limit: raw.limit,
      offset: raw.offset,
      results: (raw.results || []).map(_mapIncidentDict),
    };
  }

  // Fleet-wide incidents, backed by GET /api/incidents/ (Incident-native;
  // replaces the old Alert-shaped /alerts/manage/ shim removed in Phase D Task 11).
  async getIncidents(opts?: { limit?: number; offset?: number; category?: IncidentCategory; status?: IncidentStatus }): Promise<SiteIncidentsResponse> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.category) params.set('category', opts.category);
    if (opts?.status) params.set('status', opts.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const raw = await this.request(`/incidents/${qs}`);
    return {
      count: raw.count,
      limit: raw.limit,
      offset: raw.offset,
      results: (raw.results || []).map(_mapIncidentDict),
    };
  }

  async acknowledgeIncident(incidentId: number): Promise<IncidentItem> {
    const raw = await this.request(`/incidents/${incidentId}/acknowledge/`, { method: 'POST' });
    return _mapIncidentDict(raw);
  }

  async resolveIncident(incidentId: number): Promise<IncidentItem> {
    const raw = await this.request(`/incidents/${incidentId}/resolve/`, { method: 'POST' });
    return _mapIncidentDict(raw);
  }

  async getSiteDataQualityGaps(siteId: string, start: string, end: string): Promise<Array<{
    tsStart: string; tsEnd: string; category: IncidentCategory; incidentType: string; severity: string;
  }>> {
    const params = new URLSearchParams({ start, end });
    const raw: any[] = await this.request(`/sites/${encodeURIComponent(siteId)}/data-quality-gaps/?${params.toString()}`);
    return raw.map(g => ({
      tsStart: g.ts_start, tsEnd: g.ts_end, category: g.category, incidentType: g.incident_type, severity: g.severity,
    }));
  }

  async getSiteUptime(siteId: string, days = 30): Promise<{
    rollingAvgUptimePct: number | null;
    dailyScores: Array<{ reportDate: string; uptimePct: number; totalExpectedSlots: number; impactedSlots: number; impactedSlotsByCategory: Record<string, number> }>;
  }> {
    const raw = await this.request(`/sites/${encodeURIComponent(siteId)}/uptime/?days=${days}`);
    return {
      rollingAvgUptimePct: raw.rolling_avg_uptime_pct,
      dailyScores: (raw.daily_scores || []).map((s: any) => ({
        reportDate: s.report_date, uptimePct: s.uptime_pct,
        totalExpectedSlots: s.total_expected_slots, impactedSlots: s.impacted_slots,
        impactedSlotsByCategory: s.impacted_slots_by_category || {},
      })),
    };
  }

  async diagnoseBatch(): Promise<DiagnoseBatchResponse> {
    return this.request('/incidents/diagnose-batch/', { method: 'POST' });
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

  async sendPrecreationOtp(email: string): Promise<{ message: string }> {
    return this.request('/auth/send-precreation-otp/', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async confirmPrecreationOtp(email: string, otp: string): Promise<{ verified: boolean }> {
    return this.request('/auth/confirm-precreation-otp/', { method: 'POST', body: JSON.stringify({ email, otp }) });
  }

  async checkEmailVerified(email: string): Promise<{ verified: boolean }> {
    return this.request(`/auth/check-email-verified/?email=${encodeURIComponent(email)}`);
  }

  async checkContactAvailable(field: 'email' | 'phone', value: string): Promise<{ available: boolean; field: string }> {
    const param = field === 'email' ? `email=${encodeURIComponent(value)}` : `phone=${encodeURIComponent(value)}`;
    return this.request(`/auth/check-contact/?${param}`);
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
    const result = await this.request('/employees/create/', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
    cacheService.clearPattern(/^users_/);
    cacheService.clearPattern(/^employees_/);
    return result;
  }

  async updateEmployee(id: number, data: any): Promise<any> {
    const result = await this.request(`/employees/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    cacheService.clearPattern(/^users_/);
    cacheService.clearPattern(/^employees_/);
    return result;
  }

  async deleteEmployee(id: number): Promise<any> {
    return this.request(`/employees/${id}/delete/`, {
      method: 'DELETE',
    });
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

  // Smart device sub-metering (EV charger, CT clamps, etc.)
  async getEVPlugLatest(siteId: string): Promise<{ power_w: number | null; current_a: number | null; voltage_v: number | null; energy_kwh: number | null; switch_on: boolean | null; timestamp: string } | null> {
    try {
      const cacheKey = `ev_plug_${siteId}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
      const data = await this.request(`/sites/${siteId}/ev-plug/latest/`);
      cacheService.set(cacheKey, data, 55 * 1000); // 55-second cache, same as telemetry
      return data;
    } catch (error) {
      // 404 = no EV charger configured for this site, expected for most sites
      const msg = error instanceof Error ? error.message : '';
      if (!msg || msg.includes('404') || msg.toLowerCase().includes('ev charger')) return null;
      console.warn('getEVPlugLatest error:', error);
      return null;
    }
  }

  async getSmartDevices(siteId: string): Promise<any[]> {
    try {
      const data = await this.request(`/sites/${siteId}/smart-devices/`);
      return data ?? [];
    } catch (error) {
      console.warn('getSmartDevices error:', error);
      return [];
    }
  }

  async getSmartDeviceReadings(deviceId: number, hours: number = 24): Promise<{ timestamp: string; power_w: number | null }[]> {
    try {
      const data = await this.request(`/smart-devices/${deviceId}/readings/?hours=${hours}`);
      return data ?? [];
    } catch (error) {
      console.warn('getSmartDeviceReadings error:', error);
      return [];
    }
  }

  async createSmartDevice(siteId: string, data: Record<string, unknown>): Promise<any> {
    return this.request(`/sites/${siteId}/smart-devices/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSmartDevice(deviceId: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/smart-devices/${deviceId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSmartDevice(deviceId: number): Promise<any> {
    return this.request(`/smart-devices/${deviceId}/`, {
      method: 'DELETE',
    });
  }

  async getLatestEnergyMeter(siteId: string): Promise<CtMeterReading | null> {
    try {
      return await this.request(`/sites/${siteId}/energy-meter/latest/`);
    } catch {
      return null;
    }
  }

  async getEnergyMeterHistory(siteId: string, params: { start_date: string; end_date: string; aggregate?: '5min' | '15min' }): Promise<any[]> {
    const query = new URLSearchParams({ start_date: params.start_date, end_date: params.end_date });
    if (params.aggregate) query.append('aggregate', params.aggregate);
    try {
      return await this.request(`/sites/${siteId}/energy-meter/history/?${query.toString()}`);
    } catch {
      return [];
    }
  }

  async getGatewayStatus(siteId: string): Promise<{ is_online: boolean; last_heartbeat: string | null; age_seconds: number | null; serial: string | null } | null> {
    try {
      return await this.request(`/sites/${siteId}/gateway-status/`);
    } catch {
      return null;
    }
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
    // Round end_date to the nearest 5s for the cache key only (not the request itself) —
    // React StrictMode double-invokes mount effects in dev, firing this twice a few ms
    // apart with a millisecond-precision `now`, which produced two different cache keys
    // and defeated dedup entirely.
    const roundedEnd = params?.end_date
      ? new Date(Math.round(new Date(params.end_date).getTime() / 5000) * 5000).toISOString()
      : '';
    const cacheKey = `telemetry_${siteId}_${params?.start_date ?? ''}_${roundedEnd}_${params?.days ?? ''}_${params?.aggregate ?? ''}`;
    return cacheService.dedup(cacheKey, () => this.request(url), 55 * 1000);
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
    return cacheService.dedup(cacheKey, () => this.request(url), 15 * 60 * 1000);
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
    return cacheService.dedup(cacheKey, () => this.request(`/sites/${siteId}/weather/`), 15 * 60 * 1000);
  }

  async getPhaseLoad(siteId: string, hours: number = 24, aggregate: string = 'hourly'): Promise<any[]> {
    const enc = encodeURIComponent(siteId);
    const cacheKey = `phase_load_${siteId}_${hours}_${aggregate}`;
    // dedup (not a plain get/set check) — SiteDataPanel fires this from two separate
    // effects on mount with identical params; a plain cache check lets both fire before
    // either resolves and populates it, so this needs to share the in-flight promise.
    return cacheService.dedup(cacheKey, () => this.request(`/sites/${enc}/phase-load/?hours=${hours}&aggregate=${aggregate}`), 5 * 60 * 1000);
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

  async getLoadForecast(siteId: string, days: number = 2): Promise<any[]> {
    const enc = encodeURIComponent(siteId);
    const cacheKey = `load_forecast_${siteId}_${days}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    const data = await this.request(`/sites/${enc}/load-forecast/?days=${days}`);
    cacheService.set(cacheKey, data, 2 * 60 * 1000); // 2 min — scheduler runs every 15 min
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

  async uploadProfilePicture(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('avatar', file);

    // Don't use this.request() for FormData because it adds JSON Content-Type
    // Instead, use fetch directly with only Authorization header
    const tokens = localStorage.getItem('authTokens');
    const headers: HeadersInit = {};
    if (tokens) {
      try {
        const parsedTokens = JSON.parse(tokens);
        headers['Authorization'] = `Bearer ${parsedTokens.access}`;
      } catch (error) {
        console.error('Error parsing auth tokens:', error);
      }
    }

    const url = `${API_BASE_URL}/profile-picture/`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
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

  // ─── Site Profile (topology + appliances + circuit) ─────────────────────
  // Single endpoint: GET/PATCH /api/sites/<id>/profile/
  // Callers send only the fields they own — Gateway Settings sends topology fields,
  // Appliances tab sends appliance/circuit fields, CommissioningWizard sends appliances.

  async getSiteProfile(siteId: string): Promise<SiteProfile> {
    const enc = encodeURIComponent(siteId);
    return this.request(`/sites/${enc}/profile/`);
  }

  async updateSiteProfile(
    siteId: string,
    data: Partial<SiteProfile>
  ): Promise<SiteProfile> {
    const enc = encodeURIComponent(siteId);
    const result = await this.request(`/sites/${enc}/profile/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    cacheService.clearPattern(/^sites/);
    return result;
  }

  // Backward-compat aliases — kept so CommissioningWizard and SiteDetail compile unchanged
  async getSiteProfileAppliances(siteId: string): Promise<SiteProfile> {
    return this.getSiteProfile(siteId);
  }
  async updateSiteProfileAppliances(siteId: string, data: Partial<SiteProfile>): Promise<SiteProfile> {
    return this.updateSiteProfile(siteId, data);
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

  // Sets/clears which device this device's energy-meter reading mirrors (e.g. a
  // gateway relaying the same CT meter its RS-485 bus also reaches). Pass
  // mirrorsDevicePk: null to clear. Auto-linked by the backend for the
  // unambiguous 1-gateway/1-meter case — this is the manual override for sites
  // with zero or multiple energy meters.
  async siteSetDeviceMirror(
    siteId: string,
    devicePk: number,
    mirrorsDevicePk: number | null,
    mirrorsNodeId?: string,
  ): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const result = await this.request(`/sites/${enc}/devices/${devicePk}/mirror/`, {
      method: 'POST',
      body: JSON.stringify({ mirrors_device_pk: mirrorsDevicePk, mirrors_node_id: mirrorsNodeId ?? '' }),
    });
    cacheService.clearPattern(/^sites/);
    return result;
  }

  async deleteSite(siteId: string): Promise<void> {
    const enc = encodeURIComponent(siteId);
    await this.request(`/sites/${enc}/`, {
      method: 'DELETE',
    });
    cacheService.clearPattern(/^sites/);
    cacheService.clearPattern(/^telemetry_/);
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

  async getArchivedDevices(search?: string, deviceType?: 'gateway' | 'energy_meter'): Promise<any> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (deviceType) params.append('device_type', deviceType);
    const queryString = params.toString();
    return this.request(`/devices/archived/${queryString ? `?${queryString}` : ''}`);
  }

  async restoreDevice(deviceSerial: string): Promise<any> {
    return this.request('/devices/create/', {
      method: 'POST',
      body: JSON.stringify({ device_serial: deviceSerial }),
    });
  }

  /** Permanently delete a single archived device. Irreversible — admin-only on the backend. */
  async hardDeleteArchivedDevice(deviceId: number): Promise<any> {
    return this.request(`/devices/archived/${deviceId}/hard-delete/`, { method: 'DELETE' });
  }

  /** Permanently delete multiple archived devices. Each id is processed independently server-side. */
  async hardDeleteArchivedDevicesBulk(deviceIds: number[]): Promise<any> {
    return this.request('/devices/archived/hard-delete-bulk/', {
      method: 'POST',
      body: JSON.stringify({ device_ids: deviceIds }),
    });
  }

  async updateDevice(deviceId: number, data: any): Promise<any> {
    return this.request(`/devices/${deviceId}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getDevice(deviceId: number): Promise<any> {
    return this.request(`/devices/${deviceId}/`);
  }

  async patchDevice(deviceId: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/devices/${deviceId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDevice(deviceId: number, options?: {
    revoke_iot?: boolean;
    delete_config?: boolean;
    delete_alerts?: boolean;
    delete_logs?: boolean;
  }): Promise<any> {
    return this.request(`/devices/${deviceId}/delete/`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options ?? {}),
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

  async getDeviceLogFileContent(deviceId: number, fileId: number): Promise<string> {
    const url = `${API_BASE_URL}/devices/${deviceId}/logs/files/${fileId}/content/`;
    const response = await fetch(url, { headers: this.getAuthHeaders() });
    if (!response.ok) throw new Error(`Failed to fetch log content: ${response.status}`);
    return response.text();
  }

  async scanDeviceLogFiles(deviceId: number, date: string): Promise<{
    date: string;
    files_scanned: number;
    total_errors: number;
    total_warnings: number;
    results: { filename: string; errors: { line: number; text: string }[]; warnings: { line: number; text: string }[]; fetch_error?: boolean }[];
  }> {
    return this.request(`/devices/${deviceId}/logs/files/scan/?date=${date}`);
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
    return this.request(`/incidents/analytics/?${params}`);
  }

  async getServiceBookings(status?: BookingStatus): Promise<ServiceBooking[]> {
    const params = status ? `?status=${status}` : '';
    return this.request(`/bookings/all/${params}`);
  }

  async assignVendor(
    bookingId: number,
    vendorId: number,
    serviceDate: string,
    serviceTime: string,
    technicianId?: number | null,
    mode: 'assign' | 'reassign' = 'assign',
  ): Promise<ServiceBooking> {
    return this.request(`/bookings/${bookingId}/${mode}/`, {
      method: 'POST',
      body: JSON.stringify({
        vendor_id: vendorId,
        service_date: serviceDate,
        service_time: serviceTime,
        ...(technicianId ? { technician_id: technicianId } : {}),
      }),
    });
  }

  async updateBookingStatus(
    bookingId: number,
    nextStatus: 'completed' | 'closed',
    technicianNotes?: string,
  ): Promise<ServiceBooking> {
    return this.request(`/bookings/${bookingId}/status/`, {
      method: 'POST',
      body: JSON.stringify({ status: nextStatus, technician_notes: technicianNotes ?? '' }),
    });
  }

  async getServiceVendors(): Promise<ServiceVendor[]> {
    return this.request('/service-vendors/');
  }

  async createServiceVendor(vendor: {
    company_name: string;
    technician_name: string;
    phone: string;
    email?: string;
  }): Promise<ServiceVendor> {
    return this.request('/service-vendors/', { method: 'POST', body: JSON.stringify(vendor) });
  }

  async getTechnicians(vendorId?: number): Promise<Technician[]> {
    const params = vendorId ? `?vendor=${vendorId}` : '';
    return this.request(`/technicians/${params}`);
  }

  async createTechnician(technician: { vendor: number; name: string; phone: string }): Promise<Technician> {
    return this.request('/technicians/', { method: 'POST', body: JSON.stringify(technician) });
  }

  async getFleetHealthReport(reportIdOrDate?: string | number | null): Promise<any> {
    const params = new URLSearchParams();
    if (reportIdOrDate) {
      if (typeof reportIdOrDate === 'number') {
        params.set('report_id', String(reportIdOrDate));
      } else {
        params.set('date', reportIdOrDate);
      }
    }
    const query = params.toString() ? `?${params}` : '';
    return this.request(`/fleet-health/daily-report/${query}`);
  }

  // ─── Departments ────────────────────────────────────────────────────────────

  async getDepartments(): Promise<{ results: any[]; count?: number; total_pages?: number }> {
    return this.request('/departments/');
  }

  async createDepartment(data: { name: string; slug: string; description?: string }): Promise<any> {
    return this.request('/departments/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDepartment(id: number, data: { name?: string; slug?: string; description?: string; is_active?: boolean }): Promise<any> {
    return this.request(`/departments/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDepartment(id: number): Promise<any> {
    return this.request(`/departments/${id}/delete/`, {
      method: 'DELETE',
    });
  }

  async getEquipmentPrices(): Promise<any[]> {
    return this.request('/equipment-prices/');
  }

  async createEquipmentPrice(data: Record<string, unknown>): Promise<any> {
    return this.request('/equipment-prices/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateEquipmentPrice(id: number, data: Record<string, unknown>): Promise<any> {
    return this.request(`/equipment-prices/${id}/`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteEquipmentPrice(id: number): Promise<void> {
    return this.request(`/equipment-prices/${id}/`, { method: 'DELETE' });
  }

  // ── Product Catalog ────────────────────────────────────────────────────────

  async getProductCatalog(category?: 'panels' | 'inverters' | 'batteries'): Promise<ProductCatalogItem[]> {
    const url = category ? `/product-catalog/?category=${category}` : '/product-catalog/';
    return this.request(url);
  }

  async createProductCatalogItem(data: Partial<ProductCatalogItem>): Promise<ProductCatalogItem> {
    return this.request('/product-catalog/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateProductCatalogItem(id: number, data: Partial<ProductCatalogItem>): Promise<ProductCatalogItem> {
    return this.request(`/product-catalog/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteProductCatalogItem(id: number): Promise<void> {
    return this.request(`/product-catalog/${id}/`, { method: 'DELETE' });
  }

  // ── Quotation API ──────────────────────────────────────────────────────────

  async listQuotations(params?: {
    status?: string;
    customer_name?: string;
    search?: string;
    page?: number;
  }): Promise<{ results: QuotationListItem[]; total: number; page: number; page_size: number; total_pages: number; next_cursor: string | null }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.customer_name) qs.set('customer_name', params.customer_name);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/v1/quotations/${query}`);
  }

  async deleteQuotation(publicId: string): Promise<void> {
    await this.archiveQuotation(publicId);
  }

  async createQuotation(data: Record<string, unknown>, idempotencyKey?: string): Promise<QuotationDetail> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return this.request('/v1/quotations/', {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  async getQuotation(publicId: string): Promise<QuotationDetail> {
    return this.request(`/v1/quotations/${publicId}/`);
  }

  async patchQuotation(publicId: string, data: Record<string, unknown>): Promise<QuotationDetail> {
    return this.request(`/v1/quotations/${publicId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async sendQuotation(publicId: string, data: { delivery_method: string; recipient_contact?: string; message?: string }): Promise<QuotationDetail> {
    return this.request(`/v1/quotations/${publicId}/send/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async acceptQuotation(publicId: string, data?: { notes?: string }): Promise<QuotationDetail> {
    return this.request(`/v1/quotations/${publicId}/accept/`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
  }

  async rejectQuotation(publicId: string, data: { reason: string }): Promise<QuotationDetail> {
    return this.request(`/v1/quotations/${publicId}/reject/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async reviseQuotation(publicId: string, data: Record<string, unknown>, idempotencyKey?: string): Promise<QuotationDetail> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return this.request(`/v1/quotations/${publicId}/revise/`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers,
    });
  }

  async extendQuotationValidity(publicId: string, data: { valid_until: string }): Promise<QuotationDetail> {
    return this.request(`/v1/quotations/${publicId}/extend-validity/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async archiveQuotation(publicId: string): Promise<QuotationDetail> {
    return this.request(`/v1/quotations/${publicId}/archive/`, { method: 'POST', body: '{}' });
  }

  async getQuotationPdf(publicId: string): Promise<{ pdf_status: string; pdf_url: string | null; pdf_generated_at: string | null }> {
    return this.request(`/v1/quotations/${publicId}/pdf/`);
  }

  async requestQuotationPdf(publicId: string): Promise<{ detail: string; pdf_status: string }> {
    return this.request(`/v1/quotations/${publicId}/pdf/`, { method: 'POST', body: '{}' });
  }

  async getQuotationEvents(publicId: string): Promise<QuotationEvent[]> {
    return this.request(`/v1/quotations/${publicId}/events/`);
  }

  // Password management
  async changePassword(data: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ message: string; access_token: string }> {
    return this.request('/profile/change-password/', { method: 'PUT', body: JSON.stringify(data) });
  }

  async requestPasswordResetOTP(data: { email: string }): Promise<{ message: string; expires_in_seconds: number }> {
    return this.request('/auth/password/request-otp/', { method: 'POST', body: JSON.stringify(data) });
  }

  async verifyPasswordResetOTP(data: { email: string; otp: string }): Promise<{ reset_token: string; expires_in_seconds: number }> {
    return this.request('/auth/password/verify-otp/', { method: 'POST', body: JSON.stringify(data) });
  }

  async resetPassword(data: { reset_token: string; new_password: string; confirm_password: string }): Promise<{ message: string; login_url: string }> {
    return this.request('/auth/password/reset/', { method: 'POST', body: JSON.stringify(data) });
  }

  async verifyEmail(data: { email: string; otp: string }): Promise<{ access: string; refresh: string; user: any }> {
    return this.request('/auth/verify-email/', { method: 'POST', body: JSON.stringify(data) });
  }

  async resendVerificationEmail(data: { email: string }): Promise<{ message: string }> {
    return this.request('/auth/resend-verification/', { method: 'POST', body: JSON.stringify(data) });
  }

  async getSiteHardwareHealth(siteId: string, days = 7): Promise<HardwareHealthData> {
    return this.request(`/sites/${siteId}/hardware-health/?days=${days}`);
  }

  async getSiteSavings(siteId: string): Promise<SiteSavingsData> {
    const res = await this.request(`/sites/${siteId}/savings/latest/`);
    return res.data ?? res;
  }

  async updateSavingsRecord(siteId: string, payload: UpdateSavingsRecordPayload): Promise<SiteSavingsData> {
    const res = await this.request(`/sites/${siteId}/savings/record/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return res.data ?? res;
  }
}

export const apiService = new ApiService();

// ─── Savings & ROI ───────────────────────────────────────────────────────────

export interface SiteSavingsData {
  id: number;
  electricityBill: {
    amount: number;
    period: string;
    billingMonths: number;
    status: string;
  };
  consumption: {
    totalUnitsWithoutSolar: number;
    solarUnits: number;
    ebImportUnits: number;
    ebExportUnits: number;
    evUnits: number;
  };
  savings: {
    billWithoutSolar: number;
    savingsAmount: number;
    savingsPercentage: number;
  };
  investment: {
    upfrontAmount: number;
    savedAmount: number;
    paybackPercentage: number;
    remainingInvestment: number;
    monthsToBreakEven: number;
    breakEvenDate: string;
  };
}

export interface UpdateSavingsRecordPayload {
  eb_bill_amount?: number | null;
  upfront_investment?: number;
  payment_status?: string;
}

// ─── Hardware Health ──────────────────────────────────────────────────────────

export interface ComponentHealth {
  type: string;
  health_score: number;
  status: 0 | 1 | 2;
  age: string;
  specs: string[];
  details: Record<string, string>;
  efficiency: number;
  warranty: string;
  alert: string | null;
  catalog_specs?: Record<string, any>; // ProductCatalog specs (dimensions, features, etc)
}

export interface HardwareHealthData {
  overall_score: number;
  overall_status: 0 | 1 | 2;
  inverter: ComponentHealth;
  battery: ComponentHealth;
  solar_panel: ComponentHealth;
  installation: {
    system_size: string;
    installed_date: string;
    installer_name: string;
  };
  maintenance_tips: Array<{ icon: string; description: string; frequency: string }>;
  last_updated: string;
}
