import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import { duration, hexCode } from './deviceChart';

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

  // Gap rows: more than 3× the median gap on this page (spec §5.3).
  const lines = useMemo(() => {
    if (!rows) return [];
    const gaps = rows.slice(1).map((r, i) => (Date.parse(rows[i].t) - Date.parse(r.t)) / 1000).sort((a, b) => a - b);
    const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
    const out: ({ gap: number } | Row)[] = [];
    rows.forEach((r, i) => {
      if (i > 0 && median) {
        const g = (Date.parse(rows[i - 1].t) - Date.parse(r.t)) / 1000;
        if (g > 3 * median) out.push({ gap: g });
      }
      out.push(r);
    });
    return out;
  }, [rows]);
  const allKeys = useMemo(() => [...new Set([...cols, ...(rows ?? []).flatMap(r => Object.keys(r.values))])].sort(), [rows, cols]);

  return (
    <section className="dt-card" aria-labelledby="dt-readings-h" style={{ background: 'transparent', border: 0, padding: 0 }}>
      <div className="dt-row">
        <h3 id="dt-readings-h" style={{ margin: 0, fontSize: 18 }}>Every reading</h3>
        <details>
          <summary style={{ cursor: 'pointer', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>Columns</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4, maxHeight: 240, overflow: 'auto', padding: 8 }}>
            {allKeys.map(k => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={cols.includes(k)} onChange={e => setCols(c => (e.target.checked ? [...c, k] : c.filter(x => x !== k)))} />{label(k)}
              </label>
            ))}
            <button type="button" className="dt-icon" style={{ padding: '0 12px' }} onClick={() => setCols(DEFAULT_COLS[kind])}>Reset columns</button>
          </div>
        </details>
        <label className="dt-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>Jump to
          <input type="datetime-local" value={jump} onChange={e => setJump(e.target.value)} style={{ minHeight: 40, borderRadius: 12, border: '1px solid var(--border)', padding: '0 10px', background: 'var(--card)', color: 'var(--foreground)' }} />
        </label>
        <button type="button" className="dt-icon" style={{ border: '1px solid var(--border)', padding: '0 12px' }} disabled={!jump}
          onClick={() => go(new Date(jump).toISOString(), [])}>Go</button>
        <span className="dt-sub">Newest first, every reading kept for 10 days</span>
      </div>
      <div className={`dt-split${open != null ? ' open' : ''}`}>
        <div style={{ overflowX: 'auto', minWidth: 0, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--card)' }}>
          {rows === null ? <p className="dt-sub" style={{ padding: 18 }}>Loading…</p> : rows.length === 0 ? <p className="dt-sub" style={{ padding: 18 }}>{failed ? "Couldn't load readings. Try again in a moment." : 'No readings in the last 10 days.'}</p> : (
            <table className="dt-table">
              <thead><tr><th scope="col">Time</th>{cols.map(k => <th key={k} scope="col">{label(k)}</th>)}<th scope="col"><span className="sr-only">Packet</span></th></tr></thead>
              <tbody>
                {lines.map((l, i) => ('gap' in l ? (
                  <tr key={`g${i}`} className="gap"><td colSpan={cols.length + 2}>No readings for {duration(l.gap)}</td></tr>
                ) : (
                  <tr key={l.id} data-row="" onClick={() => openRow(l.id)}
                    className={[Object.entries(l.values).some(([k, v]) => isCode(k) && typeof v === 'number' && v !== 0) ? 'fault' : '', open === l.id ? 'selected' : ''].filter(Boolean).join(' ') || undefined}>
                    <td>{dateTime(l.t)}</td>
                    {cols.map(k => <td key={k}>{cell(k, l.values[k])}</td>)}
                    <td><button type="button" className="dt-icon" aria-label={`Open packet for ${time(l.t)}`} aria-expanded={open === l.id} onClick={e => { e.stopPropagation(); openRow(l.id); }}>{'{ }'}</button></td>
                  </tr>
                )))}
              </tbody>
            </table>
          )}
          <div className="dt-row" style={{ padding: 12 }}>
            {before && <button type="button" className="dt-icon" style={{ padding: '0 12px' }} onClick={() => go(undefined, [])}>Newest</button>}
            {stack.length > 0 && <button type="button" className="dt-icon" style={{ padding: '0 12px' }} onClick={() => go(stack[stack.length - 1], stack.slice(0, -1))}>Newer</button>}
            {next && <button type="button" className="dt-icon" style={{ padding: '0 12px' }} onClick={() => go(next, [...stack, before])}>Older</button>}
          </div>
        </div>
        {open != null && <PacketPanel packet={packet} onClose={close} />}
      </div>
    </section>
  );
}

function PacketPanel({ packet, onClose }: { packet: Packet | 'failed' | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = packet && packet !== 'failed'
    ? (packet.kind === 'meter' ? packet.raw ?? '' : JSON.stringify(packet.reading, null, 2)) : '';
  return (
    <section className="dt-packet" aria-labelledby="dt-pk-h">
      <div className="dt-row" style={{ justifyContent: 'space-between' }}>
        <h4 id="dt-pk-h" style={{ margin: 0, fontSize: 15 }}>Packet as the device sent it{packet && packet !== 'failed' ? `, ${time(packet.reading_time)}` : ''}</h4>
        <div className="dt-row">
          <button type="button" disabled={!text} onClick={() => { Promise.resolve(navigator.clipboard?.writeText(text)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => { /* clipboard refused */ }); }}>{copied ? 'Copied' : 'Copy'}</button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
      {packet === null && <span>Loading…</span>}
      {packet === 'failed' && <span>Couldn't load this packet. Try again in a moment.</span>}
      {packet && packet !== 'failed' && (packet.kind === 'meter' ? (
        <>{packet.raw ? <pre>{packet.raw}</pre> : <span>This reading has no stored message.</span>}
          <pre>{JSON.stringify(packet.parsed, null, 2)}</pre></>
      ) : (
        <>
          <pre>{text}</pre>
          {packet.message ? (
            <details>
              <summary style={{ cursor: 'pointer' }}>Closest message received, {time(packet.message.received_at)}, {packet.message.size_bytes.toLocaleString('en-IN')} bytes</summary>
              {(packet.message.text || packet.message.hex) && <pre>{packet.message.text || packet.message.hex}</pre>}
            </details>
          ) : (
            <span style={{ fontSize: 13, color: '#A9C4C2' }}>{packet.message_note === 'pruned'
              ? 'The whole message is older than 14 days and has been removed.'
              : 'No stored message within 2 seconds of this reading.'}</span>
          )}
        </>
      ))}
    </section>
  );
}
