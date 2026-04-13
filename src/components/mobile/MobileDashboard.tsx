import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiService, AlertItem } from '../../services/api';
import {
  Sun, Battery, Zap, TrendingUp, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, MapPin, Clock, RefreshCw, Wifi, WifiOff,
  Compass, Globe, Thermometer, CloudSun, Droplets, Wind,
  Activity, BarChart3,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { IST_TIMEZONE } from '../../constants';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

// ── Interfaces ────────────────────────────────────────────────────────────────

interface SiteDevice { device_id: number; device_serial: string; is_online: boolean; }
interface Site {
  site_id: string; display_name: string; capacity_kw: number;
  inverter_capacity_kw?: number | null; latitude: number; longitude: number;
  timezone: string; devices: SiteDevice[]; tilt_deg?: number; azimuth_deg?: number;
  is_active?: boolean; site_status?: string;
}
interface TelemetryRow {
  timestamp: string;
  pv1_power_w?: number; pv2_power_w?: number; pv3_power_w?: number; pv4_power_w?: number;
  grid_power_w?: number; load_power_w?: number; battery_power_w?: number;
  battery_soc_percent?: number; pv_today_kwh?: number; load_today_kwh?: number;
  grid_export_today_kwh?: number; grid_import_today_kwh?: number;
  battery_charge_today_kwh?: number; battery_discharge_today_kwh?: number;
  battery_voltage_v?: number;
}
interface WeatherData {
  current?: {
    temperature_c?: number; feels_like_c?: number; humidity_pct?: number;
    wind_speed_kmh?: number; description?: string; cloud_cover_pct?: number;
    uv_index?: number; solar_irradiance_wm2?: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const siteIsOnline = (site: Site) => site.devices.some(d => d.is_online);
const fmtKW  = (w: number | null | undefined) => w != null ? `${(Math.abs(w) / 1000).toFixed(1)}` : '—';
const fmtKWh = (k: number | null | undefined) => k != null ? `${k.toFixed(1)}` : '—';
function startOfTodayIST(): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  return new Date(`${todayStr}T00:00:00+05:30`).toISOString();
}

// ── Power Flow Diagram ────────────────────────────────────────────────────────

interface PowerFlowProps {
  pvW: number | null; loadW: number | null; gridW: number | null;
  batW: number | null; soc: number | null; batV: number | null;
  isExporting: boolean; isImporting: boolean;
  isBatCharging: boolean; isBatDischarging: boolean;
  isDark: boolean;
}

const PowerFlowDiagram: React.FC<PowerFlowProps> = ({
  pvW, loadW, gridW, batW, soc, batV,
  isExporting, isImporting, isBatCharging, isBatDischarging, isDark,
}) => {
  // 4-corner layout: viewBox 0 0 320 230
  // Solar TL · Battery TR · Grid BL · Load BR · Center hub
  const PV  = { x: 62,  y: 52  }; // Solar — top-left
  const BAT = { x: 258, y: 52  }; // Battery — top-right
  const GRD = { x: 62,  y: 178 }; // Grid — bottom-left
  const LOD = { x: 258, y: 178 }; // Load — bottom-right
  const CTR = { x: 160, y: 115 }; // Center hub

  const R  = 22; // corner node radius
  const RC = 10; // center hub radius

  // Helper: edge point from node toward target
  const edge = (from: {x:number,y:number}, to: {x:number,y:number}, r: number) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    return { x: from.x + (dx/len)*r, y: from.y + (dy/len)*r };
  };

  // Connector endpoints (node edge → center edge)
  const pvOut  = edge(PV,  CTR, R);   const ctrPv  = edge(CTR, PV,  RC);
  const batOut = edge(BAT, CTR, R);   const ctrBat = edge(CTR, BAT, RC);
  const grdOut = edge(GRD, CTR, R);   const ctrGrd = edge(CTR, GRD, RC);
  const lodOut = edge(LOD, CTR, R);   const ctrLod = edge(CTR, LOD, RC);

  // Colors
  const C_SOLAR  = '#f59e0b';
  const C_LOAD   = '#3b82f6';
  const C_GRID_E = '#22c55e';
  const C_GRID_I = '#f59e0b';
  const C_BAT_C  = '#22c55e';
  const C_BAT_D  = '#a78bfa';
  const track    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
  const nodeRing = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const nodeFill = isDark ? '#0d1829' : '#ffffff';
  const tf  = isDark ? '#f1f5f9' : '#0f172a';
  const tf2 = isDark ? '#94a3b8' : '#64748b';

  const pvActive   = pvW   != null && pvW   > 10;
  const ldActive   = loadW != null && loadW > 10;
  const gridActive = isExporting || isImporting;
  const batActive  = isBatCharging || isBatDischarging;

  const gridColor = isExporting ? C_GRID_E : C_GRID_I;
  const batColor  = isBatCharging ? C_BAT_C : C_BAT_D;

  const spd = (w: number | null) => {
    const a = Math.abs(w ?? 0);
    if (a > 4000) return 500;
    if (a > 2000) return 800;
    if (a > 800)  return 1200;
    return 1800;
  };

  const DA = '5 11';

  // Badge midpoints (on each arm, halfway between node edge and center edge)
  const mid = (a: {x:number,y:number}, b: {x:number,y:number}) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
  const midPV  = mid(pvOut,  ctrPv);
  const midBAT = mid(batOut, ctrBat);
  const midGRD = mid(grdOut, ctrGrd);
  const midLOD = mid(lodOut, ctrLod);

  // Label offsets by corner (avoid SVG edge clipping)
  // Solar TL: label below-right; Battery TR: label below-left;
  // Grid BL: label above-right; Load BR: label above-left
  const labelAnchor = { pv: 'middle', bat: 'middle', grd: 'middle', lod: 'middle' };
  const labelDy = { pv: R+11, bat: R+11, grd: R+11, lod: R+11 };

  return (
    <svg viewBox="0 0 320 230" style={{ width: '100%', display: 'block' }} aria-label="Live power flow">
      <defs>
        <filter id="pf-glow-solar" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="pf-glow-load" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="pf-glow-grid" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="pf-glow-bat" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          @keyframes pf-fwd  { from { stroke-dashoffset: 16 } to { stroke-dashoffset: 0  } }
          @keyframes pf-pulse { 0%,100% { opacity:.7 } 50% { opacity:1 } }
          .pf-node-active { animation: pf-pulse 2s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* ── Track lines ── */}
      {[
        [pvOut, ctrPv], [batOut, ctrBat], [grdOut, ctrGrd], [lodOut, ctrLod]
      ].map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={track} strokeWidth="2.5" strokeLinecap="round"/>
      ))}

      {/* ── Animated flow lines ── */}
      {pvActive && (
        <line x1={pvOut.x} y1={pvOut.y} x2={ctrPv.x} y2={ctrPv.y}
          stroke={C_SOLAR} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={DA}
          style={{ animation: `pf-fwd ${spd(pvW)}ms linear infinite` }}/>
      )}
      {gridActive && (
        <line
          x1={isExporting ? ctrGrd.x : grdOut.x} y1={isExporting ? ctrGrd.y : grdOut.y}
          x2={isExporting ? grdOut.x : ctrGrd.x} y2={isExporting ? grdOut.y : ctrGrd.y}
          stroke={gridColor} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={DA}
          style={{ animation: `pf-fwd ${spd(gridW)}ms linear infinite` }}/>
      )}
      {batActive && (
        <line
          x1={isBatCharging ? ctrBat.x : batOut.x} y1={isBatCharging ? ctrBat.y : batOut.y}
          x2={isBatCharging ? batOut.x : ctrBat.x} y2={isBatCharging ? batOut.y : ctrBat.y}
          stroke={batColor} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={DA}
          style={{ animation: `pf-fwd ${spd(batW)}ms linear infinite` }}/>
      )}
      {ldActive && (
        <line x1={ctrLod.x} y1={ctrLod.y} x2={lodOut.x} y2={lodOut.y}
          stroke={C_LOAD} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={DA}
          style={{ animation: `pf-fwd ${spd(loadW)}ms linear infinite` }}/>
      )}

      {/* ── Center hub ── */}
      <circle cx={CTR.x} cy={CTR.y} r={RC + 4} fill={isDark ? 'rgba(0,166,62,0.12)' : 'rgba(0,166,62,0.08)'} />
      <circle cx={CTR.x} cy={CTR.y} r={RC} fill={nodeFill}
        stroke="#00a63e" strokeWidth="1.5"/>
      {/* 360W logo-like lightning bolt */}
      <polygon points={`${CTR.x+2},${CTR.y-7} ${CTR.x-3},${CTR.y-1} ${CTR.x+1},${CTR.y-1} ${CTR.x-2},${CTR.y+7} ${CTR.x+4},${CTR.y+0} ${CTR.x-0},${CTR.y+0}`}
        fill="#00a63e" opacity="0.9"/>

      {/* ── kW badges ── */}
      {pvActive && (
        <g>
          <rect x={midPV.x-18} y={midPV.y-9} width="36" height="17" rx="8"
            fill={isDark ? '#1e2d40' : '#fffbeb'} stroke={C_SOLAR} strokeWidth="1"/>
          <text x={midPV.x} y={midPV.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C_SOLAR}>
            {(Math.abs(pvW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}
      {gridActive && (
        <g>
          <rect x={midGRD.x-18} y={midGRD.y-9} width="36" height="17" rx="8"
            fill={isDark ? '#1e2d40' : '#f0fdf4'} stroke={gridColor} strokeWidth="1"/>
          <text x={midGRD.x} y={midGRD.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={gridColor}>
            {(Math.abs(gridW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}
      {batActive && (
        <g>
          <rect x={midBAT.x-18} y={midBAT.y-9} width="36" height="17" rx="8"
            fill={isDark ? '#1e2d40' : '#f5f3ff'} stroke={batColor} strokeWidth="1"/>
          <text x={midBAT.x} y={midBAT.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={batColor}>
            {(Math.abs(batW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}
      {ldActive && (
        <g>
          <rect x={midLOD.x-18} y={midLOD.y-9} width="36" height="17" rx="8"
            fill={isDark ? '#1e2d40' : '#eff6ff'} stroke={C_LOAD} strokeWidth="1"/>
          <text x={midLOD.x} y={midLOD.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C_LOAD}>
            {(Math.abs(loadW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}

      {/* ── SOLAR node (top-left) ── */}
      <circle cx={PV.x} cy={PV.y} r={R+5} fill={pvActive ? `${C_SOLAR}18` : 'none'}/>
      <circle cx={PV.x} cy={PV.y} r={R} fill={nodeFill}
        stroke={pvActive ? C_SOLAR : nodeRing} strokeWidth={pvActive ? 2 : 1.5}
        filter={pvActive ? 'url(#pf-glow-solar)' : undefined}
        className={pvActive ? 'pf-node-active' : undefined}/>
      <circle cx={PV.x} cy={PV.y} r="6" fill={pvActive ? C_SOLAR : tf2} opacity={pvActive ? 1 : 0.4}/>
      {[0,45,90,135,180,225,270,315].map((deg,i) => {
        const rad = deg*Math.PI/180;
        return <line key={i}
          x1={PV.x+Math.cos(rad)*8} y1={PV.y+Math.sin(rad)*8}
          x2={PV.x+Math.cos(rad)*11} y2={PV.y+Math.sin(rad)*11}
          stroke={pvActive ? C_SOLAR : tf2} strokeWidth="1.5" strokeLinecap="round"
          opacity={pvActive ? 1 : 0.35}/>;
      })}
      <text x={PV.x} y={PV.y+R+11} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={pvActive ? C_SOLAR : tf2} opacity={pvActive ? 1 : 0.55}>
        {pvW != null ? `${(pvW/1000).toFixed(1)} kW` : '—'}
      </text>
      <text x={PV.x} y={PV.y+R+20} textAnchor="middle" fontSize="7.5" fill={tf2} opacity="0.75">Solar PV</text>

      {/* ── BATTERY node (top-right) ── */}
      <circle cx={BAT.x} cy={BAT.y} r={R+5} fill={batActive ? `${batColor}18` : 'none'}/>
      <circle cx={BAT.x} cy={BAT.y} r={R} fill={nodeFill}
        stroke={batActive ? batColor : nodeRing} strokeWidth={batActive ? 2 : 1.5}
        filter={batActive ? 'url(#pf-glow-bat)' : undefined}
        className={batActive ? 'pf-node-active' : undefined}/>
      <rect x={BAT.x-8} y={BAT.y-6} width="16" height="10" rx="2"
        fill="none" stroke={batActive ? batColor : tf2} strokeWidth="1.6" opacity={batActive ? 1 : 0.4}/>
      <rect x={BAT.x+8} y={BAT.y-3.5} width="2.5" height="5" rx="1"
        fill={batActive ? batColor : tf2} opacity={batActive ? 1 : 0.4}/>
      {soc != null && (
        <rect x={BAT.x-6.5} y={BAT.y-4.5}
          width={Math.max(0,(soc/100)*13)} height="7" rx="1"
          fill={soc < 20 ? '#ef4444' : soc < 50 ? '#f59e0b' : batActive ? batColor : '#22c55e'}
          opacity="0.85"/>
      )}
      <text x={BAT.x} y={BAT.y+R+11} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={batActive ? batColor : tf2} opacity={batActive ? 1 : 0.55}>
        {soc != null ? `${Math.round(soc)}%` : '—%'}{batV != null ? ` · ${batV.toFixed(0)}V` : ''}
      </text>
      <text x={BAT.x} y={BAT.y+R+20} textAnchor="middle" fontSize="7.5" fill={tf2} opacity="0.75">
        {isBatCharging ? 'Charging' : isBatDischarging ? 'Discharge' : 'Battery'}
      </text>

      {/* ── GRID node (bottom-left) ── */}
      <circle cx={GRD.x} cy={GRD.y} r={R+5} fill={gridActive ? `${gridColor}18` : 'none'}/>
      <circle cx={GRD.x} cy={GRD.y} r={R} fill={nodeFill}
        stroke={gridActive ? gridColor : nodeRing} strokeWidth={gridActive ? 2 : 1.5}
        filter={gridActive ? 'url(#pf-glow-grid)' : undefined}
        className={gridActive ? 'pf-node-active' : undefined}/>
      <line x1={GRD.x} y1={GRD.y-11} x2={GRD.x} y2={GRD.y+8}
        stroke={gridActive ? gridColor : tf2} strokeWidth="1.8" strokeLinecap="round" opacity={gridActive ? 1 : 0.4}/>
      {[-6,0,6].map((dy,i) => (
        <line key={i} x1={GRD.x-5.5} y1={GRD.y+dy-3} x2={GRD.x+5.5} y2={GRD.y+dy-3}
          stroke={gridActive ? gridColor : tf2} strokeWidth="1.4" strokeLinecap="round" opacity={gridActive ? 1 : 0.35}/>
      ))}
      <text x={GRD.x} y={GRD.y+R+11} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={gridActive ? gridColor : tf2} opacity={gridActive ? 1 : 0.55}>
        {gridW != null ? `${(Math.abs(gridW)/1000).toFixed(1)} kW` : '—'}
      </text>
      <text x={GRD.x} y={GRD.y+R+20} textAnchor="middle" fontSize="7.5" fill={tf2} opacity="0.75">
        {isExporting ? 'Exporting' : isImporting ? 'Importing' : 'Grid'}
      </text>

      {/* ── LOAD node (bottom-right) ── */}
      <circle cx={LOD.x} cy={LOD.y} r={R+5} fill={ldActive ? `${C_LOAD}12` : 'none'}/>
      <circle cx={LOD.x} cy={LOD.y} r={R} fill={nodeFill}
        stroke={ldActive ? C_LOAD : nodeRing} strokeWidth={ldActive ? 2 : 1.5}
        filter={ldActive ? 'url(#pf-glow-load)' : undefined}/>
      <polygon points={`${LOD.x},${LOD.y-10} ${LOD.x-9},${LOD.y-2} ${LOD.x+9},${LOD.y-2}`}
        fill={ldActive ? C_LOAD : tf2} opacity={ldActive ? 0.9 : 0.35}/>
      <rect x={LOD.x-6.5} y={LOD.y-2} width="13" height="10" rx="1"
        fill={ldActive ? C_LOAD : tf2} opacity={ldActive ? 0.9 : 0.35}/>
      <rect x={LOD.x-2.5} y={LOD.y+2} width="5" height="6" rx="1" fill={nodeFill}/>
      <text x={LOD.x} y={LOD.y+R+11} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={ldActive ? C_LOAD : tf2} opacity={ldActive ? 1 : 0.55}>
        {loadW != null ? `${(loadW/1000).toFixed(1)} kW` : '—'}
      </text>
      <text x={LOD.x} y={LOD.y+R+20} textAnchor="middle" fontSize="7.5" fill={tf2} opacity="0.75">Consumption</text>
    </svg>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const MobileDashboard: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#060d18' : '#f0fdf4';
  const surface = isDark ? '#0d1829' : '#ffffff';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,166,62,0.14)';
  const text    = isDark ? '#f1f5f9' : '#0f172a';
  const muted   = isDark ? '#64748b' : '#94a3b8';
  const sub     = isDark ? '#94a3b8' : '#475569';
  const accent  = '#00a63e';

  const [sites, setSites]         = useState<Site[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allAlerts, setAllAlerts] = useState<AlertItem[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [telLoading, setTelLoading] = useState(false);
  const [weather, setWeather]     = useState<WeatherData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const sitesInit = useRef(false);

  const site = useMemo(() => sites.find(s => s.site_id === selectedId) ?? null, [sites, selectedId]);

  const activeAlerts = useMemo(() => {
    if (!site) return [];
    const ids = new Set(site.devices.map(d => d.device_id));
    return allAlerts.filter(a => ids.has(parseInt(a.device_id)) && !a.resolved && (a.status === 'active' || a.status === 'acknowledged' || a.status == null));
  }, [allAlerts, site]);

  const lat = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;
  const pvW    = lat ? (lat.pv1_power_w ?? 0) + (lat.pv2_power_w ?? 0) + (lat.pv3_power_w ?? 0) + (lat.pv4_power_w ?? 0) : null;
  const gridW  = lat?.grid_power_w ?? null;
  const loadW  = lat?.load_power_w ?? null;
  const batW   = lat?.battery_power_w ?? null;
  const soc    = lat?.battery_soc_percent ?? null;
  const batV   = lat?.battery_voltage_v ?? null;
  const pvKWh  = lat?.pv_today_kwh ?? null;
  const ldKWh  = lat?.load_today_kwh ?? null;
  const exKWh  = lat?.grid_export_today_kwh ?? null;
  const imKWh  = lat?.grid_import_today_kwh ?? null;
  const bcKWh  = lat?.battery_charge_today_kwh ?? null;
  const bdKWh  = lat?.battery_discharge_today_kwh ?? null;
  const selfSuf = pvKWh != null && ldKWh != null && ldKWh > 0 ? Math.min(100, Math.round((pvKWh / ldKWh) * 100)) : null;
  const isExporting = gridW != null && gridW < -50;
  const isImporting = gridW != null && gridW > 50;
  const isBatCharging = batW != null && batW > 50;
  const isBatDischarging = batW != null && batW < -50;
  const online = site ? siteIsOnline(site) : false;

  const fetchAll = useCallback(async () => {
    try {
      const [sitesData, alertsData] = await Promise.all([apiService.getAllSites(), apiService.getAlerts()]);
      setSites(sitesData);
      if (sitesData.length > 0 && !sitesInit.current) {
        setSelectedId(sitesData[0].site_id);
        sitesInit.current = true;
      }
      setAllAlerts(Array.isArray(alertsData) ? alertsData : []);
    } catch { } finally { setSitesLoading(false); setRefreshing(false); }
  }, []);

  const fetchTelemetry = useCallback(async (id: string) => {
    setTelLoading(true);
    try {
      const d = await apiService.getSiteTelemetry(id, { start_date: startOfTodayIST(), end_date: new Date().toISOString() });
      setTelemetry(Array.isArray(d) ? d : []);
    } catch { setTelemetry([]); } finally { setTelLoading(false); }
  }, []);

  const fetchWeather = useCallback(async (id: string) => {
    try { const w = await apiService.getSiteWeather(id); setWeather(w); } catch { setWeather(null); }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selectedId) return;
    fetchTelemetry(selectedId);
    fetchWeather(selectedId);
    const id = setInterval(() => fetchTelemetry(selectedId), 60_000);
    return () => clearInterval(id);
  }, [selectedId, fetchTelemetry, fetchWeather]);

  const chartData = useMemo(() => {
    const rows = telemetry.filter(r => r.pv1_power_w != null || r.load_power_w != null);
    return {
      labels: rows.map(r => {
        const d = new Date(r.timestamp);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
      datasets: [
        {
          label: 'PV', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
          borderColor: '#eab308',
          backgroundColor: isDark ? 'rgba(234,179,8,0.12)' : 'rgba(234,179,8,0.1)',
          data: rows.map(r => +(((r.pv1_power_w ?? 0) + (r.pv2_power_w ?? 0) + (r.pv3_power_w ?? 0) + (r.pv4_power_w ?? 0)) / 1000).toFixed(2)),
        },
        {
          label: 'Load', fill: false, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
          borderColor: '#3b82f6', borderDash: [4, 3],
          data: rows.map(r => r.load_power_w != null ? +((r.load_power_w) / 1000).toFixed(2) : null),
        },
      ],
    };
  }, [telemetry, isDark]);

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 0 } as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { size: 10 }, color: muted, padding: 12 } },
      tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${c.parsed.y} kW` } },
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 6, maxRotation: 0, color: muted }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
      y: { ticks: { font: { size: 10 }, callback: (v: any) => `${v}kW`, color: muted }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } },
    },
  }), [isDark, muted]);

  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: surface, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', ...extra,
  });

  const sevColor = (s: string) => s === 'critical' ? '#ef4444' : s === 'warning' ? '#f59e0b' : '#3b82f6';

  if (sitesLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading…</span>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 96 }}>

      {/* ── Top bar ── */}
      <div style={{ background: 'linear-gradient(135deg, #004d1e, #006b2b)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: 1 }}>
              {new Date().toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button
            onClick={() => { setRefreshing(true); fetchAll(); if (selectedId) { fetchTelemetry(selectedId); fetchWeather(selectedId); } }}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', color: '#fff', padding: '6px 8px', display: 'flex' }}
          >
            <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Site picker */}
        <button
          onClick={() => setPickerOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', color: '#fff' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#4ade80' : '#94a3b8', display: 'inline-block', boxShadow: online ? '0 0 6px #4ade80' : 'none' }} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{site?.display_name ?? 'Select site'}</span>
            {site && <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>{site.site_id}</span>}
          </div>
          <ChevronDown size={14} style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'rgba(255,255,255,0.7)' }} />
        </button>
      </div>

      {/* Site picker dropdown */}
      {pickerOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 18 }} onClick={() => setPickerOpen(false)} />
          <div style={{ position: 'relative', zIndex: 19, background: surface, borderBottom: `1px solid ${border}`, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            {sites.map(s => {
              const on = siteIsOnline(s);
              const sel = s.site_id === selectedId;
              return (
                <div key={s.site_id} onClick={() => { setSelectedId(s.site_id); setPickerOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', borderLeft: `3px solid ${sel ? accent : 'transparent'}`, background: sel ? `${accent}0a` : 'transparent' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#22c55e' : '#64748b', display: 'inline-block', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.display_name}</div>
                    <div style={{ fontSize: '0.68rem', color: muted, fontFamily: 'monospace' }}>{s.site_id} · {s.devices.length} devices</div>
                  </div>
                  {on ? <Wifi size={13} color="#22c55e" /> : <WifiOff size={13} color="#64748b" />}
                </div>
              );
            })}
          </div>
        </>
      )}

      {site && (
        <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Status strip ── */}
          <div style={card({ padding: '10px 14px' })}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#22c55e' : '#64748b', boxShadow: online ? '0 0 6px rgba(34,197,94,0.6)' : 'none' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: online ? '#22c55e' : muted }}>{online ? 'Online' : 'Offline'}</span>
              </div>
              <div style={{ width: 1, height: 16, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}>
                <Activity size={12} color={accent} />
                <span style={{ fontWeight: 600 }}>{pvW != null ? `${fmtKW(pvW)} kW` : '—'}</span>
                <span style={{ color: muted }}>PV</span>
              </div>
              <div style={{ width: 1, height: 16, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}>
                <Battery size={12} color={soc != null && soc < 20 ? '#ef4444' : '#22c55e'} />
                <span style={{ fontWeight: 600 }}>{soc != null ? `${Math.round(soc)}%` : '—'}</span>
              </div>
              <div style={{ width: 1, height: 16, background: border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: sub }}>
                {isExporting ? <TrendingUp size={12} color="#22c55e" /> : isImporting ? <TrendingDown size={12} color="#f59e0b" /> : <Zap size={12} color={muted} />}
                <span style={{ fontWeight: 600, color: isExporting ? '#22c55e' : isImporting ? '#f59e0b' : sub }}>
                  {gridW != null ? `${fmtKW(gridW)} kW` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Weather ── */}
          {weather?.current && (
            <div style={card({ padding: '10px 14px' })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CloudSun size={20} color="#eab308" />
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: text }}>{weather.current.temperature_c != null ? `${Math.round(weather.current.temperature_c)}°C` : '—'}</div>
                    <div style={{ fontSize: '0.65rem', color: muted }}>{weather.current.description ?? 'Weather'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {weather.current.humidity_pct != null && (
                    <div style={{ textAlign: 'center' }}>
                      <Droplets size={12} color="#3b82f6" style={{ margin: '0 auto 2px' }} />
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: sub }}>{weather.current.humidity_pct}%</div>
                    </div>
                  )}
                  {weather.current.wind_speed_kmh != null && (
                    <div style={{ textAlign: 'center' }}>
                      <Wind size={12} color={muted} style={{ margin: '0 auto 2px' }} />
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: sub }}>{weather.current.wind_speed_kmh} km/h</div>
                    </div>
                  )}
                  {weather.current.solar_irradiance_wm2 != null && (
                    <div style={{ textAlign: 'center' }}>
                      <Sun size={12} color="#eab308" style={{ margin: '0 auto 2px' }} />
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: sub }}>{weather.current.solar_irradiance_wm2} W/m²</div>
                    </div>
                  )}
                  {weather.current.uv_index != null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: muted, marginBottom: 2 }}>UV</div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: weather.current.uv_index > 7 ? '#ef4444' : weather.current.uv_index > 4 ? '#f59e0b' : accent }}>{weather.current.uv_index}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Power Flow ── */}
          <div style={card({ padding: '10px 10px 6px' })}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, paddingLeft: 4 }}>Live Power Flow</div>
            <PowerFlowDiagram
              pvW={pvW} loadW={loadW} gridW={gridW} batW={batW}
              soc={soc} batV={batV}
              isExporting={isExporting} isImporting={isImporting}
              isBatCharging={isBatCharging} isBatDischarging={isBatDischarging}
              isDark={isDark}
            />
          </div>

          {/* ── KPI 2×2 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Solar Power', val: `${fmtKW(pvW)} kW`, sub2: `${fmtKWh(pvKWh)} kWh today`, icon: <Sun size={18} color="#eab308" />, color: '#eab308' },
              { label: 'Load',        val: `${fmtKW(loadW)} kW`, sub2: `${fmtKWh(ldKWh)} kWh today`, icon: <Zap size={18} color="#3b82f6" />, color: '#3b82f6' },
              { label: 'Battery',     val: soc != null ? `${Math.round(soc)}%` : '—', sub2: batW != null ? `${fmtKW(batW)} kW` : '—', icon: <Battery size={18} color="#22c55e" />, color: '#22c55e' },
              { label: 'Grid',        val: gridW != null ? `${fmtKW(gridW)} kW` : '—', sub2: isExporting ? `Export ${fmtKWh(exKWh)} kWh` : isImporting ? `Import ${fmtKWh(imKWh)} kWh` : 'Balanced', icon: <Globe size={18} color="#8b5cf6" />, color: '#8b5cf6' },
            ].map(({ label, val, sub2, icon, color }) => (
              <div key={label} style={{ ...card(), padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ opacity: 0.8 }}>{icon}</div>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: text, lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: '0.65rem', color: sub, marginTop: 4 }}>{sub2}</div>
              </div>
            ))}
          </div>

          {/* ── Daily Summary ── */}
          <div style={card({ padding: '12px 14px' })}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Today's Energy</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Generated', val: fmtKWh(pvKWh), color: '#eab308' },
                { label: 'Consumed',  val: fmtKWh(ldKWh), color: '#3b82f6' },
                { label: 'Self-suf.', val: selfSuf != null ? `${selfSuf}%` : '—', color: selfSuf != null && selfSuf >= 70 ? '#22c55e' : '#f59e0b' },
                { label: 'Bat. Chg',  val: fmtKWh(bcKWh), color: '#22c55e' },
                { label: 'Bat. Dis',  val: fmtKWh(bdKWh), color: '#f59e0b' },
                { label: 'Exported',  val: fmtKWh(exKWh), color: '#8b5cf6' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center', padding: '6px 0' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: '0.6rem', color: muted, marginTop: 2 }}>{label}</div>
                  {label !== 'Self-suf.' && val !== '—' && <div style={{ fontSize: '0.58rem', color: muted }}>kWh</div>}
                </div>
              ))}
            </div>
          </div>

          {/* ── Alerts ── */}
          {activeAlerts.length > 0 && (
            <div style={card()}>
              <button
                onClick={() => setAlertsOpen(o => !o)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: text }}>{activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}</span>
                </div>
                {alertsOpen ? <ChevronUp size={14} color={muted} /> : <ChevronDown size={14} color={muted} />}
              </button>
              {alertsOpen && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeAlerts.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, background: `${sevColor(a.severity)}10`, border: `1px solid ${sevColor(a.severity)}28` }}>
                      <AlertTriangle size={12} color={sevColor(a.severity)} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {a.fault_code && <span style={{ fontSize: '0.6rem', fontWeight: 700, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 4, background: `${sevColor(a.severity)}20`, color: sevColor(a.severity), marginRight: 4 }}>{a.fault_code}</span>}
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: sevColor(a.severity) }}>{a.message}</span>
                        <div style={{ fontSize: '0.62rem', color: muted, marginTop: 2 }}>Device {a.device_id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PV Chart ── */}
          <div style={card({ padding: '12px 12px 10px' })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BarChart3 size={14} color={accent} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Power</span>
            </div>
            {telLoading ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : chartData.labels.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: muted }}>No data yet today</div>
            ) : (
              <div style={{ height: 160 }}><Line data={chartData} options={chartOpts} /></div>
            )}
          </div>

          {/* ── Site info ── */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {[
              site.capacity_kw && { icon: <Zap size={10} />, text: `${site.capacity_kw} kWp` },
              site.inverter_capacity_kw && { icon: <Activity size={10} />, text: `${site.inverter_capacity_kw} kW inv.` },
              site.latitude != null && { icon: <MapPin size={10} />, text: `${site.latitude.toFixed(3)}° ${site.longitude.toFixed(3)}°` },
              site.tilt_deg != null && { icon: <Compass size={10} />, text: `Tilt ${site.tilt_deg}°` },
              site.azimuth_deg != null && { icon: <Compass size={10} />, text: `Az ${site.azimuth_deg}°` },
              { icon: <Globe size={10} />, text: site.timezone },
              { icon: <Clock size={10} />, text: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: site.timezone }) },
            ].filter(Boolean).map((chip: any) => (
              <div key={chip.text} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: surface, border: `1px solid ${border}`, fontSize: '0.65rem', color: sub, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span style={{ color: muted }}>{chip.icon}</span>{chip.text}
              </div>
            ))}
          </div>

          {/* ── Devices ── */}
          <div style={card({ padding: '12px 14px' })}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Devices ({site.devices.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {site.devices.map(d => (
                <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {d.is_online ? <Wifi size={13} color="#22c55e" /> : <WifiOff size={13} color="#64748b" />}
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: text }}>{d.device_serial}</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: d.is_online ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: d.is_online ? '#22c55e' : '#64748b' }}>
                    {d.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {!site && !sitesLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60dvh', flexDirection: 'column', gap: 8, color: muted }}>
          <MapPin size={32} color={border} />
          <span style={{ fontSize: '0.875rem' }}>No sites found</span>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MobileDashboard;
