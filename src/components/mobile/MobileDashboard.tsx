import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiService, AlertItem } from '../../services/api';
import {
  Sun, Battery, Zap, TrendingUp, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, MapPin, Clock, RefreshCw, Wifi, WifiOff, Compass, Globe,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { useTheme } from '../../contexts/ThemeContext';
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
  timezone: string; devices: SiteDevice[]; tilt_deg?: number; azimuth_deg?: number; is_active?: boolean;
}
interface TelemetryRow {
  timestamp: string;
  pv1_power_w?: number; pv2_power_w?: number; pv3_power_w?: number; pv4_power_w?: number;
  grid_power_w?: number; load_power_w?: number;
  battery_soc_percent?: number; pv_today_kwh?: number; load_today_kwh?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function siteIsOnline(site: Site) { return site.devices.some(d => d.is_online); }
function fmtKW(w: number | null | undefined) { return w != null ? `${(Math.abs(w) / 1000).toFixed(1)}` : '—'; }
function fmtKWh(k: number | null | undefined) { return k != null ? `${k.toFixed(1)} kWh` : '—'; }
function startOfTodayIST(): string {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 - now.getTimezoneOffset()) * 60_000;
  const d = new Date(istMs).toISOString().slice(0, 10);
  return new Date(`${d}T00:00:00+05:30`).toISOString();
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string; value: string; unit: string;
  icon: React.ReactNode; tone: 'solar' | 'load' | 'battery' | 'grid';
}
const toneClasses = {
  solar:   'bg-yellow-100/70 dark:bg-yellow-900/30 ring-1 ring-yellow-200/60 dark:ring-yellow-800/60',
  load:    'bg-blue-100/70 dark:bg-blue-900/30 ring-1 ring-blue-200/60 dark:ring-blue-800/60',
  battery: 'bg-emerald-100/70 dark:bg-emerald-900/30 ring-1 ring-emerald-200/60 dark:ring-emerald-800/60',
  grid:    'bg-purple-100/70 dark:bg-purple-900/30 ring-1 ring-purple-200/60 dark:ring-purple-800/60',
};
const KPICard: React.FC<KPICardProps> = ({ title, value, unit, icon, tone }) => (
  <div className={`relative overflow-hidden rounded-xl shadow-sm p-4 ${toneClasses[tone]}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
      </div>
      <div className="opacity-70">{icon}</div>
    </div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

const MobileDashboard: React.FC = () => {
  const { isDark } = useTheme();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allAlerts, setAllAlerts] = useState<AlertItem[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [telemetry, setTelemetry] = useState<TelemetryRow[]>([]);
  const [telLoading, setTelLoading] = useState(false);
  const sitesInit = useRef(false);

  const selectedSite = useMemo(() => sites.find(s => s.site_id === selectedSiteId) ?? null, [sites, selectedSiteId]);

  const activeAlerts = useMemo(() => {
    if (!selectedSite) return [];
    const ids = new Set(selectedSite.devices.map(d => d.device_id));
    return allAlerts.filter(a => ids.has(parseInt(a.device_id)) && !a.resolved && (a.status === 'active' || a.status === 'acknowledged' || a.status == null));
  }, [allAlerts, selectedSite]);

  const latest = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;
  const pvW = latest ? (latest.pv1_power_w ?? 0) + (latest.pv2_power_w ?? 0) + (latest.pv3_power_w ?? 0) + (latest.pv4_power_w ?? 0) : null;
  const gridW = latest?.grid_power_w ?? null;
  const loadW = latest?.load_power_w ?? null;
  const soc = latest?.battery_soc_percent ?? null;
  const pvToday = latest?.pv_today_kwh ?? null;
  const loadToday = latest?.load_today_kwh ?? null;
  const selfSuf = pvToday != null && loadToday != null && loadToday > 0 ? Math.min(100, Math.round((pvToday / loadToday) * 100)) : null;
  const isExporting = gridW != null && gridW < -50;
  const isImporting = gridW != null && gridW > 50;
  const online = selectedSite ? siteIsOnline(selectedSite) : false;

  const fetchSites = useCallback(async () => {
    try {
      const data: Site[] = await apiService.getAllSites();
      setSites(data);
      if (data.length > 0) setSelectedSiteId(prev => prev ?? data[0].site_id);
    } catch { } finally { setSitesLoading(false); sitesInit.current = true; }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try { const d = await apiService.getAlerts(); setAllAlerts(Array.isArray(d) ? d : []); } catch { }
  }, []);

  const fetchTelemetry = useCallback(async (id: string) => {
    setTelLoading(true);
    try {
      const d = await apiService.getSiteTelemetry(id, { start_date: startOfTodayIST(), end_date: new Date().toISOString() });
      setTelemetry(Array.isArray(d) ? d : []);
    } catch { setTelemetry([]); } finally { setTelLoading(false); }
  }, []);

  useEffect(() => {
    fetchSites(); fetchAlerts();
    const id = setInterval(() => { fetchSites(); fetchAlerts(); }, 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selectedSiteId) return;
    fetchTelemetry(selectedSiteId);
    const id = setInterval(() => fetchTelemetry(selectedSiteId), 60_000);
    return () => clearInterval(id);
  }, [selectedSiteId, fetchTelemetry]);

  const chartData = useMemo(() => {
    const rows = telemetry.filter(r => r.pv1_power_w != null);
    return {
      labels: rows.map(r => {
        const d = new Date(r.timestamp);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
      datasets: [{
        label: 'PV (kW)',
        data: rows.map(r => +(((r.pv1_power_w ?? 0) + (r.pv2_power_w ?? 0) + (r.pv3_power_w ?? 0) + (r.pv4_power_w ?? 0)) / 1000).toFixed(2)),
        borderColor: '#eab308',
        backgroundColor: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.12)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
      }],
    };
  }, [telemetry, isDark]);

  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 0 } as const,
    plugins: { legend: { display: false }, tooltip: { mode: 'index' as const, intersect: false, callbacks: { label: (c: any) => ` ${c.parsed.y} kW` } } },
    scales: {
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 6, maxRotation: 0, color: isDark ? '#64748b' : '#94a3b8' }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' } },
      y: { ticks: { font: { size: 10 }, callback: (v: any) => `${v}kW`, color: isDark ? '#64748b' : '#94a3b8' }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)' } },
    },
  }), [isDark]);

  const sevColor = (s: string) => s === 'critical' ? 'text-red-500' : s === 'warning' ? 'text-amber-500' : 'text-blue-500';
  const sevBg   = (s: string) => s === 'critical' ? 'bg-red-500/10' : s === 'warning' ? 'bg-amber-500/10' : 'bg-blue-500/10';

  if (sitesLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh gap-3 text-muted-foreground">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 bg-background">

      {/* Site selector */}
      <div className="relative z-20">
        <button
          onClick={() => setPickerOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-4 bg-card border-b border-border text-foreground"
        >
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-slate-400'}`} />
            <span className="font-semibold text-base">{selectedSite?.display_name ?? 'Select site'}</span>
          </div>
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>

        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-18" onClick={() => setPickerOpen(false)} />
            <div className="absolute top-full left-0 right-0 z-19 bg-card border-b border-border max-h-64 overflow-y-auto shadow-lg">
              {sites.map(site => {
                const sel = site.site_id === selectedSiteId;
                const on = siteIsOnline(site);
                return (
                  <div key={site.site_id}
                    onClick={() => { setSelectedSiteId(site.site_id); setPickerOpen(false); }}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-l-2 transition-colors ${sel ? 'border-emerald-500 bg-emerald-500/10' : 'border-transparent hover:bg-muted/50'}`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{site.display_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{site.site_id}</div>
                    </div>
                    {on ? <Wifi size={13} className="text-emerald-500 flex-shrink-0" /> : <WifiOff size={13} className="text-slate-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedSite && (
        <div className="p-3 space-y-3">

          {/* Status bar */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-around gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-slate-400'}`} />
                  <span className={`text-xs font-semibold ${online ? 'text-emerald-500' : 'text-muted-foreground'}`}>{online ? 'Online' : 'Offline'}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <Zap size={13} className="text-yellow-500" />
                  <span className="text-xs font-semibold">{pvW != null ? `${fmtKW(pvW)} kW` : '—'}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-1.5">
                  <Battery size={13} className={soc != null && soc < 20 ? 'text-red-500' : 'text-emerald-500'} />
                  <span className="text-xs font-semibold">{soc != null ? `${Math.round(soc)}%` : '—'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2-up KPI cards */}
          <div className="grid grid-cols-2 gap-3">
            <KPICard title="Solar Power" value={fmtKW(pvW)} unit="kW" icon={<Sun size={22} className="text-yellow-500" />} tone="solar" />
            <KPICard title="Load" value={fmtKW(loadW)} unit="kW" icon={<Zap size={22} className="text-blue-500" />} tone="load" />
          </div>

          {/* Grid pill */}
          {gridW != null && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${isExporting ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : isImporting ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
              {isExporting ? <TrendingUp size={15} /> : isImporting ? <TrendingDown size={15} /> : <Zap size={15} />}
              Grid: {isExporting ? `Exporting ${fmtKW(gridW)} kW` : isImporting ? `Importing ${fmtKW(gridW)} kW` : 'Balanced'}
            </div>
          )}

          {/* Collapsible alerts */}
          {activeAlerts.length > 0 && (
            <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50 transition-colors rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={15} className="text-amber-500" />
                        <CardTitle className="text-sm">{activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''}</CardTitle>
                      </div>
                      {alertsOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-3 px-4 space-y-2">
                    {activeAlerts.map(a => (
                      <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg ${sevBg(a.severity)}`}>
                        <AlertTriangle size={13} className={`flex-shrink-0 mt-0.5 ${sevColor(a.severity)}`} />
                        <div className="flex-1 min-w-0">
                          {a.fault_code && <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${sevBg(a.severity)} ${sevColor(a.severity)} mr-1`}>{a.fault_code}</span>}
                          <span className={`text-xs font-medium ${sevColor(a.severity)}`}>{a.message}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Daily summary */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Generated</p>
                  <p className="text-base font-bold">{pvToday?.toFixed(1) ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground">kWh</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Consumed</p>
                  <p className="text-base font-bold">{loadToday?.toFixed(1) ?? '—'}</p>
                  <p className="text-[10px] text-muted-foreground">kWh</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Self-suf.</p>
                  <p className={`text-base font-bold ${selfSuf != null && selfSuf >= 70 ? 'text-emerald-500' : selfSuf != null ? 'text-amber-500' : ''}`}>{selfSuf != null ? `${selfSuf}%` : '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PV Chart */}
          <Card>
            <CardHeader className="py-3 px-4 pb-0">
              <CardTitle className="text-sm">Today's PV Power</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-4 pb-4">
              {telLoading ? (
                <div className="h-44 flex items-center justify-center text-muted-foreground">
                  <RefreshCw size={16} className="animate-spin" />
                </div>
              ) : chartData.labels.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No data yet today</div>
              ) : (
                <div className="h-44"><Line data={chartData} options={chartOptions} /></div>
              )}
            </CardContent>
          </Card>

          {/* Site info chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { icon: <MapPin size={10} />, text: `${selectedSite.latitude}°N ${selectedSite.longitude}°E` },
              { icon: <Globe size={10} />, text: selectedSite.timezone },
              ...(selectedSite.tilt_deg != null ? [{ icon: <Compass size={10} />, text: `Tilt ${selectedSite.tilt_deg}°` }] : []),
              ...(selectedSite.azimuth_deg != null ? [{ icon: <Compass size={10} />, text: `Az ${selectedSite.azimuth_deg}°` }] : []),
              { icon: <Clock size={10} />, text: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            ].map(({ icon, text }) => (
              <Badge key={text} variant="secondary" className="flex items-center gap-1 whitespace-nowrap flex-shrink-0 text-[10px]">
                {icon}{text}
              </Badge>
            ))}
          </div>

        </div>
      )}
    </div>
  );
};

export default MobileDashboard;
