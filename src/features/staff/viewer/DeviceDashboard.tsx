import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiService } from '../../../services/api';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAccess } from '../../../shared/access/useAccess';
import { EmptyState, useTokens } from '../siteHardware/ui';
import { at, devName, type Dev, type Firmware } from './DevicePage';
import OverviewChart from './OverviewChart';
import ReadingsTab from './ReadingsTab';
import OperationsTab from './OperationsTab';
import { ALLOWED, DETAIL_LABEL, GATEWAY_READINGS, METER_READINGS, RANGES, fitDetail, type Detail, type Series } from './deviceChart';
import { getFirmware } from './deviceCache';
import './deviceDashboard.css';
import './deviceTabs.css';

type Point = { t: string } & Record<string, number>;
type Dash = Dev & {
  site_id: string | null; last_reading_at: string | null; range_start: string; range_end: string;
  bucket_minutes: number; sampled_every: number; latest: Record<string, number | string | boolean> | null; history: Point[];
};

const VALUE_RANGES: [string, number][] = [['6h', 6], ['24h', 24], ['48h', 48], ['7d', 168]];
const PHASE_COLOR = ['var(--ph1)', 'var(--ph2)', 'var(--ph3)'];

// ── Naming: backend key -> plain label, unit, section ────────────────────────
const UNITS: [string, string][] = [['_kwh', 'kWh'], ['_va', 'VA'], ['_hz', 'Hz'], ['_c', '°C'], ['_ah', 'Ah'], ['_percent', '%'], ['_w', 'W'], ['_v', 'V'], ['_a', 'A']];
const WORDS: Record<string, string> = {
  pv: 'Solar', pv1: 'PV1', pv2: 'PV2', pv3: 'PV3', pv4: 'PV4', grid: 'Grid', load: 'Home use', battery: 'Battery', batt: 'Battery',
  battery2: 'Battery 2', gen: 'Generator', ext: 'External', ct: 'CT', inv: 'Inverter', inverter: 'Inverter', dc: 'DC', ac: 'AC',
  soc: 'charge', temp: 'temperature', buy: 'bought', sell: 'sold', today: 'today', total: 'total', apparent: 'apparent',
  reactive: 'reactive', active: 'active', factor: 'factor', word: 'word', fault: 'Fault', warning: 'Warning', code: 'code',
  run: 'Run', state: 'state', work: 'Work', mode: 'mode', rated: 'Rated', uptime: 'Uptime', seconds: '(s)', firmware: 'Firmware',
  version: 'version', main: 'main', slave: 'inverter', data: 'Data', stale: 'stale', source: 'source', status: 'status',
};
function unitOf(key: string): [string, string] {
  const u = UNITS.find(([s]) => key.endsWith(s));
  return u ? [key.slice(0, -u[0].length), u[1]] : [key, ''];
}
function labelOf(key: string): string {
  const words = unitOf(key)[0].split('_').filter(w => w && w !== 'lN').map(w => WORDS[w] ?? w);
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + (key.includes('_lN') ? ' per phase' : '');
}
const SECTIONS_GATEWAY: [string, (k: string) => boolean][] = [
  ['Energy counters', k => k.endsWith('_kwh')],
  ['Status and codes', k => /fault|warning|run_state|work_mode|status|firmware|uptime|rated|data_|capacity/.test(k)],
  ['Temperatures', k => k.endsWith('_temp_c')],
  ['Solar', k => k.startsWith('pv')],
  ['Battery 2', k => k.startsWith('battery2')],
  ['Battery', k => k.startsWith('batt')],
  ['Grid', k => k.startsWith('grid')],
  ['Home use', k => k.startsWith('load')],
  ['Inverter output', k => /^(ac_|inv_)/.test(k)],
  ['Generator', k => k.startsWith('gen')],
  ['External meter', k => k.startsWith('ext_ct')],
];
const SECTIONS_METER: [string, (k: string) => boolean][] = [
  ['Voltage', k => k.startsWith('voltage')], ['Current', k => k.startsWith('current')], ['Frequency', k => k.startsWith('frequency')],
  ['Active power', k => k.startsWith('active')], ['Reactive power', k => k.startsWith('reactive')],
  ['Apparent power', k => k.startsWith('apparent')], ['Power factor', k => k.startsWith('power_factor')],
];
const SECTION_ORDER = ['Solar', 'Grid', 'Home use', 'Battery', 'Battery 2', 'Inverter output', 'Generator', 'External meter', 'Temperatures', 'Energy counters', 'Status and codes', 'Other'];

/** A reading row: one key, or the three L1/L2/L3 keys of one measurement. */
type Reading = { id: string; label: string; unit: string; keys: string[] };

function groupReadings(keys: string[], meter: boolean): [string, Reading[]][] {
  const phased = new Map<string, string[]>();
  for (const k of keys) {
    const m = k.match(/(^|_)l([123])(_|$)/);
    const id = m ? k.replace(/(^|_)l[123](_|$)/, '$1lN$2') : k;
    phased.set(id, [...(phased.get(id) ?? []), k].sort());
  }
  const sections = new Map<string, Reading[]>();
  for (const [id, ks] of phased) {
    const name = (meter ? SECTIONS_METER : SECTIONS_GATEWAY).find(([, test]) => test(id))?.[0] ?? 'Other';
    const unit = meter ? ({ voltage: 'V', current: 'A', frequency: 'Hz', active: 'W', reactive: 'var', apparent: 'VA' } as Record<string, string>)[id.split('_')[0]] ?? '' : unitOf(id)[1];
    sections.set(name, [...(sections.get(name) ?? []), { id, label: labelOf(id), unit, keys: ks }]);
  }
  const order = meter ? [...SECTIONS_METER.map(([n]) => n), 'Other'] : SECTION_ORDER;
  return order.filter(n => sections.has(n)).map(n => [n, sections.get(n)!.sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))]);
}

const fmt = (v: unknown) => (typeof v === 'number' ? (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-IN') : String(Math.round(v * 100) / 100)) : String(v));
const clock = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Spark({ history, keys }: { history: Point[]; keys: string[] }) {
  const vals = history.flatMap(p => keys.map(k => p[k])).filter(v => typeof v === 'number');
  if (vals.length < 2) return <span className="dd-spark" />;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1, n = history.length - 1 || 1;
  return (
    <svg className="dd-spark" viewBox="0 0 96 28" preserveAspectRatio="none" aria-hidden="true">
      {keys.map((k, i) => (
        <polyline key={k} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke"
          stroke={keys.length > 1 ? PHASE_COLOR[i] : 'var(--brand-green)'}
          points={history.flatMap((p, j) => (typeof p[k] === 'number' ? [`${(j / n) * 96},${26 - ((p[k] - lo) / span) * 24}`] : [])).join(' ')} />
      ))}
    </svg>
  );
}

function Row({ r, dash, open, onToggle }: { r: Reading; dash: Dash; open: boolean; onToggle: () => void }) {
  const numeric = dash.history.some(p => r.keys.some(k => typeof p[k] === 'number'));
  return (
    <div className="dd-row">
      <button type="button" onClick={onToggle} disabled={!numeric} aria-expanded={numeric ? open : undefined}>
        <span className="dd-label">{r.label}</span>
        <span className="dd-vals">
          {r.keys.map((k, i) => {
            const v = dash.latest?.[k];
            const text = v == null ? '–' : fmt(v);
            return r.keys.length > 1
              ? <span key={k} className="dd-ph" style={{ ['--c' as string]: PHASE_COLOR[i] }} title={`L${i + 1}`}>{text}</span>
              : <span key={k}>{text}{r.unit && v != null && <small>{r.unit}</small>}</span>;
          })}
          {r.keys.length > 1 && r.unit && <small>{r.unit}</small>}
        </span>
        <Spark history={dash.history} keys={r.keys} />
      </button>
      {open && numeric && (
        <div className="dd-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dash.history} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="t" tickFormatter={clock} minTickGap={60} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis width={52} fontSize={12} stroke="var(--muted-foreground)" domain={['auto', 'auto']} />
              <Tooltip labelFormatter={l => clock(String(l))} formatter={(v, name) => [`${fmt(v)} ${r.unit}`, r.keys.length > 1 ? `L${r.keys.indexOf(String(name)) + 1}` : r.label]} />
              {r.keys.map((k, i) => <Line key={k} dataKey={k} type="monotone" dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} stroke={r.keys.length > 1 ? PHASE_COLOR[i] : 'var(--brand-green)'} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const TABS = [['overview', 'Overview'], ['values', 'All values'], ['readings', 'Every reading'], ['ops', 'Operations']] as const;
type Tab = typeof TABS[number][0];

function Tiles({ latest, meter }: { latest: Record<string, unknown> | null; meter: boolean }) {
  const n = (k: string) => (typeof latest?.[k] === 'number' ? (latest[k] as number) : null);
  const sum = (...ks: string[]) => { const v = ks.map(n).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const avg = (...ks: string[]) => { const v = ks.map(n).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const kw = (w: number | null) => (w == null ? '–' : (w / 1000).toFixed(2));
  const w0 = (w: number | null) => (w == null ? '–' : Math.round(w));
  const bat = n('battery_power_w'), grid = n('grid_power_w');
  const tiles: [string, string, string, string][] = meter ? [
    ['Total power', kw(n('active_power_total')), 'kW', 'All three phases'],
    ['Voltage', avg('voltage_l1', 'voltage_l2', 'voltage_l3')?.toFixed(1) ?? '–', 'V', 'Average of the phases'],
    ['Current', sum('current_l1', 'current_l2', 'current_l3')?.toFixed(2) ?? '–', 'A', 'Sum of the phases'],
    ['Power factor', avg('power_factor_l1', 'power_factor_l2', 'power_factor_l3')?.toFixed(2) ?? '–', '', 'Average of the phases'],
  ] : [
    ['Solar', kw(sum('pv1_power_w', 'pv2_power_w')), 'kW', `Strings ${kw(n('pv1_power_w'))} + ${kw(n('pv2_power_w'))} kW`],
    ['Home use', kw(sum('load_l1_power_w', 'load_l2_power_w', 'load_l3_power_w')), 'kW', `R ${w0(n('load_l1_power_w'))}, Y ${w0(n('load_l2_power_w'))}, B ${w0(n('load_l3_power_w'))} W`],
    ['Battery', n('battery_soc_percent')?.toFixed(0) ?? '–', '%', bat == null ? '' : Math.abs(bat) < 1 ? 'Idle' : bat < 0 ? `Charging at ${kw(-bat)} kW` : `Giving ${kw(bat)} kW`],
    ['Grid', kw(grid == null ? null : Math.abs(grid)), 'kW', grid == null ? '' : Math.abs(grid) < 1 ? 'Idle' : grid > 0 ? 'Buying' : 'Selling'],
  ];
  return (
    <section className="dt-tiles" aria-label="Right now">
      {tiles.map(([label, value, unit, sub]) => (
        <div key={label} className="dt-tile">
          <span className="dt-sub" style={{ fontSize: 14 }}>{label}</span>
          <span className="dt-num">{value}{unit && <span className="dt-unit">{unit}</span>}</span>
          <span className="dt-sub">{sub}</span>
        </div>
      ))}
    </section>
  );
}

type Sel = { hours: number; detail: Detail; readingId: string };

function Overview({ deviceId, meter, latest, sel, setSel }: { deviceId: number; meter: boolean; latest: Record<string, unknown> | null; sel: Sel; setSel: (s: Sel) => void }) {
  const readings = meter ? METER_READINGS : GATEWAY_READINGS;
  const { hours, detail } = sel;
  const [data, setData] = useState<Series | null>(null);
  const [failed, setFailed] = useState(false);
  const reading = readings.find(r => r.id === sel.readingId) ?? readings[0];
  const fresh = !!data && data.detail === detail && data.keys.join() === reading.keys.join()
    && Math.round((Date.parse(data.range_end) - Date.parse(data.range_start)) / 3.6e6) === hours;

  useEffect(() => {
    let live = true, seq = 0;
    const load = () => {
      const my = ++seq;
      return apiService.getDeviceSeries(deviceId, hours, detail, reading.keys)
        .then((d: Series) => { if (live && my === seq) { setData(d); setFailed(false); } })
        .catch(() => { if (live && my === seq) setFailed(true); });
    };
    load();
    const id = setInterval(load, hours === 1 ? 15_000 : 60_000);
    return () => { live = false; clearInterval(id); };
  }, [deviceId, hours, detail, reading.keys]);

  const PER: Record<Detail, string> = { every: '', '1m': 'minute', '5m': '5 minutes', '1h': 'hour', '1d': 'day' };
  const note = detail === 'every' ? 'Every reading as sent' : `Line is the average per ${PER[detail]}; the band is the lowest to highest reading in it`;
  return (
    <>
      <Tiles latest={latest} meter={meter} />
      <section className="dt-card" aria-label="Chart">
        <div className="dt-row">
          <div className="dt-pills" role="group" aria-label="Range">
            {RANGES.map(([label, h]) => (
              <button key={h} type="button" aria-pressed={hours === h} onClick={() => setSel({ ...sel, hours: h, detail: fitDetail(h, detail) })}>{label}</button>
            ))}
          </div>
          <div className="dt-pills" role="group" aria-label="Detail">
            {ALLOWED[hours].map(d => <button key={d} type="button" aria-pressed={detail === d} onClick={() => setSel({ ...sel, detail: d })}>{DETAIL_LABEL[d]}</button>)}
          </div>
          <span className="dt-sub" style={{ marginLeft: 'auto' }}>{note}</span>
        </div>
        <div className="dt-chips" role="group" aria-label="Reading to chart">
          {readings.map(r => <button key={r.id} type="button" aria-pressed={r.id === reading.id} onClick={() => setSel({ ...sel, readingId: r.id })}>{r.label}</button>)}
        </div>
        {data ? <div style={{ opacity: fresh ? 1 : 0.6 }}><OverviewChart data={data} reading={reading} /></div> : <p className="dt-sub">{failed ? "Couldn't load the chart. Trying again…" : 'Loading…'}</p>}
      </section>
    </>
  );
}

/** /devices/:deviceId/dashboard: every reading one device reports, with or without a site. The backend scopes viewers to their devices. */
const DeviceDashboardInner: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const access = useAccess();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS.find(([k]) => k === params.get('tab'))?.[0]) ?? 'overview';
  const pick = (k: Tab) => setParams(p => { const n = new URLSearchParams(p); if (k === 'overview') n.delete('tab'); else n.set('tab', k); return n; }, { replace: true });
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault(); pick(TABS[j][0]);
    document.getElementById(`dt-tab-${TABS[j][0]}`)?.focus();
  };
  const [sel, setSel] = useState<Sel>({ hours: 1, detail: 'every', readingId: '' });
  const [valueHours, setValueHours] = useState(24);
  const [dash, setDash] = useState<Dash | null | 'failed'>(null);
  const [firmware, setFirmware] = useState<Firmware[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [find, setFind] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => apiService.getDeviceDashboard(Number(deviceId), valueHours)
      .then((d: Dash) => { if (live) setDash(d); }).catch(() => { if (live) setDash(p => (p && p !== 'failed' ? p : 'failed')); });
    load();
    const id = setInterval(load, 60_000);
    return () => { live = false; clearInterval(id); };
  }, [deviceId, valueHours]);
  useEffect(() => { getFirmware().then(setFirmware); }, []);

  const d = typeof dash === 'object' ? dash : null;
  const sections = useMemo(() => {
    if (!d) return [];
    const keys = new Set([...Object.keys(d.latest ?? {}), ...d.history.flatMap(p => Object.keys(p))]);
    keys.delete('t');
    return groupReadings([...keys], d.device_type === 'energy_meter');
  }, [d]);
  const ribbon = useMemo(() => {
    if (!d) return { cells: [] as boolean[], sent: 0 };
    const step = d.bucket_minutes * 60_000;
    const first = Math.floor(new Date(d.range_start).getTime() / step) * step;
    const have = new Set(d.history.map(p => new Date(p.t).getTime()));
    const cells: boolean[] = [];
    for (let s = first; s <= new Date(d.range_end).getTime(); s += step) cells.push(have.has(s));
    return { cells, sent: cells.filter(Boolean).length };
  }, [d]);

  const back = <Link to={access.can('my_sites') ? '/my-sites' : '/devices'} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: t.ink2, textDecoration: 'none', fontSize: '0.9rem' }}>‹ Back</Link>;
  if (dash === 'failed') return <div>{back}<EmptyState isDark={isDark} headline="This device isn't available to you" detail="Ask an admin if you need access." /></div>;
  if (!d) return <div>{back}<p style={{ color: t.ink2 }}>Loading…</p></div>;

  const q = find.trim().toLowerCase();
  const shown = sections.map(([n, rows]) => [n, q ? rows.filter(r => r.label.toLowerCase().includes(q) || n.toLowerCase().includes(q)) : rows] as const).filter(([, rows]) => rows.length);
  const slot = d.bucket_minutes === 5 ? 'five-minute' : 'half-hour';
  const stale = d.last_reading_at && Date.now() - new Date(d.last_reading_at).getTime() > 15 * 60_000;

  return (
    <div className="dd dt" style={{ fontFamily: t.body }}>
      <div>{back}</div>
      <header className="dd-head">
        <div>
          <h2 className="dd-name">{devName(d)}</h2>
          <p className="dd-facts">
            <span className={`dd-live${d.is_online ? ' on' : ''}`} aria-hidden="true" />
            <b>{d.is_online ? 'Live' : 'Not reporting'}</b>
            {d.last_reading_at && <>, last reading {at(d.last_reading_at)}</>}
            {d.site_id ? <>, at site {d.site_id}</> : <>, not at a site</>}
            {d.firmware_version && <>, firmware {d.firmware_version}</>}
          </p>
        </div>
      </header>

      {!d.last_reading_at && <EmptyState isDark={isDark} headline="No readings yet" detail="Readings show here within a minute of the device connecting." />}
      {stale && d.last_reading_at && <div className="dd-banner">This device stopped sending at {at(d.last_reading_at)}. The charts show the time before that.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="dt-tabs" role="tablist" aria-label="Device sections" onKeyDown={onTabKey}>
          {TABS.map(([k, label]) => (
            <button key={k} id={`dt-tab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="dt-panel" tabIndex={tab === k ? 0 : -1} onClick={() => pick(k)}>
              {label}{k === 'values' && <span className="dt-count">{sections.reduce((n, [, rows]) => n + rows.length, 0)}</span>}
            </button>
          ))}
        </div>
        <div id="dt-panel" role="tabpanel" aria-labelledby={`dt-tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {tab === 'overview' && <Overview deviceId={Number(deviceId)} meter={d.device_type === 'energy_meter'} latest={d.latest} sel={sel} setSel={setSel} />}
        {tab === 'values' && d.last_reading_at && (
          <>
            <div className="dd-range" role="group" aria-label="Time range">
              {VALUE_RANGES.map(([label, h]) => <button key={h} type="button" aria-pressed={valueHours === h} onClick={() => setValueHours(h)}>{label}</button>)}
            </div>
            <section className="dd-ribbon" aria-label="When the device sent data">
              <div className="dd-cells" role="img" aria-label={`Sent data in ${ribbon.sent} of ${ribbon.cells.length} ${slot} slots`}>
                {ribbon.cells.map((on, i) => <i key={i} className={on ? '' : 'miss'} />)}
              </div>
              <div className="dd-ends"><span>{clock(d.range_start)}</span><span>{clock(d.range_end)}</span></div>
              <p className="dd-cover">Sent data in {ribbon.sent} of {ribbon.cells.length} {slot} slots.</p>
              {d.sampled_every > 1 && <p className="dd-note">For this range the charts use every {d.sampled_every}th reading.</p>}
            </section>
            <input className="dd-find" type="search" aria-label="Find a reading" placeholder="Find a reading" value={find} onChange={e => setFind(e.target.value)} />
            {shown.length === 0 && <p style={{ margin: 0, color: t.ink2 }}>No reading matches that search.</p>}
            {shown.map(([name, rows]) => (
              <section key={name} className="dd-sec">
                <h3>{name}</h3>
                <div className="dd-rows">
                  {rows.map(r => <Row key={r.id} r={r} dash={d} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />)}
                </div>
              </section>
            ))}
          </>
        )}
        {tab === 'readings' && <ReadingsTab deviceId={Number(deviceId)} meter={d.device_type === 'energy_meter'} />}
        {tab === 'ops' && <OperationsTab dev={d} firmware={firmware} isDark={isDark} />}
        </div>
      </div>
    </div>
  );
};

const DeviceDashboard: React.FC = () => {
  const { deviceId = '' } = useParams<{ deviceId: string }>();
  return <DeviceDashboardInner key={deviceId} deviceId={deviceId} />;
};

export default DeviceDashboard;
