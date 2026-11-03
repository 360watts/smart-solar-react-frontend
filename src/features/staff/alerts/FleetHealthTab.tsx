import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../../../services/api';
import { btn, panel } from './alertsUi';

type Dev = { serial: string; site_id: string; is_online?: boolean; alerts?: { total?: number }; telemetry?: { data_completeness_pct?: number } };

const barColor = (p: number) => (p >= 90 ? 'var(--brand-green)' : p >= 60 ? 'var(--needed)' : '#D92D20');
const Bar: React.FC<{ pct: number; h?: number }> = ({ pct, h = 8 }) => (
  <span className="flex items-center gap-2.5">
    <span className="flex-1 overflow-hidden rounded bg-muted" style={{ height: h }}><span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: barColor(pct) }} /></span>
    <span className="w-11 text-right text-[13px]" style={{ fontFamily: 'Fira Code, monospace' }}>{Math.round(pct)}%</span>
  </span>
);
const shiftDay = (iso: string, d: number) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const cols = 'md:grid-cols-[minmax(0,1.4fr)_110px_130px_190px_24px]';

const FleetHealthTab: React.FC = () => {
  const [date, setDate] = useState<string | null>(null); // null = latest report
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [lastDay, setLastDay] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    apiService.getFleetHealthReport(date)
      .then(r => { if (live) { setReport(r); setLastDay(r?.data?.report_date ?? null); } })
      .catch(e => { if (live) { setReport(null); setError(e instanceof Error ? e.message : 'Could not load the fleet health report.'); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [date, tick]);

  const data = report?.data ?? {};
  const current: string | null = date ?? data.report_date ?? lastDay; // keeps the day switcher usable when a day has no saved report
  const sum = data.fleet_summary ?? {};
  const issues: any[] = data.issues ?? [];
  const sites = useMemo(() => {
    const by: Record<string, Dev[]> = {};
    Object.entries<any>(data.devices ?? {}).forEach(([serial, d]) => { (by[d.site_id ?? 'No site'] ??= []).push({ serial, ...d }); });
    return Object.entries(by).map(([id, devs]) => ({
      id, devs,
      alerts: devs.reduce((a, d) => a + (d.alerts?.total ?? 0), 0),
      online: devs.filter(d => d.is_online).length,
      pct: devs.reduce((a, d) => a + (d.telemetry?.data_completeness_pct ?? 0), 0) / devs.length,
    })).sort((a, b) => b.alerts - a.alerts || a.pct - b.pct);
  }, [data.devices]);

  // Problem lines name a device or a site; count the distinct sites (a device counts for its own site).
  const sitesToLook = useMemo(() => {
    const devs = (data.devices ?? {}) as Record<string, { site_id?: string }>;
    const set = new Set<string>();
    issues.forEach(x => {
      const who = String(typeof x === 'string' ? x : x.message ?? '').replace(/^[^\p{L}\p{N}]+/u, '').split(':')[0];
      if (who) set.add(who in devs ? devs[who].site_id || 'Devices with no site' : who);
    });
    return set.size;
  }, [issues, data.devices]);

  const verdict = (sum.critical_alerts ?? 0) > 0 ? { dot: '#D92D20', label: 'Needs attention' }
    : (sum.unresolved_alerts ?? 0) > 0 || (sum.rs485_stale_events ?? 0) > 0 || sitesToLook > 0 ? { dot: '#E3A008', label: 'Worth a look' }
    : { dot: 'var(--brand-green)', label: 'All healthy' };
  const stats: [string, number][] = [
    ['Alerts that day', sum.total_alerts ?? 0], ['Still open', sum.unresolved_alerts ?? 0], ['Critical', sum.critical_alerts ?? 0],
    ['Stale inverter readings', sum.rs485_stale_events ?? 0], ['Automatic reboots', sum.auto_reboots ?? 0],
  ];
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[15px] text-muted-foreground">{current ? `Fleet health for ${current}` : 'Fleet health'}</p>
        <div className="flex items-center gap-2.5">
          <button type="button" className={btn} aria-label="Previous day" disabled={!current} onClick={() => setDate(shiftDay(current!, -1))}>←</button>
          <span className="px-1.5 font-medium">{current ?? '—'}</span>
          <button type="button" className={btn} aria-label="Next day" disabled={!current || !date} onClick={() => setDate(shiftDay(current!, 1))}>→</button>
          <button type="button" className={btn} onClick={() => setTick(t => t + 1)}>Refresh</button>
        </div>
      </div>

      {loading && <p className="m-0 text-muted-foreground">Loading the report…</p>}
      {error && <div role="alert" className="rounded-2xl bg-needed-soft px-4 py-3 text-sm text-needed-ink">{error}</div>}

      {report && !loading && (<>
        <section aria-label="Verdict" className={`flex flex-wrap items-center justify-between gap-7 px-7 py-6 ${panel}`}>
          <div className="max-w-[520px]">
            <div className="flex items-center gap-2.5"><span className="h-3 w-3 rounded-full" style={{ background: verdict.dot }} /><span className="text-2xl font-semibold tracking-tight text-foreground">{verdict.label}</span></div>
            <p className="m-0 mt-2.5 leading-relaxed text-foreground">
              {sitesToLook ? `${sitesToLook} ${sitesToLook === 1 ? 'site needs' : 'sites need'} a look. Open a site below to see its devices.` : 'No problems were found in this report.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-8">
            {stats.map(([label, n]) => (
              <div key={label}><div className="text-[30px] font-medium leading-none" style={{ fontFamily: 'Fira Code, monospace' }}>{n}</div><div className="mt-1.5 text-[13px] text-muted-foreground">{label}</div></div>
            ))}
          </div>
        </section>

        <section aria-label="Sites" className={`overflow-hidden ${panel}`}>
          <div className={`hidden gap-4 px-5 py-3 text-[13px] text-muted-foreground md:[display:grid] ${cols}`}><span>Site</span><span>Alerts</span><span>Devices online</span><span>Readings that arrived</span><span /></div>
          {sites.length === 0 && <p className="m-0 border-t border-border px-6 py-10 text-center text-muted-foreground">No devices in this report.</p>}
          {sites.map(s => {
            const isOpen = open.has(s.id);
            return (
              <div key={s.id} className="border-t border-border">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(o => { const n = new Set(o); isOpen ? n.delete(s.id) : n.add(s.id); return n; })}
                  className={`[display:grid] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-0 bg-transparent px-5 py-4 text-left text-foreground hover:bg-muted/50 ${cols}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: s.online === s.devs.length ? 'var(--brand-green)' : s.online === 0 ? '#D92D20' : 'var(--needed)' }} />
                    <span className="font-medium">{s.id}</span><span className="text-[13px] text-muted-foreground">{s.devs.length} {s.devs.length === 1 ? 'device' : 'devices'}</span>
                  </span>
                  <span className={`hidden md:block ${s.alerts ? 'font-semibold text-needed-ink' : 'text-muted-foreground'}`}>{s.alerts ? `${s.alerts} open` : 'None'}</span>
                  <span className="hidden md:block">{s.online} of {s.devs.length}</span>
                  <span className="hidden md:block"><Bar pct={s.pct} /></span>
                  <span aria-hidden="true" className="text-muted-foreground">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && s.devs.map(d => (
                  <div key={d.serial} className={`[display:grid] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border bg-muted/40 py-2.5 pl-11 pr-5 text-sm ${cols}`}>
                    <span className="flex min-w-0 items-center gap-2.5"><span className="h-2 w-2 flex-none rounded-full" style={{ background: d.is_online ? 'var(--brand-green)' : 'var(--muted-foreground)' }} /><span style={{ fontFamily: 'Fira Code, monospace' }}>{d.serial}</span></span>
                    <span className="hidden md:block">{d.alerts?.total ? `${d.alerts.total} open` : 'None'}</span>
                    <span className="hidden md:block">{d.is_online ? 'Online' : 'Offline'}</span>
                    <span className="hidden md:block"><Bar pct={d.telemetry?.data_completeness_pct ?? 0} h={6} /></span>
                    <span />
                  </div>
                ))}
              </div>
            );
          })}
        </section>
        <p className="m-0 text-[13px] text-muted-foreground">
          {when(report.generated_at) && `Report generated ${when(report.generated_at)}`}{report.last_accessed_at ? ` · last viewed ${when(report.last_accessed_at)}` : ''}
        </p>
      </>)}
    </div>
  );
};

export default FleetHealthTab;
