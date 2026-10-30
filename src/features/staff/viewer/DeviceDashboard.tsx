import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiService } from '../../../services/api';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAccess } from '../../../shared/access/useAccess';
import { Activity, Lock } from 'lucide-react';
import { useTokens } from '../siteHardware/ui';
import { EmptyState, Notice } from '../../../shared/components/Feedback';
import { at, devName, type Dev, type Firmware } from './DevicePage';
import OverviewChart from './OverviewChart';
import ReadingsTab from './ReadingsTab';
import OperationsTab from './OperationsTab';
import AllValuesTab from './AllValuesTab';
import BackButton from './BackButton';
import { ALLOWED, DETAIL_LABEL, GATEWAY_READINGS, METER_READINGS, RANGES, fitDetail, type Detail, type Series } from './deviceChart';
import { getFirmware } from './deviceCache';
import { ChartSkeleton, DeviceSkeleton } from './Skeleton';
import './deviceDashboard.css';
import './deviceTabs.css';

type Point = { t: string } & Record<string, number>;
type Dash = Dev & {
  site_id: string | null; last_reading_at: string | null; range_start: string; range_end: string;
  bucket_minutes: number; sampled_every: number; latest: Record<string, number | string | boolean> | null; history: Point[];
};


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

const clock = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

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
        {data ? <div style={{ opacity: fresh ? 1 : 0.6 }}><OverviewChart data={data} reading={reading} /></div> : failed ? <Notice tone="bad" more="Trying again…">Couldn't load the chart.</Notice> : <ChartSkeleton />}
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
  const [dash, setDash] = useState<Dash | null | 'failed'>(null);
  const [firmware, setFirmware] = useState<Firmware[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => apiService.getDeviceDashboard(Number(deviceId), 1)
      .then((d: Dash) => { if (live) setDash(d); }).catch(() => { if (live) setDash(p => (p && p !== 'failed' ? p : 'failed')); });
    load();
    const id = setInterval(load, 60_000);
    return () => { live = false; clearInterval(id); };
  }, [deviceId]);
  useEffect(() => { getFirmware().then(setFirmware); }, []);

  const d = typeof dash === 'object' ? dash : null;
  const sections = useMemo(() => {
    if (!d) return [];
    const keys = new Set([...Object.keys(d.latest ?? {}), ...d.history.flatMap(p => Object.keys(p))]);
    keys.delete('t');
    return groupReadings([...keys], d.device_type === 'energy_meter');
  }, [d]);
  const back = <BackButton to={access.can('my_sites') ? '/my-sites' : '/devices'}>Back</BackButton>;
  if (dash === 'failed') return <div>{back}<EmptyState icon={Lock} title="This device isn't available to you" description="Ask an admin if you need access." /></div>;
  if (!d) return <div>{back}<DeviceSkeleton /></div>;

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

      {!d.last_reading_at && <EmptyState icon={Activity} title="No readings yet" description="Readings show here within a minute of the device connecting." />}
      {stale && d.last_reading_at && <div className="dd-banner">This device stopped sending at {at(d.last_reading_at)}. The charts show the time before that.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="dt-tabs" role="tablist" aria-label="Device sections" onKeyDown={onTabKey}>
          {TABS.map(([k, label]) => (
            <button key={k} id={`dt-tab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="dt-panel" tabIndex={tab === k ? 0 : -1} onClick={() => pick(k)}>
              {label}{k === 'values' && <span className="dt-count">{sections.reduce((n, [, rows]) => n + rows.reduce((m, r) => m + r.keys.length, 0), 0)}</span>}
            </button>
          ))}
        </div>
        <div id="dt-panel" role="tabpanel" aria-labelledby={`dt-tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {tab === 'overview' && <Overview deviceId={Number(deviceId)} meter={d.device_type === 'energy_meter'} latest={d.latest} sel={sel} setSel={setSel} />}
        {tab === 'values' && d.last_reading_at && <AllValuesTab sections={sections} latest={d.latest} history={d.history} lastReadingAt={d.last_reading_at} />}
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
