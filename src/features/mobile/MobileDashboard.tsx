import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiService, AlertItem } from '../../services/api';
import {
  Sun, Battery, Zap, TrendingUp, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, MapPin, Clock, RefreshCw, Wifi, WifiOff,
  Compass, Globe, Thermometer, CloudSun, Droplets, Wind,
  Activity, BarChart3,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { IST_TIMEZONE } from '../../app/constants';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

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

const siteIsOnline = (site: Site) => site.devices.some(d => d.is_online);
const fmtKW  = (w: number | null | undefined) => w != null ? `${(Math.abs(w) / 1000).toFixed(1)}` : '—';
const fmtKWh = (k: number | null | undefined) => k != null ? `${k.toFixed(1)}` : '—';
function startOfTodayIST(): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  return new Date(`${todayStr}T00:00:00+05:30`).toISOString();
}

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
  const PV  = { x: 62,  y: 52  };
  const BAT = { x: 258, y: 52  };
  const GRD = { x: 62,  y: 178 };
  const LOD = { x: 258, y: 178 };
  const CTR = { x: 160, y: 115 };

  const R  = 22;
  const RC = 10;

  const edge = (from: {x:number,y:number}, to: {x:number,y:number}, r: number) => {
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    return { x: from.x + (dx/len)*r, y: from.y + (dy/len)*r };
  };

  const pvOut  = edge(PV,  CTR, R);   const ctrPv  = edge(CTR, PV,  RC);
  const batOut = edge(BAT, CTR, R);   const ctrBat = edge(CTR, BAT, RC);
  const grdOut = edge(GRD, CTR, R);   const ctrGrd = edge(CTR, GRD, RC);
  const lodOut = edge(LOD, CTR, R);   const ctrLod = edge(CTR, LOD, RC);

  const C_SOLAR  = '#F59E0B';
  const C_LOAD   = '#60A5FA';
  const C_GRID_E = '#2FBF71';
  const C_GRID_I = '#F59E0B';
  const C_BAT_C  = '#2FBF71';
  const C_BAT_D  = '#A78BFA';
  const track    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const nodeRing = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const nodeFill = isDark ? '#0d1117' : '#ffffff';
  const tf  = isDark ? '#F1F5F9' : '#0F172A';
  const tf2 = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';

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

  const mid = (a: {x:number,y:number}, b: {x:number,y:number}) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
  const midPV  = mid(pvOut,  ctrPv);
  const midBAT = mid(batOut, ctrBat);
  const midGRD = mid(grdOut, ctrGrd);
  const midLOD = mid(lodOut, ctrLod);

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

      {[
        [pvOut, ctrPv], [batOut, ctrBat], [grdOut, ctrGrd], [lodOut, ctrLod]
      ].map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={track} strokeWidth="2.5" strokeLinecap="round"/>
      ))}

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

      <circle cx={CTR.x} cy={CTR.y} r={RC + 4} fill={isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.08)'} />
      <circle cx={CTR.x} cy={CTR.y} r={RC} fill={nodeFill}
        stroke="#2FBF71" strokeWidth="1.5"/>
      <polygon points={`${CTR.x+2},${CTR.y-7} ${CTR.x-3},${CTR.y-1} ${CTR.x+1},${CTR.y-1} ${CTR.x-2},${CTR.y+7} ${CTR.x+4},${CTR.y+0} ${CTR.x-0},${CTR.y+0}`}
        fill="#2FBF71" opacity="0.9"/>

      {pvActive && (
        <g>
          <rect x={midPV.x-18} y={midPV.y-9} width="36" height="17" rx="8"
            fill={isDark ? 'rgba(255,255,255,0.06)' : '#fffbeb'} stroke={C_SOLAR} strokeWidth="1"/>
          <text x={midPV.x} y={midPV.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C_SOLAR}>
            {(Math.abs(pvW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}
      {gridActive && (
        <g>
          <rect x={midGRD.x-18} y={midGRD.y-9} width="36" height="17" rx="8"
            fill={isDark ? 'rgba(255,255,255,0.06)' : '#f0fdf4'} stroke={gridColor} strokeWidth="1"/>
          <text x={midGRD.x} y={midGRD.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={gridColor}>
            {(Math.abs(gridW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}
      {batActive && (
        <g>
          <rect x={midBAT.x-18} y={midBAT.y-9} width="36" height="17" rx="8"
            fill={isDark ? 'rgba(255,255,255,0.06)' : '#f5f3ff'} stroke={batColor} strokeWidth="1"/>
          <text x={midBAT.x} y={midBAT.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={batColor}>
            {(Math.abs(batW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}
      {ldActive && (
        <g>
          <rect x={midLOD.x-18} y={midLOD.y-9} width="36" height="17" rx="8"
            fill={isDark ? 'rgba(255,255,255,0.06)' : '#eff6ff'} stroke={C_LOAD} strokeWidth="1"/>
          <text x={midLOD.x} y={midLOD.y+4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C_LOAD}>
            {(Math.abs(loadW!)/1000).toFixed(1)} kW
          </text>
        </g>
      )}

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
          fill={soc < 20 ? '#F87171' : soc < 50 ? '#F59E0B' : batActive ? batColor : '#2FBF71'}
          opacity="0.85"/>
      )}
      <text x={BAT.x} y={BAT.y+R+11} textAnchor="middle" fontSize="9" fontWeight="700"
        fill={batActive ? batColor : tf2} opacity={batActive ? 1 : 0.55}>
        {soc != null ? `${Math.round(soc)}%` : '—%'}{batV != null ? ` · ${batV.toFixed(0)}V` : ''}
      </text>
      <text x={BAT.x} y={BAT.y+R+20} textAnchor="middle" fontSize="7.5" fill={tf2} opacity="0.75">
        {isBatCharging ? 'Charging' : isBatDischarging ? 'Discharge' : 'Battery'}
      </text>

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

const MobileDashboard: React.FC = () => {
  const { isDark } = useTheme();

  const bg      = isDark ? '#07090F' : '#F4F7FA';
  const surface = isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF';
  const border  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const text    = isDark ? '#F1F5F9' : '#0F172A';
  const muted   = isDark ? 'rgba(241,245,249,0.45)' : '#94A3B8';

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
          borderColor: '#F59E0B',
          backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.1)',
          data: rows.map(r => +(((r.pv1_power_w ?? 0) + (r.pv2_power_w ?? 0) + (r.pv3_power_w ?? 0) + (r.pv4_power_w ?? 0)) / 1000).toFixed(2)),
        },
        {
          label: 'Load', fill: false, tension: 0.4, pointRadius: 0, borderWidth: 1.5,
          borderColor: '#60A5FA', borderDash: [4, 3],
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
    background: surface,
    backdropFilter: 'blur(16px)',
    border: `1px solid ${border}`,
    borderRadius: 16,
    overflow: 'hidden',
    ...extra,
  });

  const sevColor = (s: string) => s === 'critical' ? '#F87171' : s === 'warning' ? '#F59E0B' : '#60A5FA';

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: muted,
    opacity: 0.9,
    marginBottom: 8,
    fontFamily: "'DM Sans', sans-serif",
  };

  if (sitesLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: bg, gap: 10, color: muted }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif" }}>Loading…</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ background: bg, minHeight: '100dvh', paddingBottom: 96 }}>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(47,191,113,0.4); }
          70% { box-shadow: 0 0 0 6px rgba(47,191,113,0); }
          100% { box-shadow: 0 0 0 0 rgba(47,191,113,0); }
        }
        .online-dot { animation: pulse-ring 2s ease-out infinite; }
      `}</style>

      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: isDark ? 'rgba(7,9,15,0.92)' : 'rgba(244,247,250,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${border}`,
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: muted, fontFamily: "'DM Sans', sans-serif" }}>Dashboard</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: text, marginTop: 2, fontFamily: "'Outfit', sans-serif" }}>
              {site?.display_name ?? 'Solar Monitor'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 999,
              background: online ? 'rgba(47,191,113,0.12)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${online ? 'rgba(47,191,113,0.25)' : border}`,
            }}>
              <span
                className={online ? 'online-dot' : undefined}
                style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#2FBF71' : '#94A3B8', display: 'inline-block', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: online ? '#2FBF71' : muted, fontFamily: "'DM Sans', sans-serif" }}>
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
            <button
              onClick={() => { setRefreshing(true); fetchAll(); if (selectedId) { fetchTelemetry(selectedId); fetchWeather(selectedId); } }}
              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: `1px solid ${border}`, borderRadius: 10, cursor: 'pointer', color: muted, padding: '7px', display: 'flex' }}
            >
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setPickerOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${border}`, borderRadius: 999,
            padding: '8px 14px', cursor: 'pointer', color: text,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={12} color={muted} />
            <span style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: "'DM Sans', sans-serif" }}>{site?.display_name ?? 'Select site'}</span>
            {site && <span style={{ fontSize: '0.62rem', color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{site.site_id}</span>}
          </div>
          <ChevronDown size={13} color={muted} style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        </button>
      </div>

      {pickerOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 18 }} onClick={() => setPickerOpen(false)} />
          <div style={{
            position: 'relative', zIndex: 19,
            background: isDark ? 'rgba(12,14,22,0.97)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${border}`,
            maxHeight: 280, overflowY: 'auto',
            boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.12)',
          }}>
            {sites.map(s => {
              const on = siteIsOnline(s);
              const sel = s.site_id === selectedId;
              return (
                <div key={s.site_id} onClick={() => { setSelectedId(s.site_id); setPickerOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 0, cursor: 'pointer',
                    background: sel ? (isDark ? 'rgba(47,191,113,0.06)' : 'rgba(47,191,113,0.04)') : 'transparent',
                  }}>
                  <div style={{ width: 4, alignSelf: 'stretch', background: on ? '#2FBF71' : '#64748B', flexShrink: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', flex: 1, minWidth: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>{s.display_name}</div>
                      <div style={{ fontSize: '0.65rem', color: muted, fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{s.site_id} · {s.devices.length} dev</div>
                    </div>
                    {on ? <Wifi size={13} color="#2FBF71" /> : <WifiOff size={13} color="#64748B" />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {site && (
        <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={{
            ...card(),
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          }}>
            {[
              { icon: <Sun size={13} color="#F59E0B" />, label: 'Solar', value: `${fmtKW(pvW)} kW`, color: '#F59E0B' },
              { icon: <Zap size={13} color="#60A5FA" />, label: 'Load', value: `${fmtKW(loadW)} kW`, color: '#60A5FA' },
              { icon: <Battery size={13} color={soc != null && soc < 20 ? '#F87171' : '#2FBF71'} />, label: 'Battery', value: soc != null ? `${Math.round(soc)}%` : '—', color: soc != null && soc < 20 ? '#F87171' : '#2FBF71' },
              { icon: isExporting ? <TrendingUp size={13} color="#2FBF71" /> : isImporting ? <TrendingDown size={13} color="#F59E0B" /> : <Globe size={13} color={muted} />, label: 'Grid', value: gridW != null ? `${fmtKW(gridW)} kW` : '—', color: isExporting ? '#2FBF71' : isImporting ? '#F59E0B' : muted },
            ].map(({ icon, label, value, color }, idx, arr) => (
              <React.Fragment key={label}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {icon}
                    <span style={{ fontSize: '0.7rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
                </div>
                {idx < arr.length - 1 && <div style={{ width: 1, height: 32, background: border, flexShrink: 0 }} />}
              </React.Fragment>
            ))}
          </div>

          {weather?.current && (
            <div style={{ ...card(), padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CloudSun size={28} color="#F59E0B" />
                  <div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: text, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                      {weather.current.temperature_c != null ? `${Math.round(weather.current.temperature_c)}°` : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: muted, marginTop: 3, fontFamily: "'DM Sans', sans-serif" }}>{weather.current.description ?? 'Weather'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', maxWidth: '55%' }}>
                  {weather.current.humidity_pct != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(96,165,250,0.1)' : 'rgba(96,165,250,0.08)', border: `1px solid rgba(96,165,250,0.2)` }}>
                      <Droplets size={10} color="#60A5FA" />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#60A5FA', fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.humidity_pct}%</span>
                    </div>
                  )}
                  {weather.current.wind_speed_kmh != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}` }}>
                      <Wind size={10} color={muted} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: muted, fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.wind_speed_kmh} km/h</span>
                    </div>
                  )}
                  {weather.current.solar_irradiance_wm2 != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.07)', border: `1px solid rgba(245,158,11,0.2)` }}>
                      <Sun size={10} color="#F59E0B" />
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.solar_irradiance_wm2} W/m²</span>
                    </div>
                  )}
                  {weather.current.uv_index != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${border}` }}>
                      <span style={{ fontSize: '0.58rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>UV</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: weather.current.uv_index > 7 ? '#F87171' : weather.current.uv_index > 4 ? '#F59E0B' : '#2FBF71', fontFamily: "'JetBrains Mono', monospace" }}>{weather.current.uv_index}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ ...card(), padding: '12px 10px 8px' }}>
            <div style={{ ...sectionLabel, paddingLeft: 4 }}>Live Power Flow</div>
            <PowerFlowDiagram
              pvW={pvW} loadW={loadW} gridW={gridW} batW={batW}
              soc={soc} batV={batV}
              isExporting={isExporting} isImporting={isImporting}
              isBatCharging={isBatCharging} isBatDischarging={isBatDischarging}
              isDark={isDark}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { label: 'Solar Power', val: `${fmtKW(pvW)}`, unit: 'kW', sub2: `${fmtKWh(pvKWh)} kWh today`, icon: <Sun size={17} color="#F59E0B" />, color: '#F59E0B' },
              { label: 'Load', val: `${fmtKW(loadW)}`, unit: 'kW', sub2: `${fmtKWh(ldKWh)} kWh today`, icon: <Zap size={17} color="#60A5FA" />, color: '#60A5FA' },
              { label: 'Battery', val: soc != null ? `${Math.round(soc)}` : '—', unit: '%', sub2: batW != null ? `${fmtKW(batW)} kW` : '—', icon: <Battery size={17} color="#A78BFA" />, color: '#A78BFA' },
              { label: 'Grid', val: gridW != null ? `${fmtKW(gridW)}` : '—', unit: 'kW', sub2: isExporting ? `Export ${fmtKWh(exKWh)} kWh` : isImporting ? `Import ${fmtKWh(imKWh)} kWh` : 'Balanced', icon: <Globe size={17} color="#60A5FA" />, color: isExporting ? '#2FBF71' : isImporting ? '#F59E0B' : '#60A5FA' },
            ].map(({ label, val, unit, sub2, icon, color }) => (
              <div key={label} style={{ ...card(), padding: '14px 12px', borderTop: `3px solid ${color}`, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 10, opacity: 0.6 }}>{icon}</div>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: muted, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 4 }}>
                  <span style={{ fontSize: '1.7rem', fontWeight: 700, color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{val}</span>
                  <span style={{ fontSize: '0.72rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{unit}</span>
                </div>
                <div style={{ fontSize: '0.62rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>{sub2}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card(), padding: '14px 14px' }}>
            <div style={sectionLabel}>Today's Energy</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
              {[
                { label: 'Generated', val: fmtKWh(pvKWh), color: '#F59E0B', unit: 'kWh' },
                { label: 'Consumed',  val: fmtKWh(ldKWh), color: '#60A5FA', unit: 'kWh' },
                { label: 'Self-suf.', val: selfSuf != null ? `${selfSuf}%` : '—', color: selfSuf != null && selfSuf >= 70 ? '#2FBF71' : '#F59E0B', unit: '' },
                { label: 'Bat. Chg',  val: fmtKWh(bcKWh), color: '#2FBF71', unit: 'kWh' },
                { label: 'Bat. Dis',  val: fmtKWh(bdKWh), color: '#A78BFA', unit: 'kWh' },
                { label: 'Exported',  val: fmtKWh(exKWh), color: '#2FBF71', unit: 'kWh' },
              ].map(({ label, val, color, unit }) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: '0.58rem', color: muted, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                  {unit && val !== '—' && <div style={{ fontSize: '0.55rem', color: muted, opacity: 0.7, fontFamily: "'DM Sans', sans-serif" }}>{unit}</div>}
                </div>
              ))}
            </div>
          </div>

          {activeAlerts.length > 0 && (
            <div style={card()}>
              <button
                onClick={() => setAlertsOpen(o => !o)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color="#F59E0B" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: text, fontFamily: "'DM Sans', sans-serif" }}>{activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}</span>
                </div>
                {alertsOpen ? <ChevronUp size={14} color={muted} /> : <ChevronDown size={14} color={muted} />}
              </button>
              {alertsOpen && (
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeAlerts.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 0, borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                      <div style={{ width: 4, alignSelf: 'stretch', background: sevColor(a.severity), flexShrink: 0 }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 10px', flex: 1, minWidth: 0 }}>
                        <AlertTriangle size={12} color={sevColor(a.severity)} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {a.fault_code && (
                            <span style={{ fontSize: '0.58rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", padding: '1px 5px', borderRadius: 999, background: `${sevColor(a.severity)}18`, color: sevColor(a.severity), marginRight: 5, display: 'inline-block', marginBottom: 3 }}>{a.fault_code}</span>
                          )}
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: text, fontFamily: "'DM Sans', sans-serif" }}>{a.message}</div>
                          <div style={{ fontSize: '0.6rem', color: muted, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>Dev {a.device_id}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ ...card(), padding: '14px 12px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <BarChart3 size={14} color="#2FBF71" />
              <span style={sectionLabel}>Today's Generation</span>
            </div>
            {telLoading ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : chartData.labels.length === 0 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: muted, fontFamily: "'DM Sans', sans-serif" }}>No data yet today</div>
            ) : (
              <div style={{ height: 160 }}><Line data={chartData} options={chartOpts} /></div>
            )}
          </div>

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
              <div key={chip.text} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: surface, backdropFilter: 'blur(16px)', border: `1px solid ${border}`, fontSize: '0.62rem', color: muted, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ opacity: 0.6 }}>{chip.icon}</span>{chip.text}
              </div>
            ))}
          </div>

          <div style={{ ...card(), padding: '14px 14px' }}>
            <div style={sectionLabel}>Devices ({site.devices.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {site.devices.map(d => (
                <div key={d.device_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)', border: `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    {d.is_online ? <Wifi size={13} color="#2FBF71" /> : <WifiOff size={13} color="#64748B" />}
                    <span style={{ fontSize: '0.72rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: text }}>{d.device_serial}</span>
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: d.is_online ? 'rgba(47,191,113,0.1)' : 'rgba(100,116,139,0.1)', color: d.is_online ? '#2FBF71' : '#64748B', fontFamily: "'DM Sans', sans-serif" }}>
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
          <span style={{ fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif" }}>No sites found</span>
        </div>
      )}
    </div>
  );
};

export default MobileDashboard;
