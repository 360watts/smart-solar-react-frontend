import React, { useEffect, useMemo, useState } from 'react';
import { AlertAnalyticsResponse, apiService } from '../../../services/api';
import { SEV, Severity, SevPill, btn, fmtSeconds, panel } from './alertsUi';

const RANGES: [number, string][] = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [180, '6 months']];
const PAGE = 10;
const cols = 'md:grid-cols-[minmax(0,1.5fr)_150px_90px_120px]';

const AnalyticsTab: React.FC = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AlertAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    apiService.getAlertsAnalytics(days)
      .then(r => { if (live) setData(r); })
      .catch(e => { if (live) { setData(null); setError(e instanceof Error ? e.message : 'Could not load analytics.'); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [days]);
  useEffect(() => setPage(0), [days]);

  const faults = useMemo(() => [...(data?.fault_summaries ?? [])].sort((a, b) => b.total_occurrences - a.total_occurrences), [data]);
  const peek = faults.find(f => f.fault_code === sel) ?? faults[0];
  const rule = data?.rule_catalogue.find(r => r.fault_code === peek?.fault_code);
  const recent = (peek && data?.recent_instances[peek.fault_code]) || [];
  const pages = Math.max(1, Math.ceil(faults.length / PAGE));
  const shown = faults.slice(page * PAGE, (page + 1) * PAGE);
  const max = faults[0]?.total_occurrences || 1;
  const total = faults.reduce((a, f) => a + f.total_occurrences, 0);
  const perDay = useMemo(() => (data?.timeline ?? []).map(d => {
    const n: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
    d.faults.forEach(f => { n[f.severity in n ? f.severity : 'info'] += f.count; });
    return { date: d.date, ...n };
  }), [data]);
  const tallest = Math.max(1, ...perDay.map(d => d.critical + d.warning + d.info));
  const rangeLabel = RANGES.find(r => r[0] === days)?.[1] ?? `${days} days`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[15px] text-muted-foreground" aria-live="polite">
          {loading ? 'Loading…' : faults.length ? `${total} alerts fired in the last ${rangeLabel}. ${peek && faults[0].title} fired most.` : `No alerts fired in the last ${rangeLabel}.`}
        </p>
        <div role="group" aria-label="How far back" className="inline-flex gap-0.5 rounded-full bg-muted p-1">
          {RANGES.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={days === k} onClick={() => setDays(k)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${days === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>
          ))}
        </div>
      </div>
      {error && <div role="alert" className="rounded-2xl bg-needed-soft px-4 py-3 text-sm text-needed-ink">{error}</div>}

      {data && (<>
        <section aria-label="Alerts per day" className={`px-6 py-5 ${panel}`}>
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0 text-lg font-semibold">Alerts per day</h2>
            <div className="flex gap-4 text-[13px]">
              {(Object.keys(SEV) as Severity[]).map(k => (
                <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SEV[k].color }} />{SEV[k].label}</span>
              ))}
            </div>
          </div>
          <div className="relative flex h-[150px] items-end gap-[3px] border-b border-border" role="img" aria-label="Daily alert counts, stacked by severity" onMouseLeave={() => setHover(null)}>
            {perDay.map((d, i) => (
              <div key={d.date} onMouseEnter={() => setHover(i)} className="relative flex h-full min-w-[2px] flex-1 flex-col justify-end gap-px">
                {(['info', 'warning', 'critical'] as Severity[]).map(k => d[k] > 0 && <span key={k} className="block w-full" style={{ height: `${(d[k] / tallest) * 100}%`, background: SEV[k].color }} />)}
                {hover === i && (
                  <div role="tooltip" className="pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-[150px] rounded-2xl border border-border bg-card px-3.5 py-2.5 text-[13px] shadow-lg"
                    style={{ [i > perDay.length / 2 ? 'right' : 'left']: 0 }}>
                    <div className="mb-1 font-semibold" style={{ fontFamily: 'Fira Code, monospace' }}>{d.date}</div>
                    {d.critical + d.warning + d.info === 0 ? <div className="text-muted-foreground">No alerts</div> : (['critical', 'warning', 'info'] as Severity[]).map(k => d[k] > 0 && (
                      <div key={k} className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SEV[k].color }} />{SEV[k].label}</span><span style={{ fontFamily: 'Fira Code, monospace' }}>{d[k]}</span></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {perDay.length > 0 && <div className="mt-2 flex justify-between text-xs text-muted-foreground" style={{ fontFamily: 'Fira Code, monospace' }}><span>{perDay[0].date}</span><span>{perDay[perDay.length - 1].date}</span></div>}
        </section>

        <div className="flex flex-wrap items-start gap-6">
          <section aria-label="What fires most" className={`min-w-0 flex-[999_1_640px] overflow-hidden ${panel}`}>
            <h2 className="m-0 px-5 pb-3 pt-5 text-lg font-semibold">What fires most</h2>
            <div className={`hidden gap-4 px-5 pb-2.5 text-[13px] text-muted-foreground md:[display:grid] ${cols}`}><span>Alert</span><span>Times it fired</span><span>Open now</span><span>Usually fixed in</span></div>
            {faults.length === 0 && <p className="m-0 border-t border-border px-6 py-10 text-center text-muted-foreground">Nothing fired in this period.</p>}
            {shown.map(f => {
              const on = peek?.fault_code === f.fault_code;
              return (
                <button key={f.fault_code} type="button" aria-pressed={on} onClick={() => setSel(f.fault_code)}
                  className={`[display:grid] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-0 border-t border-border bg-transparent px-5 py-3.5 text-left text-foreground hover:bg-muted/50 ${cols}`}
                  style={{ background: on ? 'color-mix(in srgb, var(--brand-green) 10%, transparent)' : undefined, boxShadow: on ? 'inset 4px 0 0 var(--brand-green)' : undefined }}>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2"><SevPill sev={f.severity} /><span className="font-medium">{f.title}</span></span>
                    <span className="mt-0.5 block text-xs text-muted-foreground" style={{ fontFamily: 'Fira Code, monospace' }}>{f.fault_code}</span>
                  </span>
                  <span className="hidden items-center gap-2.5 md:flex">
                    <span className="h-2 flex-1 overflow-hidden rounded bg-muted"><span className="block h-full" style={{ width: `${(f.total_occurrences / max) * 100}%`, background: SEV[f.severity].color }} /></span>
                    <span className="w-8 text-right text-[13px]" style={{ fontFamily: 'Fira Code, monospace' }}>{f.total_occurrences}</span>
                  </span>
                  <span className={`hidden md:block ${f.active_count ? 'font-semibold text-needed-ink' : 'text-muted-foreground'}`}>{f.active_count || 'None'}</span>
                  <span className="hidden md:block">{fmtSeconds(f.avg_resolution_seconds)}</span>
                </button>
              );
            })}
            {pages > 1 && (
              <nav aria-label="Pages" className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
                <span>{page * PAGE + 1}–{Math.min(faults.length, (page + 1) * PAGE)} of {faults.length}</span>
                <span className="flex gap-2">
                  <button type="button" className={btn} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                  <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
                </span>
              </nav>
            )}
          </section>

          {peek && (
            <aside aria-label="About this alert" className={`sticky top-6 flex min-w-[300px] max-w-[420px] flex-[1_1_360px] flex-col gap-4 p-6 ${panel}`}>
              <div>
                <div className="flex items-center gap-2"><SevPill sev={peek.severity} /><span className="text-[13px] text-muted-foreground" style={{ fontFamily: 'Fira Code, monospace' }}>{peek.fault_code}</span></div>
                <h2 className="m-0 mt-2.5 text-xl font-semibold leading-tight tracking-tight">{peek.title}</h2>
              </div>
              <div><div className="mb-1 text-sm font-semibold">Why it fires</div><div className="text-sm leading-relaxed">{rule?.reason || peek.reason || recent[0]?.message || 'No explanation has been written for this alert yet.'}</div></div>
              {rule?.fix_guidance && <div><div className="mb-1 text-sm font-semibold">What to do</div><div className="text-sm leading-relaxed">{rule.fix_guidance}</div></div>}
              {rule?.cooldown_hours != null && <div className="text-sm text-muted-foreground">After it fires, it stays quiet for {rule.cooldown_hours} {rule.cooldown_hours === 1 ? 'hour' : 'hours'} before it can fire again.</div>}
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Latest times</div>
                  <div className="flex flex-col gap-2">
                    {recent.slice(0, 5).map(r => (
                      <div key={r.id} className="flex justify-between gap-3 text-sm">
                        <span style={{ fontFamily: 'Fira Code, monospace' }}>{r.device_serial}</span>
                        <span className="text-muted-foreground">{new Date(r.triggered_at).toLocaleDateString([], { day: 'numeric', month: 'short' })} · {r.resolved_at ? 'Fixed' : 'Open'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </>)}
    </div>
  );
};

export default AnalyticsTab;
