import { Activity, AlertTriangle } from 'lucide-react';
import { EmptyState, Notice } from '../../../shared/components/Feedback';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import { duration, hexCode } from './deviceChart';
import { TableSkeleton } from './Skeleton';
import './readingsTab.css';

type Row = { id: number; t: string; received_at?: string; values: Record<string, number | string | boolean> };
type Packet =
  | { kind: 'gateway'; reading_time: string; received_at: string; reading: unknown; message: { received_at: string; size_bytes: number; text: string | null; hex: string | null } | null; message_note: 'pruned' | 'not_found' | null }
  | { kind: 'meter'; reading_time: string; raw: string | null; parsed: Record<string, number> };

// Default columns (spec §5.3: 7 per device type). The picker adds any other key; the choice is kept per device type.
const DEFAULT_COLS: Record<'gateway' | 'meter', string[]> = {
  gateway: ['pv1_power_w', 'pv2_power_w', 'load_l1_power_w', 'grid_power_w', 'battery_power_w', 'battery_soc_percent', 'fault_word_1'],
  meter: ['active_power_total', 'voltage_l1', 'voltage_l2', 'voltage_l3', 'current_l1', 'frequency_l1', 'power_factor_l1'],
};
const isCode = (k: string) => /(fault|warning)_(word|code)/.test(k);
const label = (k: string) => k.replace(/_/g, ' ').replace(/\b(w|v|a|hz|c|percent)$/, m => ({ w: 'W', v: 'V', a: 'A', hz: 'Hz', c: '°C', percent: '%' } as Record<string, string>)[m]);
const cell = (k: string, v: unknown) => (typeof v !== 'number' ? (v == null ? '–' : String(v)) : isCode(k) ? hexCode(v) : v.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour12: false });
const dateTime = (iso: string) => `${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${time(iso)}`;
const savedCols = (kind: 'gateway' | 'meter'): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(kind)) ?? '');
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) return v;
  } catch { /* fall through */ }
  return DEFAULT_COLS[kind];
};
const storeKey = (kind: string) => `dt-cols-${kind}`;


export default function ReadingsTab({ deviceId, meter }: { deviceId: number; meter: boolean }) {
  const kind = meter ? 'meter' : 'gateway';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [before, setBefore] = useState<string | undefined>(undefined);
  const [stack, setStack] = useState<(string | undefined)[]>([]);
  const [failed, setFailed] = useState(false);
  const req = useRef(0);
  const [jump, setJump] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [packet, setPacket] = useState<Packet | 'failed' | null>(null);
  const [cols, setCols] = useState<string[]>(() => savedCols(kind));

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    apiService.getDeviceReadings(deviceId, before ? { before } : {})
      .then((d: { rows: Row[]; next_before: string | null }) => { if (!cancelled) { setRows(d.rows); setNext(d.next_before); } })
      .catch(() => { if (!cancelled) { setRows([]); setFailed(true); } });
    return () => { cancelled = true; };
  }, [deviceId, before]);
  useEffect(() => { try { localStorage.setItem(storeKey(kind), JSON.stringify(cols)); } catch { /* private mode */ } }, [cols, kind]);

  const openRow = (id: number) => {
    if (open === id) { close(); return; }
    const n = ++req.current;
    setOpen(id); setPacket(null);
    apiService.getReadingPacket(deviceId, id)
      .then((p: Packet) => { if (n === req.current) setPacket(p); })
      .catch(() => { if (n === req.current) setPacket('failed'); });
  };
  const close = () => { req.current++; setOpen(null); };
  const go = (b: string | undefined, st: (string | undefined)[]) => { close(); setStack(st); setBefore(b); };
  // Arrow keys move the selection to the neighbouring reading (skipping gap rows); Esc closes; Enter opens.
  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>, id: number) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter' && e.target === e.currentTarget) { openRow(id); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    let el = (e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null;
    while (el && !el.hasAttribute('data-row')) el = (e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling) as HTMLElement | null;
    if (el) { el.focus(); openRow(Number(el.dataset.id)); }
  };

  // Gap rows: more than 3× the median gap on this page (spec §5.3).
  const lines = useMemo(() => {
    if (!rows) return [];
    const gaps = rows.slice(1).map((r, i) => (Date.parse(rows[i].t) - Date.parse(r.t)) / 1000).sort((a, b) => a - b);
    const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
    const out: ({ gap: number; from: string; to: string } | Row)[] = [];
    rows.forEach((r, i) => {
      if (i > 0 && median) {
        const g = (Date.parse(rows[i - 1].t) - Date.parse(r.t)) / 1000;
        if (g > 3 * median) out.push({ gap: g, from: r.t, to: rows[i - 1].t });
      }
      out.push(r);
    });
    return out;
  }, [rows]);
  const allKeys = useMemo(() => [...new Set([...cols, ...(rows ?? []).flatMap(r => Object.keys(r.values))])].sort(), [rows, cols]);
  const pos = rows ? rows.findIndex(r => r.id === open) + 1 : 0;

  return (
    <section className="rt" aria-label="Every reading">
      <div className="rt-bar">
        <div className="rt-seg" role="group" aria-label="Move through readings">
          <button type="button" className="rt-pill" aria-pressed={!before} onClick={() => go(undefined, [])}>Newest</button>
          <button type="button" className="rt-pill" disabled={!next} onClick={() => next && go(next, [...stack, before])}>Older</button>
          <button type="button" className="rt-pill" disabled={!stack.length} onClick={() => go(stack[stack.length - 1], stack.slice(0, -1))}>Newer</button>
        </div>
        <label className="rt-jump">Jump to
          <input type="datetime-local" value={jump} onChange={e => setJump(e.target.value)} />
        </label>
        <button type="button" className="rt-pill" disabled={!jump} onClick={() => go(new Date(jump).toISOString(), [])}>Go</button>
        <details className="rt-cols">
          <summary className="rt-pill">Columns <span className="rt-cnt">{cols.length}</span></summary>
          <div>
            {allKeys.map(k => (
              <label key={k}>
                <input type="checkbox" checked={cols.includes(k)} onChange={e => setCols(c => (e.target.checked ? [...c, k] : c.filter(x => x !== k)))} />{label(k)}
              </label>
            ))}
            <button type="button" className="rt-pill" onClick={() => setCols(DEFAULT_COLS[kind])}>Reset columns</button>
          </div>
        </details>
        {rows && rows.length > 0 && (
          <span className="rt-range"><span className="rt-num">{rows.length}</span> readings, {time(rows[0].t)} back to {time(rows[rows.length - 1].t)}.</span>
        )}
      </div>
      <div className="rt-split">
        <div className="rt-card">
          {rows === null ? <TableSkeleton cols={cols.length + 1} /> : rows.length === 0 ? (failed ? <EmptyState icon={AlertTriangle} title="Couldn't load readings" description="The page tries again by itself in a moment." />
            : <EmptyState icon={Activity} title="No readings in the last 10 days" description="Readings show here within a minute of the device connecting." />) : (
            <div className="rt-scroll">
              <table className="rt-table">
                <thead><tr><th scope="col">Time</th>{cols.map(k => <th key={k} scope="col">{label(k)}</th>)}<th scope="col"><span className="sr-only">Packet</span></th></tr></thead>
                <tbody>
                  {lines.map((l, i) => ('gap' in l ? (
                    <tr key={`g${i}`} className="gap"><td colSpan={cols.length + 2}><span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 8v5M12 17v.5" /><circle cx="12" cy="12" r="10" /></svg>
                      No readings for {duration(l.gap)} ({time(l.from)} to {time(l.to)}). The device was not sending.</span></td></tr>
                  ) : (
                    <tr key={l.id} data-row="" data-id={l.id} onClick={() => openRow(l.id)} onKeyDown={e => onKey(e, l.id)}
                      tabIndex={open === l.id || (open == null && l === rows[0]) ? 0 : -1} aria-selected={open === l.id}
                      className={[Object.entries(l.values).some(([k, v]) => isCode(k) && typeof v === 'number' && v !== 0) ? 'fault' : '', open === l.id ? 'selected' : ''].filter(Boolean).join(' ') || undefined}>
                      <td>{dateTime(l.t)}</td>
                      {cols.map(k => <td key={k}>{cell(k, l.values[k])}</td>)}
                      <td><button type="button" className="rt-open" aria-label={`Open packet for ${time(l.t)}`} aria-expanded={open === l.id} onClick={e => { e.stopPropagation(); openRow(l.id); }}>›</button></td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          )}
          <div className="rt-foot">
            <button type="button" className="rt-pill" disabled={!next} onClick={() => next && go(next, [...stack, before])}>Older 100</button>
            <span>{pos ? <>Reading <span className="rt-num">{pos}</span> of <span className="rt-num">{rows!.length}</span> selected. </> : null}Press the arrow keys to move, Esc to close the packet.</span>
          </div>
        </div>
        {open != null && <PacketPanel key={open} packet={packet} onClose={close} />}
      </div>
    </section>
  );
}

const csv = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v) : typeof v === 'object' && v ? JSON.stringify(JSON.stringify(v)) : String(v));
const FEW = 7;

function PacketPanel({ packet, onClose }: { packet: Packet | 'failed' | null; onClose: () => void }) {
  const [copied, setCopied] = useState('');
  const [view, setView] = useState<'stored' | 'wire'>('stored');
  const [all, setAll] = useState(false);
  const ok = packet && packet !== 'failed' ? packet : null;
  const stored = ok ? ((ok.kind === 'meter' ? ok.parsed : ok.reading) ?? {}) as Record<string, unknown> : {};
  const entries = Object.entries(stored);
  const json = ok ? JSON.stringify(stored, null, 2) : '';
  const msg = ok && ok.kind === 'gateway' ? ok.message : null;
  const wire = ok ? (ok.kind === 'meter' ? ok.raw : msg ? msg.text || msg.hex : null) : null;
  const codes = entries.filter(([k, v]) => isCode(k) && typeof v === 'number' && v !== 0).length;
  const size = msg ? msg.size_bytes : json.length;
  const off = msg && ok ? (Date.parse(msg.received_at) - Date.parse(ok.reading_time)) / 1000 : 0;
  const copy = (name: string, text: string) => { Promise.resolve(navigator.clipboard?.writeText(text)).then(() => { setCopied(name); setTimeout(() => setCopied(''), 2000); }).catch(() => { /* clipboard refused */ }); };
  const shown = all ? entries : entries.slice(0, FEW);
  return (
    <aside className="rt-pk" aria-label="Packet">
      <header>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>Reading <span className="rt-num">{ok ? time(ok.reading_time) : ''}</span></h4>
          {ok && <div className="rt-pk-sub">Stored {time(ok.reading_time)}{msg ? `, nearest message ${Math.abs(off).toFixed(1)} s ${off < 0 ? 'earlier' : 'later'}` : ''}</div>}
        </div>
        <button type="button" className="rt-pill" aria-label="Close packet" onClick={onClose}>Close</button>
      </header>
      {packet === null && <p className="rt-msg">Loading…</p>}
      {packet === 'failed' && <Notice tone="bad" more="Try again in a moment.">Couldn't load this packet.</Notice>}
      {ok && (
        <>
          <div className="rt-views" role="group" aria-label="Packet view">
            <button type="button" className={`rt-pill${view === 'stored' ? ' on' : ''}`} aria-pressed={view === 'stored'} onClick={() => setView('stored')}>As stored</button>
            <button type="button" className={`rt-pill${view === 'wire' ? ' on' : ''}`} aria-pressed={view === 'wire'} onClick={() => setView('wire')}>Message on the wire</button>
          </div>
          <div className="rt-body">
            <div className="rt-sum">
              <span><b className="rt-num">{entries.length}</b> keys</span>
              <span><b className="rt-num">{size < 1024 ? size : (size / 1024).toFixed(1)}</b> {size < 1024 ? 'bytes' : 'KB'}</span>
              {codes > 0 && <span className="rt-chip">{codes} fault code{codes > 1 ? 's' : ''}</span>}
            </div>
            {view === 'stored' ? (
              <pre className="rt-json">
                {shown.map(([k, v]) => {
                  const hl = isCode(k) && typeof v === 'number' && v !== 0;
                  const line = <><span className="rt-k">{JSON.stringify(k)}</span>: <span className="rt-s">{JSON.stringify(v)}</span>,{'\n'}</>;
                  return hl ? <span key={k} className="rt-hl">{line}</span> : <React.Fragment key={k}>{line}</React.Fragment>;
                })}
                {!all && entries.length > FEW && <span className="rt-more">… {entries.length - FEW} more keys</span>}
              </pre>
            ) : wire ? <pre className="rt-json">{wire}</pre> : (
              <p className="rt-pk-sub">{ok.kind === 'meter' ? 'This reading has no stored message.' : ok.message_note === 'pruned'
                ? 'The whole message is older than 14 days and has been removed.'
                : 'No stored message within 2 seconds of this reading.'}</p>
            )}
          </div>
          <div className="rt-acts">
            <button type="button" className="rt-pill" onClick={() => copy('json', json)}>{copied === 'json' ? 'Copied' : 'Copy as JSON'}</button>
            <button type="button" className="rt-pill" onClick={() => copy('csv', `${entries.map(([k]) => k).join(',')}\n${entries.map(([, v]) => csv(v)).join(',')}`)}>{copied === 'csv' ? 'Copied' : 'Copy one row as CSV'}</button>
            {entries.length > FEW && <button type="button" className="rt-link" onClick={() => setAll(a => !a)}>{all ? `Show first ${FEW} keys` : `Show all ${entries.length} keys`}</button>}
          </div>
        </>
      )}
    </aside>
  );
}
