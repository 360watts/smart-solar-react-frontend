import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { apiService, IncidentItem } from '../../../services/api';
import { SEV, SevPill, btn, btnPrimary, fmtSeconds, panel } from './alertsUi';

type Filter = 'open' | 'critical' | 'warning' | 'info' | 'ack' | 'resolved';
const RANK = { critical: 0, warning: 1, info: 2 } as const;
const STATUS_TEXT = { active: 'Needs a look', acknowledged: 'Being handled', resolved: 'Resolved' } as const;

const openSeconds = (i: IncidentItem) =>
  i.status === 'resolved' ? i.durationSeconds : Math.max(0, (Date.now() - new Date(i.tsStart).getTime()) / 1000);

const AlertsTriage: React.FC = () => {
  const [items, setItems] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState<Filter>('open');
  const [selId, setSelId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | 'diag' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      apiService.invalidateAlertsCache();
      setItems((await apiService.getIncidents({ limit: 200 })).results);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load alerts.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const isOpen = (i: IncidentItem) => i.status !== 'resolved';
  const base = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter(i => `${i.title} ${i.summary} ${i.deviceSerial ?? ''} ${i.siteName ?? ''} ${i.siteId ?? ''}`.toLowerCase().includes(t)) : items;
  }, [items, q]);
  const count = (f: Filter) => base.filter(i => match(i, f)).length;
  function match(i: IncidentItem, f: Filter) {
    return f === 'open' ? isOpen(i) : f === 'ack' ? i.status === 'acknowledged' : f === 'resolved' ? i.status === 'resolved' : isOpen(i) && i.severity === f;
  }
  const list = useMemo(() => base.filter(i => match(i, flt))
    .sort((a, b) => (RANK[a.severity] - RANK[b.severity]) || ((openSeconds(b) ?? 0) - (openSeconds(a) ?? 0))), [base, flt]); // eslint-disable-line react-hooks/exhaustive-deps
  const peek = list.find(i => i.id === selId) ?? list[0];

  const act = async (i: IncidentItem, kind: 'ack' | 'resolve') => {
    setBusy(i.id); setNote(null);
    try {
      const next = kind === 'ack' ? await apiService.acknowledgeIncident(i.id) : await apiService.resolveIncident(i.id);
      setItems(prev => prev.map(x => (x.id === i.id ? { ...x, status: next.status, tsEnd: next.tsEnd, durationSeconds: next.durationSeconds } : x)));
    } catch (e) { setNote(e instanceof Error ? e.message : 'That did not go through. Try again.'); }
    finally { setBusy(null); }
  };

  const diagnose = async () => {
    setBusy('diag'); setNote(null);
    try {
      const r = await apiService.diagnoseBatch();
      setNote(r.no_api_key ? 'AI diagnostics is not switched on for this server.' : `Checking ${r.queued} alert${r.queued === 1 ? '' : 's'}. Results appear here in a few seconds.`);
      setTimeout(load, 8000);
    } catch (e) { setNote(e instanceof Error ? e.message : 'Could not start diagnostics.'); }
    finally { setBusy(null); }
  };

  const open = items.filter(isOpen);
  const nc = open.filter(i => i.severity === 'critical').length;
  const nw = open.filter(i => i.severity === 'warning').length;
  const headline = loading ? 'Loading alerts…'
    : open.length === 0 ? 'All clear. Nothing needs attention.'
    : `${nc} critical, ${nw} ${nw === 1 ? 'warning' : 'warnings'} and ${open.length - nc - nw} for information are open.`;

  const chips: [Filter, string][] = [['open', 'Open'], ['critical', 'Critical'], ['warning', 'Warning'], ['info', 'Info'], ['ack', 'Being handled'], ['resolved', 'Resolved']];
  const cols = 'md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_100px_110px]';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[15px] text-muted-foreground" aria-live="polite">{headline}</p>
        <div className="flex gap-2.5">
          <button type="button" className={btn} onClick={load}>Refresh</button>
          <button type="button" className={`${btn} !border-0 !bg-foreground !text-background font-semibold`} onClick={diagnose} disabled={busy === 'diag'}>
            {busy === 'diag' ? 'Starting…' : 'Run AI diagnostics'}
          </button>
        </div>
      </div>
      {(error || note) && <div role="status" className="rounded-2xl bg-needed-soft px-4 py-3 text-sm text-needed-ink">{error || note}</div>}

      <div className="flex flex-col gap-3.5">
        <label htmlFor="alert-finder" className="sr-only">Find an alert</label>
        <div className="relative">
          <Search size={22} aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input id="alert-finder" type="search" value={q} onChange={e => setQ(e.target.value)} autoComplete="off"
            placeholder="Find an alert by device, site or what went wrong"
            className="h-[58px] w-full rounded-[22px] border-[1.5px] border-border bg-card pl-[54px] pr-5 text-[17px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={flt === k} onClick={() => setFlt(k)}
              className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-2 text-sm font-medium ${flt === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-muted'}`}>
              {label}<span className="text-xs opacity-80" style={{ fontFamily: 'Fira Code, monospace' }}>{count(k)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Alert list" className={`min-w-0 flex-[999_1_640px] overflow-hidden ${panel}`}>
          <div className={`hidden gap-4 px-6 py-3 text-[13px] text-muted-foreground md:[display:grid] ${cols}`}>
            <span>What happened</span><span>Device and site</span><span>Open for</span><span>Next step</span>
          </div>
          {list.length === 0 && (
            <div className="border-t border-border px-6 py-14 text-center">
              <p className="m-0 mb-1.5 text-lg font-semibold text-foreground">{loading ? 'Loading…' : q ? `No alert matches “${q}”` : flt === 'resolved' ? 'Nothing resolved yet' : 'Nothing open here'}</p>
              {!loading && <p className="m-0 text-muted-foreground">{q ? 'Check the device serial or clear the search.' : 'New alerts show up here as soon as a rule fires.'}</p>}
            </div>
          )}
          {list.map(i => {
            const on = peek?.id === i.id;
            const rail = i.status === 'resolved' ? 'var(--border)' : SEV[i.severity].color;
            return (
              <div key={i.id} className="flex items-stretch border-t border-border"
                style={{ boxShadow: `inset 4px 0 0 ${rail}`, opacity: i.status === 'resolved' ? 0.7 : 1, background: on ? 'color-mix(in srgb, var(--brand-green) 10%, transparent)' : undefined }}>
                <button type="button" aria-pressed={on} onClick={() => setSelId(i.id)}
                  className={`[display:grid] min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-0 bg-transparent py-3.5 pl-6 pr-3 text-left text-foreground hover:bg-muted/50 ${cols}`}>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2"><SevPill sev={i.severity} /><span className="font-medium">{i.title}</span></span>
                    <span className="mt-1 block truncate text-[13px] text-muted-foreground">{i.summary}</span>
                  </span>
                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate text-sm" style={{ fontFamily: 'Fira Code, monospace' }}>{i.deviceSerial ?? '—'}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{i.siteName ?? 'No site yet'}</span>
                  </span>
                  <span className="hidden whitespace-nowrap text-sm md:block">{i.status === 'resolved' ? 'Closed' : fmtSeconds(openSeconds(i))}</span>
                  <span className="whitespace-nowrap text-[13px] text-muted-foreground">{STATUS_TEXT[i.status]}</span>
                </button>
                <div className="flex items-center pr-4">
                  {i.status === 'active' && <button type="button" disabled={busy === i.id} onClick={() => act(i, 'ack')} className="rounded-2xl border border-[var(--brand-green)] bg-card px-3.5 py-2 text-sm font-semibold text-foreground">Acknowledge</button>}
                  {i.status === 'acknowledged' && <button type="button" disabled={busy === i.id} onClick={() => act(i, 'resolve')} className={`${btn} !py-2`}>Mark resolved</button>}
                </div>
              </div>
            );
          })}
        </section>

        {peek && (
          <aside aria-label="Selected alert" className={`sticky top-6 flex min-w-[300px] max-w-[420px] flex-[1_1_360px] flex-col gap-[18px] p-6 ${panel}`}>
            <div>
              <div className="flex items-center gap-2"><SevPill sev={peek.severity} /><span className="text-sm text-muted-foreground">{STATUS_TEXT[peek.status]}</span></div>
              <h2 className="m-0 mt-2.5 text-xl font-semibold leading-tight tracking-tight text-foreground">{peek.title}</h2>
              <p className="m-0 mt-2 text-[15px] leading-relaxed text-foreground">{peek.summary}</p>
            </div>
            <dl className="m-0 [display:grid] grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
              {([
                ['Device', peek.deviceSerial ?? '—'], ['Site', peek.siteName ?? 'No site yet'],
                ['Started', new Date(peek.tsStart).toLocaleString()],
                ['Open for', peek.status === 'resolved' ? 'Closed' : fmtSeconds(openSeconds(peek))],
                ['Found by', peek.detectedBy], ['Readings attached', String(peek.evidenceCount)],
              ] as const).map(([k, v]) => (
                <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="m-0 text-right font-medium text-foreground">{v}</dd></React.Fragment>
              ))}
            </dl>
            {peek.diagnostic && (peek.diagnostic.root_cause || peek.diagnostic.recommendation) && (
              <div className="rounded-2xl bg-muted px-4 py-3.5 text-sm leading-relaxed">
                {peek.diagnostic.root_cause && <><div className="mb-1 font-semibold">Likely cause</div><div className="mb-2.5">{peek.diagnostic.root_cause}</div></>}
                {peek.diagnostic.recommendation && <><div className="mb-1 font-semibold">What to do</div><div>{peek.diagnostic.recommendation}</div></>}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {peek.status === 'active' && <button type="button" className={btnPrimary} disabled={busy === peek.id} onClick={() => act(peek, 'ack')}>Acknowledge</button>}
              {peek.status === 'acknowledged' && <button type="button" className={btnPrimary} disabled={busy === peek.id} onClick={() => act(peek, 'resolve')}>Mark resolved</button>}
              {peek.deviceId != null && <Link to={`/devices/${peek.deviceId}/dashboard`} className={`${btn} text-center no-underline`}>Open device</Link>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default AlertsTriage;
