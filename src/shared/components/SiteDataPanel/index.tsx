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
import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip as CJTooltip, Legend as CJLegend, Filler,
  type ChartOptions, type TooltipItem,
} from 'chart.js';
import ZoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, CJTooltip, CJLegend, Filler, ZoomPlugin,
);

import { Home, CloudSun, TrendingUp, Sun, Activity, RefreshCw, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../../../services/api';
import { cacheService } from '../../../services/cacheService';
import { useTheme } from '../../../contexts/ThemeContext';
import { IST_TIMEZONE } from '../../../app/constants';
import DetailsTab from '../../../features/staff/DetailsTab';
import { useChartZoomState } from './chartUtils';

// Tab components
import OverviewTab from './tabs/OverviewTab';
import WeatherTab from './tabs/WeatherTab';
import HistoryTab, { HISTORY_SERIES } from './tabs/HistoryTab';
import ForecastTab from './tabs/ForecastTab';
import PhaseLoadTab from './tabs/PhaseLoadTab';

// ── Constants ──────────────────────────────────────────────────────────────────

const IST = IST_TIMEZONE;

const tabIconSize = 16;
const TABS = [
  { id: 'overview',   label: 'Overview',  icon: <Home size={tabIconSize} /> },
  { id: 'details',    label: 'Details',   icon: <Activity size={tabIconSize} /> },
  { id: 'weather',    label: 'Weather',   icon: <CloudSun size={tabIconSize} /> },
  { id: 'history',    label: 'History',   icon: <TrendingUp size={tabIconSize} /> },
  { id: 'forecast',   label: 'Solar',     icon: <Sun size={tabIconSize} /> },
  { id: 'phase-load', label: 'Load',      icon: <Layers size={tabIconSize} /> },
] as const;
type TabId = typeof TABS[number]['id'];

type HistorySeriesKey = typeof HISTORY_SERIES[number]['key'];
const VS_ACTUAL_SERIES = [
  { key: 'Actual', label: 'Actual' },
  { key: 'P50', label: 'P50' },
  { key: 'Delta', label: 'Δ %' },
] as const;
type VsActualSeriesKey = typeof VS_ACTUAL_SERIES[number]['key'];

const tabTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function istDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

// Solar day starts at 6am IST — if we're before 6am, use yesterday's 6am so the
// chart always shows the most recent full solar day window.
function startOfSolarDayIST(): string {
  const now = new Date();
  const todayStr = istDate(now);
  const todaySolar = new Date(`${todayStr}T06:00:00+05:30`);
  if (now < todaySolar) {
    return new Date(todaySolar.getTime() - 24 * 3600 * 1000).toISOString();
  }
  return todaySolar.toISOString();
}

function getTelemetryAggregateForRange(range: string, start?: string, end?: string): '5min' | undefined {
  if (range === '24h') return '5min';
  if (range === 'custom' && start && end) {
    const spanMs = new Date(end).getTime() - new Date(start).getTime();
    if (spanMs > 0 && spanMs <= 24 * 3600 * 1000) return '5min';
  }
  return undefined;
}

function getHistoryResolutionLabel(range: string, start?: string, end?: string): '5 min' | '15 min' {
  return getTelemetryAggregateForRange(range, start, end) === '5min' ? '5 min' : '15 min';
}

function fmt(ts: string, range: string): string {
  try {
    const d = new Date(ts);
    if (range === '24h') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    if (range === '7d')  return d.toLocaleDateString([], { weekday: 'short', timeZone: IST }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: IST });
  } catch { return ts; }
}

function inferBucketHours(rows: any[]): number {
  if (!rows || rows.length < 2) return 0.25;
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].timestamp).getTime();
    const curr = new Date(rows[i].timestamp).getTime();
    const diffHours = (curr - prev) / 3600000;
    if (Number.isFinite(diffHours) && diffHours > 0) gaps.push(diffHours);
  }
  if (!gaps.length) return 0.25;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
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
  loading: boolean;
  error: string | null;
  historyError: string | null;
  lastUpdated: Date | null;
  secondsSinceUpdate: number;
}

const FETCH_INITIAL: FetchState = {
  telemetry: [], forecast: [], weather: null, smartDevices: [],
  loading: true, error: null, historyError: null, lastUpdated: null, secondsSinceUpdate: 0,
};

type FetchAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Pick<FetchState, 'telemetry' | 'forecast' | 'weather' | 'smartDevices' | 'lastUpdated'> }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'HISTORY_ERROR'; error: string | null }
  | { type: 'HISTORY_APPEND'; rows: any[] }
  | { type: 'MARK_UPDATED' }
  | { type: 'TICK' };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, ...action.payload, loading: false, error: null, secondsSinceUpdate: 0 };
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
  const [isTouch, setIsTouch] = useState(() => window.matchMedia('(hover: none)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [fetchState, dispatchFetch] = useReducer(fetchReducer, FETCH_INITIAL);
  const { telemetry, forecast, weather, smartDevices, loading, error, historyError, lastUpdated, secondsSinceUpdate } = fetchState;
  const isInitialLoad = useRef(true);
  // Guards the fire-and-forget analytics Promise: set to true on unmount or
  // siteId change so callbacks don't set state on a stale/unmounted component.
  const analyticsStaleRef = useRef(false);

  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'overview');
  const [showBands, setShowBands] = useState<Record<string, boolean>>({ P10: true, P50: true, P90: true, GHI: true });
  const [showHistorySeries, setShowHistorySeries] = useState<Record<HistorySeriesKey, boolean>>({
    PV: true,
    Load: true,
    Grid: true,
    InvOut: false,
    SOC: true,
  });
  const [showVsActualSeries, setShowVsActualSeries] = useState<Record<VsActualSeriesKey, boolean>>({
    Actual: true,
    P50: true,
    Delta: true,
  });
  const [dateRange, setDateRange] = useState('24h');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [debouncedStart, setDebouncedStart] = useState('');
  const [debouncedEnd, setDebouncedEnd] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebouncedStart(customStartDate), 600); return () => clearTimeout(t); }, [customStartDate]);
  useEffect(() => { const t = setTimeout(() => setDebouncedEnd(customEndDate), 600); return () => clearTimeout(t); }, [customEndDate]);

  const [forecastView, setForecastView] = useState<'chart' | 'table'>('chart');
  const [forecastWindow, setForecastWindow] = useState<'today' | '3d' | '2d'>('2d');
  const [historyView, setHistoryView] = useState<'chart' | 'table'>('chart');
  const [vsActualView, setVsActualView] = useState<'chart' | 'table'>('chart');
  const [vsActual7d, setVsActual7d] = useState(false);

  const historyZoom = useChartZoomState();
  const forecastZoom = useChartZoomState();
  const vsActualZoom = useChartZoomState();

  const tickColor   = 'var(--muted-foreground)';
  const gridColor   = 'var(--border)';
  const ttBg        = 'var(--popover)';
  const ttTitle     = 'var(--foreground)';
  const ttBody      = 'var(--muted-foreground)';
  const ttBorder    = isDark ? 'rgba(148,163,184,0.2)'  : 'rgba(0,166,62,0.2)';
  const legendColor = 'var(--muted-foreground)';

  const historyChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: legendColor, font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: ttBg, titleColor: ttTitle, bodyColor: ttBody,
        borderColor: ttBorder, borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold', size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => { const unit = item.dataset.label === 'SOC' ? '%' : 'kW'; return ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(item.dataset.label === 'SOC' ? 0 : 3)} ${unit}`; } },
      },
      zoom: {
        wheel: { enabled: true, speed: 0.08 },
        drag: { enabled: true, backgroundColor: 'rgba(0,166,62,0.14)', borderColor: 'rgba(0,166,62,0.7)', borderWidth: 1 },
        pinch: { enabled: true },
        mode: 'x' as const,
        onZoomComplete: () => historyZoom.onZoomComplete.current(),
      },
      pan: { enabled: false, mode: 'x' as const },
    } as any,
    scales: {
      x: { ticks: { color: tickColor, font: { family: 'Inter, sans-serif', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      power: { type: 'linear', position: 'left', ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { display: false } },
      soc: { type: 'linear', position: 'right', min: 0, max: 100, ticks: { color: 'var(--success)', font: { size: 11 }, callback: (v: any) => `${v}%` }, grid: { drawOnChartArea: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

  const vsActualChartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: legendColor, font: { family: 'Poppins, sans-serif', size: 11 }, boxWidth: 10, pointStyle: 'circle', usePointStyle: true, padding: 14 } },
      tooltip: {
        backgroundColor: ttBg, titleColor: ttTitle, bodyColor: ttBody,
        borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(59,130,246,0.2)', borderWidth: 1.5, padding: 10, cornerRadius: 10,
        titleFont: { family: 'Urbanist, sans-serif', weight: 'bold', size: 12 },
        bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
        callbacks: { label: (item: TooltipItem<'line'>) => { const unit = item.dataset.label === 'Δ %' ? '%' : 'kW'; return ` ${item.dataset.label}: ${Number(item.parsed.y).toFixed(item.dataset.label === 'Δ %' ? 0 : 3)} ${unit}`; } },
      },
      zoom: {
        wheel: { enabled: true, speed: 0.08 },
        drag: { enabled: true, backgroundColor: 'rgba(0,166,62,0.14)', borderColor: 'rgba(0,166,62,0.7)', borderWidth: 1 },
        pinch: { enabled: true },
        mode: 'x' as const,
        onZoomComplete: () => vsActualZoom.onZoomComplete.current(),
      },
      pan: { enabled: false, mode: 'x' as const },
    } as any,
    scales: {
      x: { ticks: { color: tickColor, font: { family: 'Inter, sans-serif', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      y: { ticks: { color: 'var(--muted-foreground)', font: { family: 'JetBrains Mono, monospace', size: 11 } }, grid: { display: false } },
      delta: { type: 'linear', position: 'right', ticks: { color: 'var(--destructive)', font: { size: 11 }, callback: (v: any) => `${v}%` }, grid: { drawOnChartArea: false } },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark]);

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
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    const poll = async () => {
      if (document.hidden) return;
      const status = await apiService.getGatewayStatus(siteId);
      if (!cancelled) setGatewayOnline(status?.is_online ?? null);
    };
    poll();
    const iv = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [siteId]);

  useEffect(() => {
    let cancelled = false;
    if (!siteId) return;
    apiService.getLatestEnergyMeter(siteId)
      .then(data => { if (!cancelled) setCtLatest(data ?? null); })
      .catch(() => { if (!cancelled) setCtLatest(null); });
    return () => { cancelled = true; };
  }, [siteId]);

  const refreshVsActualData = useCallback(async () => {
    if (!siteId) return;
    cacheService.clear(`load_forecast_accuracy_${siteId}_7`);
    try {
      const lfa = await apiService.getLoadForecastAccuracy(siteId, 7);
      setLoadForecastAccuracy(lfa ?? null);
    } catch {
      // ignore
    }
  }, [siteId]);

  const fetchLatestTelemetry = useCallback(async () => {
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
  }, [siteId, dateRange, debouncedStart, debouncedEnd]);

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

      const forecastWeatherPromise = Promise.all([
        apiService.getSiteForecast(siteId, { start_date: forecastStart, end_date: forecastEnd }),
        apiService.getSiteWeather(siteId),
        apiService.getSmartDevices(siteId),
      ] as Promise<any>[]);

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
          windows.map(w => apiService.getSiteTelemetry(siteId, { start_date: w.start_date, end_date: w.end_date, aggregate }))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) telemetryRows.push(...r.value);
        }
        telemetryRows.sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
      }

      const [fcst, wth, devices] = await forecastWeatherPromise;

      let latestRawRows: any[] = [];
      try {
        const raw = await apiService.getSiteTelemetry(siteId, {
          start_date: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
          end_date: now.toISOString(),
          aggregate: 'none',
        });
        latestRawRows = Array.isArray(raw) ? raw : [];
      } catch {
        latestRawRows = [];
      }

      if (latestRawRows.length > 0) {
        // Prefer the last non-standby row — run_state=0 zeros all registers.
        const liveRow = latestRawRows.slice().reverse().find(r => Number(r.run_state) !== 0) ?? latestRawRows[latestRawRows.length - 1];
        setLatestLiveTelemetry(liveRow ?? null);
      } else {
        setLatestLiveTelemetry(null);
      }

      dispatchFetch({ type: 'FETCH_SUCCESS', payload: {
        telemetry: telemetryRows,
        forecast: Array.isArray(fcst) ? fcst : [],
        weather: wth || null,
        smartDevices: Array.isArray(devices) ? devices : [],
        lastUpdated: new Date(),
      }});

      // Fire analytics after primary data renders.
      // analyticsStaleRef is set to true by the useEffect cleanup (below fetchAll
      // call site) when siteId changes or the component unmounts, preventing stale
      // state updates on an unmounted/switched component.
      Promise.allSettled([
        apiService.getPhaseLoad(siteId, phaseLoadHours, 'raw'),
        apiService.getForecastAccuracy(siteId, 30),
        apiService.getLoadForecast(siteId, 7),
        apiService.getWeatherAccuracy(siteId, 7),
        apiService.getLoadForecastAccuracy(siteId, 7),
      ]).then(([pl, fa, lf, wa, lfa]) => {
        if (analyticsStaleRef.current) return;
        if (pl.status === 'fulfilled') setPhaseLoad(Array.isArray(pl.value) ? pl.value : []);
        if (fa.status === 'fulfilled') setForecastAccuracy(fa.value ?? null);
        if (lf.status === 'fulfilled') setLoadForecast(Array.isArray(lf.value) ? lf.value : []);
        if (wa.status === 'fulfilled') setWeatherAccuracy(wa.value ?? null);
        if (lfa.status === 'fulfilled') setLoadForecastAccuracy(lfa.value ?? null);
      });
    } catch (err) {
      dispatchFetch({ type: 'FETCH_ERROR', error: err instanceof Error ? err.message : 'Failed to load site data' });
    } finally {
      isInitialLoad.current = false;
    }
  }, [siteId, dateRange, debouncedStart, debouncedEnd, phaseLoadHours]);

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
    isInitialLoad.current = true;
    analyticsStaleRef.current = false;
    dispatchFetch({ type: 'FETCH_START' });
    fetchAll(false).then(() => fetchHistory());
    if (!autoRefresh) return () => { analyticsStaleRef.current = true; };
    const fullId = setInterval(() => fetchAll(false).then(() => fetchHistory()), 5 * 60_000);
    return () => {
      analyticsStaleRef.current = true;
      clearInterval(fullId);
    };
  }, [fetchAll, fetchHistory, autoRefresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const fastId = setInterval(fetchLatestTelemetry, 30_000);
    return () => clearInterval(fastId);
  }, [fetchLatestTelemetry, autoRefresh]);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      dispatchFetch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  useEffect(() => {
    forecastZoom.resetZoom();
  }, [forecastWindow]);

  useEffect(() => {
    historyZoom.resetZoom();
  }, [dateRange]);

  useEffect(() => {
    apiService.getPhaseLoad(siteId, phaseLoadHours, 'raw')
      .then(data => setPhaseLoad(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [siteId, phaseLoadHours]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const latest = latestLiveTelemetry ?? (telemetry.length > 0 ? telemetry[telemetry.length - 1] : null);

  const pvKw = latest ? (
    (Number(latest.pv1_power_w ?? 0) + Number(latest.pv2_power_w ?? 0) + Number(latest.pv3_power_w ?? 0) + Number(latest.pv4_power_w ?? 0)) / 1000
  ) : null;
  const batSoc = latest?.battery_soc_percent ?? null;
  const loadKwRaw = latest ? (latest.load_power_w ?? 0) / 1000 : null;
  const todayKwh    = latest?.pv_today_kwh    ?? null;
  const totalPvKwh  = latest?.pv_total_kwh    ?? null;
  const gridKw = latest ? (latest.grid_power_w ?? 0) / 1000 : null;
  const batPowerKw = latest ? (latest.battery_power_w ?? 0) / 1000 : null;
  const invTemp = latest?.inverter_temp_c ?? null;
  const batVoltage = latest?.battery_voltage_v ?? null;
  const runState = latest?.run_state;
  const acOutputKw = latest?.ac_output_power_w != null ? latest.ac_output_power_w / 1000 : null;
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

  const gridL1PowerW  = latest?.grid_l1_power_w   || latest?.grid_power_w   || null;
  const gridL2PowerW  = latest?.grid_l2_power_w   || null;
  const gridL3PowerW  = latest?.grid_l3_power_w   || null;
  const gridL1VoltageV = latest?.grid_l1_voltage_v || latest?.grid_voltage_v || null;
  const gridL2VoltageV = latest?.grid_l2_voltage_v || null;
  const gridL3VoltageV = latest?.grid_l3_voltage_v || null;
  const gridL1CurrentA = latest?.grid_l1_current_a || null;
  const gridL2CurrentA = latest?.grid_l2_current_a || null;
  const gridL3CurrentA = latest?.grid_l3_current_a || null;

  const hasPhaseData = (gridL1PowerW != null && gridL1PowerW !== 0) || gridL2PowerW != null || gridL3PowerW != null
    || (gridL1VoltageV != null && gridL1VoltageV > 50);
  const phaseSum = (gridL1PowerW ?? 0) + (gridL2PowerW ?? 0) + (gridL3PowerW ?? 0);
  const gridTotalW = (gridKw ?? 0) * 1000;
  const phaseDataStale = hasPhaseData && Math.abs(gridTotalW) < 50
    ? Math.abs(phaseSum) > 200
    : Math.abs(phaseSum - gridTotalW) > Math.abs(gridTotalW) * 3 + 200;

  const gridPhases = hasPhaseData ? [
    { label: 'L1', powerW: gridL1PowerW, voltageV: gridL1VoltageV, currentA: gridL1CurrentA },
    { label: 'L2', powerW: gridL2PowerW, voltageV: gridL2VoltageV, currentA: gridL2CurrentA },
    { label: 'L3', powerW: gridL3PowerW, voltageV: gridL3VoltageV, currentA: gridL3CurrentA },
  ] : null;

  const loadL1PowerW = latest?.load_l1_power_w || null;
  const loadL2PowerW = latest?.load_l2_power_w || null;
  const loadL3PowerW = latest?.load_l3_power_w || null;
  const hasLoadPhaseData = loadL1PowerW != null || loadL2PowerW != null || loadL3PowerW != null;
  const loadPhaseSumW = hasLoadPhaseData ? (loadL1PowerW ?? 0) + (loadL2PowerW ?? 0) + (loadL3PowerW ?? 0) : null;
  const loadKw = loadPhaseSumW != null ? loadPhaseSumW / 1000 : loadKwRaw;
  const loadPowerDisplay = formatPowerForKpi(loadKw);
  const loadPhases = hasLoadPhaseData ? [
    { label: 'L1', powerW: loadL1PowerW },
    { label: 'L2', powerW: loadL2PowerW },
    { label: 'L3', powerW: loadL3PowerW },
  ] : null;
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
    runState === 2 ? { label: 'Normal',     color: '#00a63e' } :
    runState === 3 ? { label: 'Alarm',      color: '#f59e0b' } :
    runState === 4 ? { label: 'Fault',      color: '#ef4444' } :
    runState === 5 ? { label: 'Activating', color: '#a78bfa' } :
      { label: `State ${runState}`, color: 'var(--muted-foreground)' }
  ) : null;

  const invTempColor = invTemp == null ? 'var(--muted-foreground)'
    : invTemp > 60 ? '#ef4444'
    : invTemp > 45 ? '#f59e0b'
    : '#10b981';

  // ── Chart data for HistoryTab ──────────────────────────────────────────────
  const historyData = useMemo(() => {
    return telemetry.map(row => {
      const d = new Date(row.timestamp);
      const timeLabel = dateRange === '7d'
        ? `${d.toLocaleDateString([], { weekday: 'short', timeZone: IST })} || ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST })}`
        : fmt(row.timestamp, dateRange);
      return {
        time: timeLabel,
        'PV (kW)': +(((row.pv1_power_w ?? 0) + (row.pv2_power_w ?? 0) + (row.pv3_power_w ?? 0) + (row.pv4_power_w ?? 0)) / 1000).toFixed(2),
        'Load (kW)': +((row.load_power_w ?? 0) / 1000).toFixed(2),
        'Grid (kW)': +((row.grid_power_w ?? 0) / 1000).toFixed(2),
        'Inv Out (kW)': +((row.ac_output_power_w ?? 0) / 1000).toFixed(2),
        'Batt SOC (%)': row.battery_soc_percent ?? null,
      };
    });
  }, [telemetry, dateRange]);

  const historyStatsVisible = useMemo(() => {
    const data = historyData;
    if (!data.length) return null;
    const intervalH = inferBucketHours(telemetry);
    const pvs     = data.map(d => d['PV (kW)'] as number).filter(v => v != null);
    const loads   = data.map(d => d['Load (kW)'] as number).filter(v => v != null);
    const grids   = data.map(d => d['Grid (kW)'] as number).filter(v => v != null);
    const invOuts = data.map(d => d['Inv Out (kW)'] as number).filter(v => v != null);
    const socs    = data.map(d => d['Batt SOC (%)'] as number | null).filter((v): v is number => v != null);
    const pvTotal    = pvs.reduce((s, v) => s + v, 0) * intervalH;
    const pvPeak     = pvs.length ? Math.max(...pvs) : 0;
    const loadTotal  = loads.reduce((s, v) => s + v, 0) * intervalH;
    const loadPeak   = loads.length ? Math.max(...loads) : 0;
    const loadAvg    = loads.length ? loads.reduce((s, v) => s + v, 0) / loads.length : 0;
    const invOutPeak = invOuts.length ? Math.max(...invOuts) : 0;
    const invOutAvg  = invOuts.length ? invOuts.reduce((s, v) => s + v, 0) / invOuts.length : 0;
    const gridExportStat = grids.filter(v => v < 0).reduce((s, v) => s + Math.abs(v), 0) * intervalH;
    const gridImportStat = grids.filter(v => v > 0).reduce((s, v) => s + v, 0) * intervalH;
    const socMin = socs.length ? Math.min(...socs) : null;
    const socMax = socs.length ? Math.max(...socs) : null;
    const socAvg = socs.length ? socs.reduce((s, v) => s + v, 0) / socs.length : null;
    return { pvTotal, pvPeak, loadTotal, loadPeak, loadAvg, invOutPeak, invOutAvg, gridImport: gridImportStat, gridExport: gridExportStat, socMin, socMax, socAvg };
  }, [historyData, telemetry]);

  const historyResolutionLabel = useMemo(
    () => getHistoryResolutionLabel(dateRange, debouncedStart, debouncedEnd),
    [dateRange, debouncedStart, debouncedEnd]
  );

  // activeVsActualData for HistoryTab (today vs-actual from forecast+telemetry overlap)
  const vsActualData = useMemo(() => {
    const todayISTStr = istDate(new Date());
    const todayForecast = forecast.filter(row => {
      const clean = row.forecast_for || row.timestamp.replace('FORECAST#', '');
      return istDate(new Date(clean)) === todayISTStr && row.p50_kw != null;
    });
    if (!todayForecast.length || !telemetry.length) return [];

    const WINDOW_MS = 15 * 60 * 1000;
    const telTs = telemetry.map(t => ({ ms: new Date(t.timestamp).getTime(), row: t }));
    telTs.sort((a, b) => a.ms - b.ms);
    const tsMsArr = telTs.map(t => t.ms);

    return todayForecast.map(frow => {
      const clean = frow.forecast_for || frow.timestamp.replace('FORECAST#', '');
      const fTs = new Date(clean).getTime();
      const label = new Date(clean).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST });

      let lo = 0, hi = tsMsArr.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (tsMsArr[mid] < fTs) lo = mid + 1; else hi = mid; }
      let nearest: any = null;
      let minDiff = Infinity;
      for (const idx of [lo - 1, lo]) {
        if (idx < 0 || idx >= telTs.length) continue;
        const diff = Math.abs(telTs[idx].ms - fTs);
        if (diff < minDiff && diff <= WINDOW_MS) { minDiff = diff; nearest = telTs[idx].row; }
      }

      const actualKw = nearest
        ? +(((nearest.pv1_power_w ?? 0) + (nearest.pv2_power_w ?? 0) + (nearest.pv3_power_w ?? 0) + (nearest.pv4_power_w ?? 0)) / 1000).toFixed(2)
        : null;
      const p50 = +Number(frow.p50_kw).toFixed(2);
      const diffPct = actualKw != null && p50 > 0
        ? Math.round(((actualKw - p50) / p50) * 100)
        : null;

      return { label, fTs, p50, actual: actualKw, diffPct };
    });
  }, [forecast, telemetry]);

  const vsActual7dData = useMemo(() => {
    const ts: any[] = forecastAccuracy?.timeseries ?? [];
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const BUCKET_MS = 15 * 60 * 1000;
    const bucketMap = new Map<number, { sumActual: number; count: number; predicted_kw: number | null }>();
    ts
      .filter((r: any) => r.actual_kw != null && !!r.slot_ts)
      .map((r: any) => ({ ...r, __ms: new Date(r.slot_ts).getTime() }))
      .filter((r: any) => !Number.isNaN(r.__ms) && r.__ms >= cutoffMs)
      .forEach((r: any) => {
        const bMs = Math.floor(r.__ms / BUCKET_MS) * BUCKET_MS;
        const b = bucketMap.get(bMs) ?? { sumActual: 0, count: 0, predicted_kw: r.predicted_kw ?? null };
        b.sumActual += r.actual_kw; b.count += 1;
        if (b.predicted_kw == null && r.predicted_kw != null) b.predicted_kw = r.predicted_kw;
        bucketMap.set(bMs, b);
      });
    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([bMs, b]) => {
        const actual = b.count > 0 ? +Number(b.sumActual / b.count).toFixed(2) : null;
        return {
          label: new Date(bMs).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: IST }),
          fTs: bMs,
          p50: b.predicted_kw != null ? +Number(b.predicted_kw).toFixed(2) : null,
          actual,
          diffPct: actual != null && b.predicted_kw != null && b.predicted_kw > 0
            ? Math.round(((actual - b.predicted_kw) / b.predicted_kw) * 100)
            : null,
        };
      });
  }, [forecastAccuracy]);

  const activeVsActualData = vsActual7d ? vsActual7dData : vsActualData;

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

  const onToggleVsActual7d = useCallback(() => {
    cacheService.clear(`forecast_accuracy_${siteId}_30`);
    setForecastAccuracy(null);
    setVsActual7d(v => !v);
    apiService.getForecastAccuracy(siteId, 30).then(fa => setForecastAccuracy(fa ?? null)).catch(() => {});
  }, [siteId]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
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

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: 24,
          color: '#ef4444',
          fontSize: '0.875rem',
          background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.06)',
          borderRadius: 16,
          marginTop: 16,
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      >
        Failed to load data for <strong>{siteId}</strong>: {error}
      </motion.div>
    );
  }

  const noData = telemetry.length === 0 && forecast.length === 0 && !weather;

  return (
    <div style={{ marginTop: 24 }}>
      {/* ── Section header with glassmorphism ── */}
      {!hideHeader && <motion.div
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
          border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.25)'}`,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(activeTab === 'overview' || activeTab === 'history') && (
              <>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(0, 166, 62, 0.3)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                  }}
                >
                  <option value="24h">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
                {dateRange === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      style={{
                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(0, 166, 62, 0.3)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                      }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                      style={{
                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(0, 166, 62, 0.3)',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: 600,
                      }}
                    />
                  </>
                )}
              </>
            )}
            {activeTab === 'forecast' && forecastSubTab === 'chart' && (
              <select
                value={forecastWindow}
                onChange={e => setForecastWindow(e.target.value as 'today' | '3d' | '2d')}
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(0, 166, 62, 0.3)',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 600,
                }}
              >
                <option value="today">Today</option>
                <option value="2d">Next 48 hours</option>
                <option value="3d">Next 3 days</option>
              </select>
            )}
          </div>
          {lastUpdated && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: secondsSinceUpdate < 60 ? '#22c55e' : '#f59e0b',
                boxShadow: secondsSinceUpdate < 60 ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
                animation: secondsSinceUpdate < 60 ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />
              {secondsSinceUpdate < 60
                ? `${secondsSinceUpdate}s ago`
                : secondsSinceUpdate < 3600
                ? `${Math.floor(secondsSinceUpdate / 60)}m ago`
                : lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }) + ' IST'}
            </span>
          )}
          <motion.button
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300 }}
            onClick={() => { fetchAll(true); }}
            style={{
              background: 'none',
              border: '1px solid rgba(0, 166, 62, 0.3)',
              borderRadius: 8,
              padding: '4px 12px',
              fontSize: '0.75rem',
              color: '#00a63e',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </motion.button>
        </div>
      </motion.div>}

      {noData ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            background: isDark ? 'rgba(0, 166, 62, 0.05)' : 'rgba(0, 166, 62, 0.03)',
            borderRadius: 16,
            border: '1px dashed rgba(0, 166, 62, 0.2)',
          }}
        >
          No data found for site <strong style={{ color: '#00a63e' }}>{siteId}</strong> for{' '}
          {dateRange === '24h' ? 'today' : dateRange === '7d' ? 'the last 7 days' : dateRange === '30d' ? 'the last 30 days' : 'the selected date range'}
          .<br />
          <span style={{ fontSize: '0.8rem' }}>Telemetry is posted by the gateway device. Forecast and weather data load once telemetry is available.</span>
        </motion.div>
      ) : (
        <>
          {/* ── Tab Bar ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              display: hideTabs ? 'none' : 'flex',
              borderBottom: `2px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.25)'}`,
              marginBottom: 20,
              gap: 0,
              background: isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(249, 250, 251, 0.5)',
              borderRadius: '12px 12px 0 0',
              padding: '0 8px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {TABS.filter(tab => !visibleTabs || visibleTabs.includes(tab.id)).map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    border: 'none',
                    background: isActive
                      ? isDark
                        ? 'linear-gradient(135deg, rgba(0, 166, 62, 0.25), rgba(0, 166, 62, 0.08))'
                        : 'linear-gradient(135deg, rgba(0, 166, 62, 0.1), rgba(0, 166, 62, 0.05))'
                      : 'transparent',
                    cursor: 'pointer',
                    padding: '12px 20px',
                    fontSize: '0.813rem',
                    fontWeight: isActive ? 700 : 600,
                    fontFamily: 'Poppins, sans-serif',
                    color: isActive ? '#00a63e' : 'var(--text-muted)',
                    borderBottom: `3px solid ${isActive ? '#00a63e' : 'transparent'}`,
                    marginBottom: -2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.3s',
                    letterSpacing: '0.02em',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: isActive ? '0 -2px 10px rgba(0, 166, 62, 0.2)' : 'none',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </motion.button>
              );
            })}
          </motion.div>

          {/* ── Tab Content ── */}
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
                inverterPhasesForFlow={inverterPhasesForFlow}
                isDeyeCloud={isDeyeCloud}
                rs485Stale={rs485Stale}
                isLatestToday={isLatestToday}
                achievedPct={achievedPct}
                runStateBadge={runStateBadge}
                loggerOffline={loggerOffline}
                gatewayOffline={gatewayOffline}
                deyeCloudAgeMs={deyeCloudAgeMs}
                ctStale={ctStale}
                ctAgeMs={ctAgeMs}
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
                gridPhases={gridPhases}
                phaseDataStale={phaseDataStale}
                loadPhases={loadPhases}
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
              <HistoryTab
                key="history"
                telemetry={telemetry}
                isDark={isDark}
                isTouch={isTouch}
                historyError={historyError}
                dateRange={dateRange}
                setDateRange={setDateRange}
                customStartDate={customStartDate}
                setCustomStartDate={setCustomStartDate}
                customEndDate={customEndDate}
                setCustomEndDate={setCustomEndDate}
                historyView={historyView}
                setHistoryView={setHistoryView}
                vsActualView={vsActualView}
                setVsActualView={setVsActualView}
                vsActual7d={vsActual7d}
                setVsActual7d={setVsActual7d}
                showHistorySeries={showHistorySeries}
                setShowHistorySeries={setShowHistorySeries}
                showVsActualSeries={showVsActualSeries}
                setShowVsActualSeries={setShowVsActualSeries}
                historyZoom={historyZoom}
                vsActualZoom={vsActualZoom}
                historyChartOptions={historyChartOptions}
                vsActualChartOptions={vsActualChartOptions}
                historyData={historyData}
                historyResolutionLabel={historyResolutionLabel}
                historyStatsVisible={historyStatsVisible}
                loading={loading}
                activeVsActualData={activeVsActualData}
                siteId={siteId}
                onToggleVsActual7d={onToggleVsActual7d}
              />
            )}

            {activeTab === 'forecast' && (
              <ForecastTab
                key="forecast"
                forecast={forecast}
                isDark={isDark}
                siteId={siteId}
                forecastSubTab={forecastSubTab}
                setForecastSubTab={setForecastSubTab}
                forecastZoom={forecastZoom}
                vsActualZoom={vsActualZoom}
                showBands={showBands}
                setShowBands={setShowBands}
                showVsActualSeries={showVsActualSeries}
                setShowVsActualSeries={setShowVsActualSeries}
                forecastView={forecastView}
                setForecastView={setForecastView}
                forecastWindow={forecastWindow}
                setForecastWindow={setForecastWindow}
                vsActualView={vsActualView}
                setVsActualView={setVsActualView}
                vsActual7d={vsActual7d}
                setVsActual7d={setVsActual7d}
                forecastAccuracy={forecastAccuracy}
                weatherAccuracy={weatherAccuracy}
                achievedPct={achievedPct}
              />
            )}

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
        </>
      )}
    </div>
  );
};

export default SiteDataPanel;
