// Shared types for the Real-Time Analytics admin page.
// Field names below are verified against the live backend response shapes —
// see the plan doc for the source-of-truth trail (do not rename without re-verifying).

export type AnalyticsWindow = '24h' | '7d' | '30d' | 'custom';
export type AnalyticsMode = 'fleet' | 'site';

/** Slim site record shape used across Analytics — mirrors Dashboard.tsx's local `Site`. */
export interface AnalyticsSite {
  site_id: string;
  display_name: string;
  capacity_kw: number | null;          // DC/PV nameplate — the Specific Yield/PSH/utilization denominator
  inverter_capacity_kw?: number | null; // AC inverter rating — not used as a KPI denominator here
  devices: Array<{ device_id: number; device_serial: string; is_online: boolean }>;
}

export interface TelemetryRow {
  timestamp: string;
  pv1_power_w?: number | null;
  pv2_power_w?: number | null;
  pv3_power_w?: number | null;
  pv4_power_w?: number | null;
  inv_total_power_w?: number | null;
  ac_output_power_w?: number | null;
  load_power_w?: number | null;
  grid_power_w?: number | null;
  battery_power_w?: number | null;
  battery_soc_percent?: number | null;
  grid_l1_voltage_v?: number | null;
  grid_voltage_v?: number | null;
  grid_frequency_hz?: number | null;
  [key: string]: unknown;
}

export interface ForecastRow {
  timestamp?: string;
  forecast_for?: string;
  p10_kw?: number | null;
  p50_kw?: number | null;
  p90_kw?: number | null;
}

export interface DataQualityGap {
  tsStart: string;
  tsEnd: string;
  category: string;
  incidentType: string;
  severity: string;
}

export interface EnergySummaryWindow {
  pv_gen_kwh?: number;
  load_kwh?: number;
  grid_import_kwh?: number;
  grid_export_kwh?: number;
  batt_charge_kwh?: number;
  batt_discharge_kwh?: number;
  avg_soc?: number;
  power_to_grid_kwh?: number;
}

export interface EnergySummaryCombined {
  summary?: {
    today?: EnergySummaryWindow;
    weekly?: EnergySummaryWindow;
    monthly?: EnergySummaryWindow;
  };
}

/** apiService.getFleetHealthReport() response — devices keyed by serial, not site. */
export interface FleetHealthReport {
  data?: {
    fleet_summary?: {
      total_alerts?: number;
      critical_alerts?: number;
      warning_alerts?: number;
      unresolved_alerts?: number;
    };
    devices?: Record<string, {
      site_id: string;
      is_online: boolean;
      alerts?: { total: number; by_fault_code?: Record<string, number> };
      telemetry?: { data_completeness_pct?: number };
    }>;
  };
}

export interface FleetLeaderboardRow {
  siteId: string;
  displayName: string;
  specificYieldKwhPerKwp: number | null;
  availabilityPct: number | null;
  alertCount: number;
  epiPct: number | null;
}
