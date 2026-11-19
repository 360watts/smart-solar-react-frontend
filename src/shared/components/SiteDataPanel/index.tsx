import { Activity } from 'lucide-react';
import { EmptyState } from '../Feedback';
/**
 * SiteDataPanel — solar site intelligence panel with modern 3D animations & UX
 *
 * Tabs:
 *  - Overview: 6 live KPI cards + energy breakdown + insights
 *  - Details:  site config table
 *  - Weather:  current conditions + 24 h hourly outlook strip
 *  - History:  power area chart with Battery SOC on secondary axis
 *  - Forecast: P10/P50/P90 + physics baseline, regime tags, % achieved
 *  - Load:     phase load breakdown
 *
 * This file is the entry-point shell. Each tab's JSX lives in ./tabs/<Tab>.tsx.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer, type FC } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { usePersistedState } from '../../hooks/usePersistedState';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip as CJTooltip, Legend as CJLegend, Filler,
} from 'chart.js';
import ZoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, CJTooltip, CJLegend, Filler, ZoomPlugin,
);

import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../../services/api';
import { cacheService } from '../../../services/cacheService';
import { useTheme } from '../../../contexts/ThemeContext';
import { IST_TIMEZONE } from '../../../app/constants';
import { istDate, startOfSolarDayIST } from './istDate';
import DetailsTab from '../../../features/staff/DetailsTab';
import { SystemHealthPanel } from '../../../features/staff/EnergyFlowHealthRow';

// Tab components
import OverviewTab from './tabs/OverviewTab';
import WeatherTab from './tabs/WeatherTab';
import { TABS, type TabId } from './types';
import HistoryTab from './tabs/HistoryTab';
import ForecastTab from './tabs/ForecastTab';
import PhaseLoadTab from './tabs/PhaseLoadTab';
import UsageTab from './tabs/UsageTab';
import PlugsTab from './tabs/PlugsTab';
import { isPlug } from '../EnergyFlow/plugHelpers';
import { ctActivePowerW } from '../EnergyFlow/NodeDetailModal';
import { railToday, type HomeToday } from '../EnergyFlow/flowModel';
import ViewerDevices from '../../../features/staff/viewer/ViewerDevices';
import ViewerEvents from '../../../features/staff/viewer/ViewerEvents';
import { tabsFor, tabLabel, resolveTab } from './tabVisibility';

// ── Constants ──────────────────────────────────────────────────────────────────

const IST = IST_TIMEZONE;


const tabTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getTelemetryAggregateForRange(range: string, start?: string, end?: string): '5min' | undefined {
  if (range === '24h') return '5min';
  if (range === 'custom' && start && end) {
    const spanMs = new Date(end).getTime() - new Date(start).getTime();
    if (spanMs > 0 && spanMs <= 24 * 3600 * 1000) return '5min';
  }
  return undefined;
}




const formatPowerForKpi = (kw: number | null | undefined): { value: string; unit: string } => {
  if (kw == null || Number.isNaN(kw)) return { value: '—', unit: 'kW' };
  const absKw = Math.abs(kw);
  if (absKw < 1) return { value: (kw * 1000).toFixed(0), unit: 'W' };
  return { value: kw.toFixed(2), unit: 'kW' };
};

// ── Data fetch state ──────────────────────────────────────────────────────────
interface FetchState {
  telemetry: any[];
  forecast: any[];
  weather: any;
  smartDevices: any[];
  /** From staff_overview: true = energy meter and no inverter (Usage tab); null = not known yet. */
  meterOnly: boolean | null;
  /** From staff_overview: true = the site has an energy meter (Usage tab); null = not known yet. */
  hasMeter: boolean | null;
  /** True once the first overview call has finished (even if it failed), so "no data" is not shown while meterOnly is still unknown. */
  overviewDone: boolean;
  loading: boolean;
  error: string | null;
  historyError: string | null;
  lastUpdated: Date | null;
  secondsSinceUpdate: number;
}

const FETCH_INITIAL: FetchState = {
  telemetry: [], forecast: [], weather: null, smartDevices: [], meterOnly: null, hasMeter: null, overviewDone: false,
  loading: true, error: null, historyError: null, lastUpdated: null, secondsSinceUpdate: 0,
};

// Last meterOnly/hasMeter answer per site, kept for the page session so a remount (minimise/restore) does not drop back to the skeleton.
const meterMemory = new Map<string, { meterOnly: boolean; hasMeter: boolean }>();
export const __resetMeterOnlyMemory = () => meterMemory.clear();

function initialFetchState(siteId: string): FetchState {
  const m = meterMemory.get(siteId);
  return m ? { ...FETCH_INITIAL, ...m, overviewDone: true, loading: !m.meterOnly } : FETCH_INITIAL;
}

type FetchAction =
  | { type: 'RESET'; siteId: string }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Pick<FetchState, 'telemetry' | 'forecast' | 'lastUpdated'> }
  | { type: 'OVERVIEW_SUCCESS'; payload: Pick<FetchState, 'weather' | 'smartDevices' | 'meterOnly' | 'hasMeter'> }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'HISTORY_ERROR'; error: string | null }
  | { type: 'HISTORY_APPEND'; rows: any[] }
  | { type: 'MARK_UPDATED' }
  | { type: 'TICK' };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'RESET':
      return initialFetchState(action.siteId);
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, ...action.payload, loading: false, error: null, secondsSinceUpdate: 0 };
    case 'OVERVIEW_SUCCESS':
      // Independent of the main telemetry/forecast fetch cycle — doesn't touch loading/error.
      // A failed overview call (meterOnly null) must not flip a known answer back to unknown.
      // A meter-only site never runs the telemetry fetch, so the overview is what ends its first load.
      return {
        ...state, ...action.payload, overviewDone: true, meterOnly: action.payload.meterOnly ?? state.meterOnly,
        hasMeter: action.payload.hasMeter ?? state.hasMeter,
        loading: action.payload.meterOnly === true ? false : state.loading,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'HISTORY_APPEND': {
      const tsSet = new Set(state.telemetry.map((r: any) => r.timestamp));
      const newer = action.rows.filter((r: any) => !tsSet.has(r.timestamp));
      if (newer.length === 0) return state;
      return { ...state, telemetry: [...state.telemetry, ...newer].sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp)) };
    }
    case 'MARK_UPDATED':
      return { ...state, lastUpdated: new Date(), secondsSinceUpdate: 0 };
    case 'HISTORY_ERROR':
      return { ...state, historyError: action.error };
    case 'TICK':
      return { ...state, secondsSinceUpdate: state.lastUpdated ? Math.floor((Date.now() - state.lastUpdated.getTime()) / 1000) : state.secondsSinceUpdate };
    default:
      return state;
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  siteId: string;
  autoRefresh?: boolean;
  inverterCapacityKw?: number | null;
  initialTab?: TabId;
  hideTabs?: boolean;
  hideHeader?: boolean;
  visibleTabs?: TabId[];
}

const SiteDataPanel: React.FC<Props> = ({ siteId, autoRefresh = false, inverterCapacityKw, initialTab, hideTabs = false, hideHeader = false, visibleTabs }) => {
  const { isDark } = useTheme();
  const isTouch = useIsMobile();

  const [fetchState, dispatchFetch] = useReducer(fetchReducer, siteId, initialFetchState);
  // A new siteId (caller not keyed by it) starts from that site's remembered answer, not the old site's.
  const seededSiteRef = useRef(siteId);
  useEffect(() => {
    if (seededSiteRef.current === siteId) return;
    seededSiteRef.current = siteId;
    dispatchFetch({ type: 'RESET', siteId });
  }, [siteId]);
  const { telemetry, forecast, weather, smartDevices, meterOnly, hasMeter, overviewDone, loading, error, lastUpdated, secondsSinceUpdate } = fetchState;
  const isInitialLoad = useRef(true);
  // Guards the fire-and-forget analytics Promise: set to true on unmount or
  // siteId change so callbacks don't set state on a stale/unmounted component.
  const analyticsStaleRef = useRef(false);

  // An explicit initialTab wins; otherwise reopen the tab last used (resolveTab falls back if this site lacks it).
  const [activeTabState, setActiveTab] = usePersistedState<TabId>('360w.panel.tab', initialTab ?? 'overview');
  // The tab bar is the source of truth: a tab it does not list (e.g. meterOnly flipped) falls back to its first entry.
  // Smart plugs tab: from the overview's smart_devices (no extra request); hidden until that list has a plug.
  const hasPlugs = smartDevices.some(isPlug);
  const panelTabs = tabsFor({ meterOnly, hasMeter, hasPlugs, visibleTabs });
  const activeTab = resolveTab(activeTabState, panelTabs);
  const meterOnlyOn = meterOnly === true;
  // Set once the person picks a tab (or the caller names one), so the meter-only auto-switch never overrides them.
  const pickedTabRef = useRef(initialTab != null);
  const analyticsLoadedRef = useRef<{ weatherForecast: boolean; phaseLoad: boolean }>({ weatherForecast: false, phaseLoad: false });
  // The panel's own telemetry window is always today (it feeds `latest`, today's kWh and noData). The History tab
  // picks its own periods and fetches its own data since 2026-11-19 (tabs/HistoryTab.tsx).
  // ponytail: the 7d/30d/custom branches in fetchHistory below are now unreachable; delete them in a later cleanup.
  const dateRange: string = '24h';
  const debouncedStart = '';
  const debouncedEnd = '';




  // Analytics data
  const [phaseLoad, setPhaseLoad] = useState<any[]>([]);
  const [forecastAccuracy, setForecastAccuracy] = useState<any>(null);
  const [loadForecastAccuracy, setLoadForecastAccuracy] = useState<any>(null);
  const [loadForecast, setLoadForecast] = useState<any[]>([]);
  const [weatherAccuracy, setWeatherAccuracy] = useState<any>(null);
  const [forecastSubTab, setForecastSubTab] = useState<'chart' | 'accuracy' | 'satellite'>('chart');
  const [weatherSubTab, setWeatherSubTab] = useState<'current' | 'accuracy'>('current');
  const [phaseLoadHours, setPhaseLoadHours] = useState(24);
  const [ctLatest, setCtLatest] = useState<any | null>(null);
  const [latestLiveTelemetry, setLatestLiveTelemetry] = useState<any | null>(null);
  const [solarDayToday, setSolarDayToday] = useState<Record<string, number> | null>(null);
  // undefined = backend sent no home_today key (older deploy): the rail falls back to the Load tile figure.
  const [homeToday, setHomeToday] = useState<HomeToday | null | undefined>(undefined);
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const poll = async () => {
      if (document.hidden) return;
      // Single batched call covers gateway status (realtime.is_online — a strict
      // superset of the old getGatewayStatus response), weather, smart devices,
      // latest CT meter reading, and today's solar-day energy summary — replacing
      // what used to be 5 separate endpoints/pollers (3 of them on this same 30s
      // cadence) with one round-trip.
      // A 403 (e.g. a viewer if the backend tier changes) must not break the panel:
      // carry on with empty overview data.
      let overview: Awaited<ReturnType<typeof apiService.getStaffOverview>> = null;
      try {
        overview = await apiService.getStaffOverview(siteId);
      } catch {
        overview = null;
      }
      if (cancelled) return;
      setGatewayOnline(overview?.realtime?.is_online ?? null);
      setCtLatest(overview?.energy_meter_latest ?? null);
      setSolarDayToday(overview?.energy_summary_today ?? null);
      setHomeToday(overview && 'home_today' in overview ? overview.home_today ?? null : undefined);
      if (typeof overview?.meter_only === 'boolean' && typeof overview?.has_meter === 'boolean') {
        meterMemory.set(siteId, { meterOnly: overview.meter_only, hasMeter: overview.has_meter });
      }
      dispatchFetch({ type: 'OVERVIEW_SUCCESS', payload: {
        weather: overview?.weather ?? null,
        smartDevices: Array.isArray(overview?.smart_devices) ? overview.smart_devices : [],
        meterOnly: typeof overview?.meter_only === 'boolean' ? overview.meter_only : null,
        hasMeter: typeof overview?.has_meter === 'boolean' ? overview.has_meter : null,
      }});
    };
    // First call runs at once: it tells us meter-only vs inverter before anything is drawn or fetched
    // (fetchAll waits for it, so there is no burst to stagger against). 30s cadence matches the
    // backend's realtime fragment TTL.
    poll();
    const iv = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [siteId]);

  // A hung overview call must not hold the skeleton forever.
  const [overviewWaitExpired, setOverviewWaitExpired] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOverviewWaitExpired(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const overviewReady = overviewDone || overviewWaitExpired;

  // Lead chosen on the Phase Load vs-actual chart; the 5-min auto refresh reuses it.
  const vsLeadRef = useRef('latest');
  const vsFetchedRef = useRef<Record<string, number>>({});
  const refreshVsActualData = useCallback(async (lead?: string) => {
    if (!siteId) return;
    if (lead) vsLeadRef.current = lead;
    // switching back to a lead fetched in the last 5 min reuses its response (runs arrive every 15 min);
    // older, or a plain refresh, fetches again
    const key = `load_forecast_accuracy_${siteId}_7_${vsLeadRef.current}`;
    if (!lead || Date.now() - (vsFetchedRef.current[key] ?? 0) > 5 * 60_000) {
      cacheService.clear(key);
      vsFetchedRef.current[key] = Date.now();
    }
    try {
      const lfa = await apiService.getLoadForecastAccuracy(siteId, 7, vsLeadRef.current);
      setLoadForecastAccuracy(lfa ?? null);
    } catch {
      // ignore
    }
  }, [siteId]);

  const fetchLatestTelemetry = useCallback(async () => {
    if (document.hidden || meterOnlyOn) return;
    try {
      const now = new Date();
      const telemetryParams: any = {
        start_date: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        end_date: now.toISOString(),
        aggregate: 'none',
      };
      const tel = await apiService.getSiteTelemetry(siteId, telemetryParams);
      if (Array.isArray(tel) && tel.length > 0) {
        // Prefer the last non-standby row — run_state=0 zeros all registers.
        const latest = tel.slice().reverse().find(r => Number(r.run_state) !== 0) ?? tel[tel.length - 1];
        setLatestLiveTelemetry(latest ?? null);
        dispatchFetch({ type: 'MARK_UPDATED' });
      }
    } catch {
      // silent
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd, meterOnlyOn]);

  const fetchAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) dispatchFetch({ type: 'FETCH_START' });
    try {
      const now = new Date();
      // Solar day window: 6am IST today → 7 days out
      const forecastStart = startOfSolarDayIST();
      const forecastEndDt = new Date(new Date(forecastStart).getTime() + 7 * 24 * 3600 * 1000);
      const forecastEnd = forecastEndDt.toISOString();

      const buildWindows = (start: Date, end: Date, rangeKey: string) => {
        const windows: { start_date: string; end_date: string }[] = [];
        const cursor = new Date(start);
        cursor.setUTCHours(0, 0, 0, 0);
        // Use larger time windows for longer ranges to reduce parallel request count:
        // 24h → 1-day windows (already handled above this code path)
        // 7d  → 1-day windows (7 requests)
        // 30d → 7-day weekly windows (~5 requests instead of 30)
        // custom range > 14 days → 7-day windows
        const customDays = rangeKey === 'custom' ? Math.ceil((end.getTime() - start.getTime()) / 86_400_000) : 0;
        const stepDays = (rangeKey === '30d' || customDays > 14) ? 7 : 1;
        while (cursor < end) {
          const dayStart = cursor.toISOString();
          cursor.setUTCDate(cursor.getUTCDate() + stepDays);
          windows.push({ start_date: dayStart, end_date: (cursor < end ? new Date(cursor) : end).toISOString() });
        }
        return windows;
      };

      // Weather/smart-devices/gateway-status come from the dedicated fetchOverview
      // poller below (its own faster cadence) — fetchAll only owns forecast + the
      // telemetry chart windows now, so this single fetch doesn't need Promise.all.
      const fcst = await apiService.getSiteForecast(siteId, { start_date: forecastStart, end_date: forecastEnd });

      let telemetryRows: any[] = [];
      if (dateRange === '24h') {
        const rows = await apiService.getSiteTelemetry(siteId, { start_date: startOfSolarDayIST(), end_date: now.toISOString(), aggregate: '5min' });
        telemetryRows = Array.isArray(rows) ? rows : [];
      } else {
        let rangeStart: Date;
        let rangeEnd = now;
        if (dateRange === '7d') rangeStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        else if (dateRange === '30d') rangeStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        else if (dateRange === 'custom' && debouncedStart && debouncedEnd) {
          rangeStart = new Date(debouncedStart);
          rangeEnd = new Date(debouncedEnd);
        } else {
          rangeStart = new Date(now.getTime() - 24 * 3600 * 1000);
        }
        const windows = buildWindows(rangeStart, rangeEnd, dateRange);
        const aggregate = getTelemetryAggregateForRange(dateRange, debouncedStart, debouncedEnd);
        // Fetch all day-windows in parallel — cacheService.dedup ensures repeated
        // calls for the same window (e.g. from concurrent renders) share one request.
        const results = await Promise.allSettled(
          // '5min' even when the range has no preset: a short last window (< 6 h) would otherwise get raw 2-second rows.
          windows.map(w => apiService.getSiteTelemetry(siteId, { start_date: w.start_date, end_date: w.end_date, aggregate: aggregate ?? '5min' }))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) telemetryRows.push(...r.value);
        }
        telemetryRows.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
      }

      // latestLiveTelemetry is sourced from fetchLatestTelemetry (full raw row, all
      // per-phase fields) rather than the overview's realtime fragment, which is
      // slimmed down to a customer-portal-oriented field subset (_slim_telemetry)
      // that's missing per-phase grid/load/battery detail the staff UI needs.

      dispatchFetch({ type: 'FETCH_SUCCESS', payload: {
        telemetry: telemetryRows,
        forecast: Array.isArray(fcst) ? fcst : [],
        lastUpdated: new Date(),
      }});
      // phaseLoad/forecastAccuracy/loadForecast/weatherAccuracy/loadForecastAccuracy used
      // to fire here eagerly on every mount regardless of which tab was open — 5 more
      // requests piled onto the primary burst for data only the Weather/Forecast/
      // Phase-Load tabs need. Now lazy-loaded per-tab below (see activeTab effect).
    } catch (err) {
      dispatchFetch({ type: 'FETCH_ERROR', error: err instanceof Error ? err.message : 'Failed to load site data' });
    } finally {
      isInitialLoad.current = false;
    }
  // phaseLoadHours is not read here: listing it made every Load card window switch reload the whole panel (spinner,
  // forecast, telemetry); the Phase Load tab fetches its own rows for the window (Nov 18)
  }, [siteId, dateRange, debouncedStart, debouncedEnd]);

  const fetchHistory = useCallback(async () => {
    const now = new Date();
    let rangeStart: Date | null = null;
    let rangeEnd: Date = now;

    if (dateRange === '7d') {
      rangeStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    } else if (dateRange === '30d') {
      rangeStart = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    } else if (dateRange === 'custom' && debouncedStart && debouncedEnd) {
      rangeStart = new Date(debouncedStart);
      rangeEnd   = new Date(debouncedEnd);
    }
    if (dateRange === 'custom' && rangeStart && (rangeEnd.getTime() - rangeStart.getTime()) <= 24 * 3600 * 1000) {
      dispatchFetch({ type: 'HISTORY_ERROR', error: null });
      return;
    }
    if (!rangeStart) { dispatchFetch({ type: 'HISTORY_ERROR', error: null }); return; }

    dispatchFetch({ type: 'HISTORY_ERROR', error: null });

    const windows: { start_date: string; end_date: string }[] = [];
    const cursor = new Date(rangeStart);
    cursor.setUTCMinutes(0, 0, 0);
    cursor.setUTCHours(Math.floor(cursor.getUTCHours() / 6) * 6);
    while (cursor < rangeEnd) {
      const windowStart = cursor.toISOString();
      cursor.setUTCHours(cursor.getUTCHours() + 6);
      const windowEnd = (cursor < rangeEnd ? new Date(cursor) : rangeEnd).toISOString();
      windows.push({ start_date: windowStart, end_date: windowEnd });
    }

    for (const params of windows) {
      try {
        const hist = await apiService.getSiteHistory(siteId, { ...params, aggregate: '15min' });
        if (Array.isArray(hist) && hist.length > 0) {
          dispatchFetch({ type: 'HISTORY_APPEND', rows: hist });
        }
      } catch (err) {
        dispatchFetch({ type: 'HISTORY_ERROR', error: err instanceof Error ? err.message : 'Failed to load history' });
      }
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd]);

  useEffect(() => {
    // Meter-only sites have no telemetry/forecast; skipping saves the per-user read quota (300/hour).
    if (meterOnlyOn || !overviewReady) return;
    isInitialLoad.current = true;
    analyticsStaleRef.current = false;
    dispatchFetch({ type: 'FETCH_START' });
    fetchAll(false).then(() => fetchHistory());
    if (!autoRefresh) return () => { analyticsStaleRef.current = true; };
    const fullId = setInterval(() => {
      if (document.hidden) return;
      fetchAll(false).then(() => fetchHistory());
    }, 5 * 60_000);
    return () => {
      analyticsStaleRef.current = true;
      clearInterval(fullId);
    };
  }, [fetchAll, fetchHistory, autoRefresh, meterOnlyOn, overviewReady]);

  useEffect(() => {
    if (!autoRefresh || meterOnlyOn || !overviewReady) return;
    // Fire immediately so latestLiveTelemetry is populated on mount instead of
    // waiting for the first 30s tick — this is now the sole source of live
    // telemetry (the old inline 20-min-window fetch in fetchAll was removed).
    fetchLatestTelemetry();
    const fastId = setInterval(fetchLatestTelemetry, 30_000);
    return () => clearInterval(fastId);
  }, [fetchLatestTelemetry, autoRefresh, meterOnlyOn, overviewReady]);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      dispatchFetch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);


  useEffect(() => {
    // Only needed by the Phase-Load tab — skip firing on every mount/hours-change
    // while some other tab is open, so it doesn't pile onto the initial burst.
    if (activeTab !== 'phase-load') return;
    apiService.getPhaseLoad(siteId, phaseLoadHours, 'raw')
      .then(data => setPhaseLoad(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [siteId, phaseLoadHours, activeTab]);

  // A meter-only site opens on Usage, unless the person already chose a tab.
  useEffect(() => {
    if (meterOnly === true && !pickedTabRef.current && tabsFor({ meterOnly, visibleTabs }).includes('usage')) setActiveTab('usage');
  }, [meterOnly]);

  // Lazy-load the remaining tab-specific analytics only once their tab is opened,
  // instead of eagerly firing all of them on every mount — these fed the Weather/
  // Forecast/Phase-Load tabs but used to fire regardless of which tab was active,
  // adding 4 more requests to the initial page-load burst for data most visits
  // never even look at.
  useEffect(() => {
    analyticsLoadedRef.current = { weatherForecast: false, phaseLoad: false };
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    if ((activeTab === 'weather' || activeTab === 'forecast') && !analyticsLoadedRef.current.weatherForecast) {
      analyticsLoadedRef.current.weatherForecast = true;
      Promise.allSettled([
        apiService.getForecastAccuracy(siteId, 30),
        apiService.getWeatherAccuracy(siteId, 7),
      ]).then(([fa, wa]) => {
        if (analyticsStaleRef.current) return;
        if (fa.status === 'fulfilled') setForecastAccuracy(fa.value ?? null);
        if (wa.status === 'fulfilled') setWeatherAccuracy(wa.value ?? null);
      });
    }
    if (activeTab === 'phase-load' && !analyticsLoadedRef.current.phaseLoad) {
      analyticsLoadedRef.current.phaseLoad = true;
      Promise.allSettled([
        apiService.getLoadForecast(siteId, 7),
        apiService.getLoadForecastAccuracy(siteId, 7, vsLeadRef.current),
      ]).then(([lf, lfa]) => {
        if (analyticsStaleRef.current) return;
        if (lf.status === 'fulfilled') setLoadForecast(Array.isArray(lf.value) ? lf.value : []);
        if (lfa.status === 'fulfilled') setLoadForecastAccuracy(lfa.value ?? null);
      });
    }
  }, [activeTab, siteId]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const latest = latestLiveTelemetry ?? (telemetry.length > 0 ? telemetry[telemetry.length - 1] : null);

  const pvKw = latest ? (
    (Number(latest.pv1_power_w ?? 0) + Number(latest.pv2_power_w ?? 0) + Number(latest.pv3_power_w ?? 0) + Number(latest.pv4_power_w ?? 0)) / 1000
  ) : null;
  const batSoc = latest?.battery_soc_percent ?? null;
  const loadKwRaw = latest ? (latest.load_power_w ?? 0) / 1000 : null;
  // 6am–6am solar-day total (lifetime-counter delta, see getEnergySummaryCombined) —
  // falls back to the inverter's own midnight-reset daily accumulator, which is
  // wrong 00:00–06:00 IST (shows only the post-midnight sliver, not the full solar day).
  const todayKwh    = solarDayToday?.pv_gen_kwh ?? latest?.pv_today_kwh ?? null;
  const totalPvKwh  = latest?.pv_total_kwh    ?? null;
  const gridKw = latest ? (latest.grid_power_w ?? 0) / 1000 : null;
  const batPowerKw = latest ? (latest.battery_power_w ?? 0) / 1000 : null;
  const invTemp = latest?.inverter_temp_c ?? null;
  const batVoltage = latest?.battery_voltage_v ?? null;
  const runState = latest?.run_state;
  // inv_total_power_w is the real total AC output; ac_output_power_w is phase-L1-only
  // (see FAULT_LOG.md F-048) and understates true output by ~2/3 on 3-phase sites.
  const acOutputKw = latest?.inv_total_power_w != null
    ? latest.inv_total_power_w / 1000
    : latest?.ac_output_power_w != null ? latest.ac_output_power_w / 1000 : null;
  const pvPowerDisplay = formatPowerForKpi(pvKw);
  const gridPowerDisplay = formatPowerForKpi(gridKw != null ? Math.abs(gridKw) : null);
  const acOutputPowerDisplay = formatPowerForKpi(acOutputKw);
  const batteryPowerDisplay = formatPowerForKpi(Math.abs(batPowerKw ?? 0));

  const rs485Stale = latest?.data_stale === true;
  const isDeyeCloud = latest?.data_source === 'deye_cloud';

  const latestAgeMs = latest?.timestamp ? Date.now() - new Date(latest.timestamp).getTime() : Infinity;
  const gatewayIsOnline = gatewayOnline === null ? null : gatewayOnline === true;
  const gatewayOffline = isDeyeCloud
    ? gatewayIsOnline === false
    : latestAgeMs > 10 * 60 * 1000;
  const deyeCloudAgeMs = isDeyeCloud ? latestAgeMs : null;
  const loggerOffline = isDeyeCloud && deyeCloudAgeMs != null && deyeCloudAgeMs > 20 * 60 * 1000;
  const ctAgeMs = ctLatest?.timestamp ? Date.now() - new Date(ctLatest.timestamp).getTime() : null;
  const ctStale = gatewayOffline && ctAgeMs != null && ctAgeMs > 15 * 60 * 1000;

  const isLatestToday = latest?.timestamp
    ? istDate(new Date(latest.timestamp)) === istDate(new Date())
    : false;
  // Energy-flow left rail: "Home used" is the whole-home figure (home_today), see railToday.
  const flowToday = (() => {
    const base = railToday(solarDayToday, latest, isLatestToday, homeToday);
    // Solar curve for the "Solar made today" tile: hourly average kW from the 5-minute rows this panel already
    // loads (24h mode = the solar day so far). Other ranges carry no "today" curve.
    if (dateRange !== '24h' || telemetry.length < 2) return base;
    // The chart is the solar day, 6 AM to 6 AM IST: 24 fixed hourly slots from startOfSolarDayIST(), so the line
    // grows left to right and the hours still to come stay empty (null = no reading, never zero-filled).
    const dayStartMs = new Date(startOfSolarDayIST()).getTime();
    const slotKw: number[][] = Array.from({ length: 24 }, () => []);
    let kwhSum = 0;
    for (const r of telemetry) {
      const w = Number(r.pv1_power_w ?? 0) + Number(r.pv2_power_w ?? 0) + Number(r.pv3_power_w ?? 0) + Number(r.pv4_power_w ?? 0);
      if (!Number.isFinite(w)) continue;
      const slot = Math.floor((new Date(r.timestamp).getTime() - dayStartMs) / 3_600_000);
      if (slot >= 0 && slot < 24) slotKw[slot].push(w / 1000);
      kwhSum += (w / 1000) * (5 / 60);
    }
    const solarCurve = slotKw.map(v => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null));
    // Tooltip labels: the hour each slot starts, in IST ("6 AM" ... "5 AM").
    const solarCurveLabels = slotKw.map((_, i) => new Date(dayStartMs + i * 3_600_000).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' }).toUpperCase());
    // When the energy summary has no figure, total the same rows (5-minute aggregate: kW x 5/60) rather than "—".
    const solarKwh = base.solarKwh ?? (kwhSum > 0 ? kwhSum : null);
    return { ...base, solarKwh, solarCurve, solarCurveLabels };
  })();

  const liveThresholdMs = isDeyeCloud ? 15 * 60 * 1000 : 10 * 60 * 1000;
  const dataFresh = latest?.timestamp
    ? (Date.now() - new Date(latest.timestamp).getTime()) < liveThresholdMs
    : false;
  const isDataLive = isDeyeCloud
    ? dataFresh
    : dataFresh && (gatewayOnline === null ? true : gatewayOnline);

  const gridExporting = gridKw != null && gridKw < -0.01;
  const gridImporting = gridKw != null && gridKw >  0.01;
  const batCharging = batPowerKw != null && batPowerKw < -0.01;

  const batDataAgeMs = latest?.timestamp ? Date.now() - new Date(latest.timestamp).getTime() : null;
  const BAT_STALE_THRESHOLD_MS = 30 * 60 * 1000;
  const batDataStale = batDataAgeMs != null && batDataAgeMs > BAT_STALE_THRESHOLD_MS;
  const batDataAgeLabel = (() => {
    if (batDataAgeMs == null) return null;
    const min = Math.floor(batDataAgeMs / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  })();

  const gridL1VoltageV = latest?.grid_l1_voltage_v ?? latest?.grid_voltage_v ?? null;
  const gridL2VoltageV = latest?.grid_l2_voltage_v ?? null;
  const gridL3VoltageV = latest?.grid_l3_voltage_v ?? null;
  const gridL1CurrentA = latest?.grid_l1_current_a ?? null;
  const gridL2CurrentA = latest?.grid_l2_current_a ?? null;
  const gridL3CurrentA = latest?.grid_l3_current_a ?? null;

  const loadL1PowerW = latest?.load_l1_power_w ?? null;
  const loadL2PowerW = latest?.load_l2_power_w ?? null;
  const loadL3PowerW = latest?.load_l3_power_w ?? null;
  const hasLoadPhaseData = loadL1PowerW != null || loadL2PowerW != null || loadL3PowerW != null;
  const loadPhaseSumW = hasLoadPhaseData ? (loadL1PowerW ?? 0) + (loadL2PowerW ?? 0) + (loadL3PowerW ?? 0) : null;
  const loadKw = loadPhaseSumW != null ? loadPhaseSumW / 1000 : loadKwRaw;
  const loadPowerDisplay = formatPowerForKpi(loadKw);
  // Smart plugs tab bars: only readings that are live now. Plugs are at most 5 min old, so an older figure would not be comparable.
  const ctLiveW = ctAgeMs != null && ctAgeMs <= 15 * 60 * 1000 ? ctActivePowerW(ctLatest) : null;
  const plugCircuitKw = { backup: isDataLive ? loadKw : null, grid: ctLiveW != null ? Math.abs(ctLiveW) / 1000 : null };
  const inverterPhasesForFlow = {
    l1: { power_w: loadL1PowerW, voltage_v: latest?.load_l1_voltage_v ?? null, current_a: latest?.load_l1_current_a ?? null },
    l2: { power_w: loadL2PowerW, voltage_v: latest?.load_l2_voltage_v ?? null, current_a: latest?.load_l2_current_a ?? null },
    l3: { power_w: loadL3PowerW, voltage_v: latest?.load_l3_voltage_v ?? null, current_a: latest?.load_l3_current_a ?? null },
    grid_l1: { voltage_v: gridL1VoltageV, current_a: gridL1CurrentA },
    grid_l2: { voltage_v: gridL2VoltageV, current_a: gridL2CurrentA },
    grid_l3: { voltage_v: gridL3VoltageV, current_a: gridL3CurrentA },
    grid_frequency_hz: latest?.grid_frequency_hz ?? null,
    grid_power_factor: latest?.grid_power_factor ?? null,
  };

  const dcTemp = latest?.dc_temp_c ?? null;

  const runStateBadge = runState != null ? (
    runState === 0 ? { label: 'Standby',    color: 'var(--muted-foreground)' } :
    runState === 1 ? { label: 'Self-Check', color: '#60a5fa' } :
    runState === 2 ? { label: 'Normal',     color: '#0F9F8F' } :
    runState === 3 ? { label: 'Alarm',      color: '#f59e0b' } :
    runState === 4 ? { label: 'Fault',      color: '#ef4444' } :
    runState === 5 ? { label: 'Activating', color: '#a78bfa' } :
      { label: `State ${runState}`, color: 'var(--muted-foreground)' }
  ) : null;

  const invTempColor = invTemp == null ? 'var(--muted-foreground)'
    : invTemp > 60 ? '#ef4444'
    : invTemp > 45 ? '#f59e0b'
    : '#0F9F8F';

  const achievedPct = useMemo(() => {
    const todayISTStr = istDate(new Date());
    if (!latest?.timestamp || istDate(new Date(latest.timestamp)) !== todayISTStr) return null;
    if (todayKwh == null) return null;
    const nowMs = new Date(latest.timestamp).getTime();

    const todayForecast = forecast
      .filter(row => {
        const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
        return istDate(new Date(clean)) === todayISTStr;
      })
      .map(row => ({
        t: new Date((row.forecast_for || row.timestamp.replace('FORECAST#', ''))).getTime(),
        p50: row.p50_kw as number | null,
      }))
      .sort((a, b) => a.t - b.t);

    if (todayForecast.length < 2) return null;

    const beforeNow = todayForecast.filter(r => r.t <= nowMs);
    const afterNow  = todayForecast.filter(r => r.t >  nowMs);

    let points = [...beforeNow];

    if (beforeNow.length > 0 && afterNow.length > 0) {
      const prev = beforeNow[beforeNow.length - 1];
      const next = afterNow[0];
      const frac = (nowMs - prev.t) / (next.t - prev.t);
      const interpP50 = prev.p50 != null && next.p50 != null
        ? prev.p50 + frac * (next.p50 - prev.p50)
        : (prev.p50 ?? next.p50);
      points.push({ t: nowMs, p50: interpP50 });
    }

    if (points.length < 2) return null;

    let fcastP50UpToNow = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const h = (points[i + 1].t - points[i].t) / 3_600_000;
      if (points[i].p50 != null && points[i + 1].p50 != null)
        fcastP50UpToNow += (points[i].p50! + points[i + 1].p50!) / 2 * h;
    }

    return fcastP50UpToNow > 0
      ? Math.min(999, Math.round((todayKwh / fcastP50UpToNow) * 100))
      : null;
  }, [forecast, todayKwh, latest]);

  // ── Render ──────────────────────────────────────────────────────────────────
  // A meter-only site never has inverter telemetry or a forecast; its tabs still need to show.
  // Until the first overview answers we cannot tell, so hold the skeleton rather than flash "No data found".
  const noData = meterOnly !== true && telemetry.length === 0 && forecast.length === 0 && !weather;
  if (!overviewReady || loading || (noData && !overviewDone)) {
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.6, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              style={{
                flex: 1,
                minWidth: 130,
                height: 120,
                borderRadius: 16,
                background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(249, 250, 251, 0.8)',
              }}
            />
          ))}
        </div>
        {[52, 140, 260, 220].map((h, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            style={{
              height: h,
              marginBottom: 16,
              borderRadius: 16,
              background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(249, 250, 251, 0.8)',
            }}
          />
        ))}
      </div>
    );
  }

  const failed = !!error && meterOnly !== true;
  // With the Devices tab (viewer, device_control) the tab bar stays up on error / no data, so devices that
  // stopped reporting can still be restarted or updated; the other tabs show the message instead.
  const devicesEscape = visibleTabs?.includes('devices') === true || visibleTabs?.includes('events') === true;
  const errorMsg = (
      <div style={{ marginTop: 16 }}><EmptyState title={`Couldn't load data for ${siteId}`} description={error ?? undefined} /></div>
  );
  const noDataMsg = (
      <div style={{ marginTop: 16 }}><EmptyState icon={Activity} title={`No data for ${siteId} ${dateRange === '24h' ? 'today' : dateRange === '7d' ? 'in the last 7 days' : dateRange === '30d' ? 'in the last 30 days' : 'in this date range'}`}
        description="The gateway posts readings. Forecast and weather load once readings arrive." /></div>
  );
  if (failed && !devicesEscape) return errorMsg;

  // Today / last update / Refresh: at the right end of the tab row, or in the old bar when there is no tab row.
  const tabRowShown = !hideTabs && !(noData && !devicesEscape);
  const headerControls = hideHeader ? null : (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {lastUpdated && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Rubik, sans-serif' }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: secondsSinceUpdate < 60 ? '#0F9F8F' : '#f59e0b',
                boxShadow: secondsSinceUpdate < 60 ? '0 0 6px rgba(15,159,143,0.7)' : 'none',
                animation: secondsSinceUpdate < 60 ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />
              {secondsSinceUpdate < 60
                ? `${secondsSinceUpdate}s ago`
                : secondsSinceUpdate < 3600
                ? `${Math.floor(secondsSinceUpdate / 60)}m ago`
                : lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }) + ' IST'}
            </span>
          )}
          <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={() => { fetchAll(true); }}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </>
  );

  return (
    <div style={{ marginTop: 24 }}>
      {/* ── Section header: only when there is no tab row to hold the controls ── */}
      {headerControls && !tabRowShown && <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap',
          padding: '16px 20px',
          borderRadius: 16,
          background: isDark
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(30, 41, 59, 0.5))'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(249, 250, 251, 0.8))',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(15,159,143, 0.25)'}`,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        {headerControls}
      </motion.div>}

      {noData && !devicesEscape ? noDataMsg : (
        <>
          {/* ── Tab Bar (underlined row; colours are the getDesignTokens CSS vars) ── */}
          <div data-testid="tab-row" style={{ display: hideTabs ? 'none' : 'flex', flexWrap: 'wrap', columnGap: 16, marginBottom: 24, minWidth: 0 }}>
          <motion.div
            role="tablist"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              display: 'flex',
              flex: '1 1 auto',
              maxWidth: '100%',
              minWidth: 0,
              borderBottom: '1px solid var(--border)',
              gap: 4,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {panelTabs.map(id => TABS.find(tab => tab.id === id)!).map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => { pickedTabRef.current = true; setActiveTab(tab.id); }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    height: 44,
                    padding: '0 16px',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                    borderBottom: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                    marginBottom: -1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'color 150ms, border-color 150ms',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span>{tab.icon}</span>
                  {tabLabel(tab)}
                </button>
              );
            })}
          </motion.div>
          {headerControls && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', marginLeft: 'auto', flex: '0 0 auto', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              {headerControls}
            </div>
          )}
          </div>

          {/* ── Tab Content ── */}
          {(failed || noData) && activeTab !== 'devices' && activeTab !== 'events' ? (failed ? errorMsg : noDataMsg) : (
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <OverviewTab
                key="overview"
                isDark={isDark}
                isTouch={isTouch}
                pvKw={pvKw}
                loadKw={loadKw}
                gridKw={gridKw}
                batPowerKw={batPowerKw}
                batSoc={batSoc}
                todayKwh={todayKwh}
                flowToday={flowToday}
                totalPvKwh={totalPvKwh}
                invTemp={invTemp}
                pvPowerDisplay={pvPowerDisplay}
                gridPowerDisplay={gridPowerDisplay}
                loadPowerDisplay={loadPowerDisplay}
                batteryPowerDisplay={batteryPowerDisplay}
                acOutputPowerDisplay={acOutputPowerDisplay}
                isDataLive={isDataLive}
                latest={latest}
                smartDevices={smartDevices}
                siteId={siteId}
                onOpenPlugs={panelTabs.includes('plugs') ? () => { pickedTabRef.current = true; setActiveTab('plugs'); } : undefined}
                inverterPhasesForFlow={inverterPhasesForFlow}
                isDeyeCloud={isDeyeCloud}
                rs485Stale={rs485Stale}
                isLatestToday={isLatestToday}
                runStateBadge={runStateBadge}
                loggerOffline={loggerOffline}
                gatewayOffline={gatewayOffline}
                deyeCloudAgeMs={deyeCloudAgeMs}
                ctStale={ctStale}
                ctAgeMs={ctAgeMs}
                ctLatest={ctLatest}
                batDataStale={batDataStale}
                batDataAgeLabel={batDataAgeLabel}
                batVoltage={batVoltage}
                batCharging={batCharging}
                gridExporting={gridExporting}
                gridImporting={gridImporting}
                dcTemp={dcTemp}
                acOutputKw={acOutputKw}
                inverterCapacityKw={inverterCapacityKw}
                invTempColor={invTempColor}
              />
            )}

            {activeTab === 'details' && (
              <motion.div
                key="details"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{ initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 } }}
                transition={tabTransition}
              >
                <DetailsTab
                  telemetry={latest ?? undefined}
                  pvKw={pvKw}
                  loadKw={loadKw}
                  gridKw={gridKw}
                  batPowerKw={batPowerKw}
                  batSoc={batSoc}
                  todayKwh={todayKwh ?? undefined}
                  totalPvKwh={totalPvKwh ?? undefined}
                  invTemp={invTemp ?? undefined}
                  runStateLabel={runStateBadge?.label}
                  isLatestToday={isLatestToday}
                  achievedPct={achievedPct ?? undefined}
                />
              </motion.div>
            )}

            {activeTab === 'health' && (
              <motion.div
                key="health"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{ initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 20 } }}
                transition={tabTransition}
              >
                <SystemHealthPanel siteId={siteId} />
              </motion.div>
            )}

            {activeTab === 'weather' && (
              <WeatherTab
                key="weather"
                weather={weather}
                isDark={isDark}
                weatherSubTab={weatherSubTab}
                setWeatherSubTab={setWeatherSubTab}
                weatherAccuracy={weatherAccuracy}
              />
            )}

            {activeTab === 'history' && (
              <HistoryTab key="history" siteId={siteId} isDark={isDark} />
            )}

            {activeTab === 'forecast' && (
              <ForecastTab
                key="forecast"
                forecast={forecast}
                isDark={isDark}
                forecastSubTab={forecastSubTab}
                setForecastSubTab={setForecastSubTab}
                forecastAccuracy={forecastAccuracy}
                weatherAccuracy={weatherAccuracy}
                achievedPct={achievedPct}
              />
            )}

            {activeTab === 'usage' && (meterOnly === true || hasMeter === true) && (
              <UsageTab key="usage" siteId={siteId} isDark={isDark} ctLatest={ctLatest} />
            )}

            {activeTab === 'events' && <ViewerEvents key="events" siteId={siteId} />}
            {activeTab === 'devices' && <ViewerDevices key="devices" siteId={siteId} />}

            {activeTab === 'plugs' && <PlugsTab key="plugs" smartDevices={smartDevices} isDark={isDark} siteId={siteId} circuitKw={plugCircuitKw} />}

            {activeTab === 'phase-load' && (
              <PhaseLoadTab
                key="phase-load"
                siteId={siteId}
                phaseLoad={phaseLoad}
                loadForecast={loadForecast}
                smartDevices={smartDevices}
                latest={latest}
                isDark={isDark}
                hours={phaseLoadHours}
                onHoursChange={setPhaseLoadHours}
                forecastAccuracy={loadForecastAccuracy}
                onRefreshVsActual={refreshVsActualData}
                ctLatest={ctLatest}
              />
            )}
          </AnimatePresence>
          )}
        </>
      )}
    </div>
  );
};

export default SiteDataPanel;
