// src/shared/components/SiteDataPanel/types.tsx
import React from 'react';
import { Home, CloudSun, TrendingUp, Sun, Layers, Activity, HeartPulse } from 'lucide-react';

const tabIconSize = 16;

export const TABS = [
  { id: 'overview',   label: 'Overview', icon: <Home size={tabIconSize} /> },
  { id: 'details',    label: 'Details',  icon: <Activity size={tabIconSize} /> },
  { id: 'health',     label: 'Health',   icon: <HeartPulse size={tabIconSize} /> },
  { id: 'weather',    label: 'Weather',  icon: <CloudSun size={tabIconSize} /> },
  { id: 'history',    label: 'History',  icon: <TrendingUp size={tabIconSize} /> },
  { id: 'forecast',   label: 'Solar',    icon: <Sun size={tabIconSize} /> },
  { id: 'phase-load', label: 'Load',     icon: <Layers size={tabIconSize} /> },
] as const;

export type TabId = typeof TABS[number]['id'];

export type HistorySeriesKey = 'PV' | 'Load' | 'Grid' | 'InvOut' | 'SOC';
export type VsActualSeriesKey = 'Actual' | 'P50' | 'Delta';

export interface Props {
  siteId: string;
  autoRefresh?: boolean;
  inverterCapacityKw?: number | null;
}
