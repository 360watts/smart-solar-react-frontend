// src/shared/components/SiteDataPanel/types.tsx
import React from 'react';
import { Home, CloudSun, TrendingUp, Sun, Layers, Activity, HeartPulse, Zap } from 'lucide-react';

const tabIconSize = 16;

export const TABS = [
  { id: 'overview',   label: 'Overview', icon: <Home size={tabIconSize} /> },
  { id: 'details',    label: 'Details',  icon: <Activity size={tabIconSize} /> },
  { id: 'health',     label: 'Health',   icon: <HeartPulse size={tabIconSize} /> },
  { id: 'weather',    label: 'Weather',  icon: <CloudSun size={tabIconSize} /> },
  { id: 'history',    label: 'History',  icon: <TrendingUp size={tabIconSize} /> },
  { id: 'forecast',   label: 'Solar',    icon: <Sun size={tabIconSize} /> },
  { id: 'phase-load', label: 'Load',     icon: <Layers size={tabIconSize} /> },
  { id: 'usage',      label: 'Usage',    icon: <Zap size={tabIconSize} /> },
] as const;

export type TabId = typeof TABS[number]['id'];

export type HistorySeriesKey = 'PV' | 'Load' | 'Grid' | 'InvOut' | 'SOC';
export type VsActualSeriesKey = 'Actual' | 'P50' | 'Delta';

export interface Props {
  siteId: string;
  autoRefresh?: boolean;
  inverterCapacityKw?: number | null;
}

// Mirrors GET /sites/<id>/meter-usage/ (design: smart-solar-django-backend/docs/superpowers/specs/2026-10-08-meter-usage-tab-design.md).
// Power is kW, energy is kWh, every missing value is null.
export interface MeterUsage {
  site_id: string;
  timezone: string;
  generated_at: string;
  meter_only: boolean;
  meter: { device_serial: string | null; last_reading_at: string | null; age_seconds: number | null };
  step_minutes: number;
  today: {
    date: string;
    energy_kwh: number | null;
    yesterday_at_now_kwh: number | null;
    yesterday_total_kwh: number | null;
    now_kw: number | null;
    peak_kw: number | null;
    peak_at: string | null;
    yesterday_peak_kw: number | null;
    avg_kw: number | null;
    base_load_kw: number | null;
  };
  curve: { today: (number | null)[]; yesterday: (number | null)[] };
  days: { date: string; kwh: number | null }[];
  heatmap: { dates: string[]; kw: (number | null)[][] };
  month: { to_date_kwh: number | null; avg_day_kwh: number | null };
  coverage: { today_pct: number | null };
}
