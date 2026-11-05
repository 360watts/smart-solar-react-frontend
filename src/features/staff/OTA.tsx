// Firmware updates (staff, /ota). Filter-first: a filter rail with live counts, sortable tables of devices and builds,
// and any build can go to any devices of its type — newer, older or the same. Design: mockup C (2026-11-04).
// Scenarios: docs/test-scenarios/ota-page.md; backend mapping: smart-solar-django-backend/docs/test-scenarios/ota-page-mapping.md
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useAccess } from '../../shared/access/useAccess';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { Input } from '../../shared/ui/input';
import { Switch } from '../../shared/ui/switch';
import PageHeader from '../../shared/layout/PageHeader';
import MobileOTA from '../mobile/staff/MobileOTA';
import { ConfirmDialog } from './siteHardware/ui';
import { type Build, type DevState, type OtaDevice, STATE_LABEL, compareVersions, direction, fits, runningCount, toBuild, toDevice } from './ota/otaModel';
import { DirTag, RollbackDialog, SendBuildDialog, SendToDevicesDialog, TYPE_LABEL, UploadDialog, ago, mb } from './ota/OtaDialogs';

export function OTA() {
  return useIsMobile() ? <MobileOTA /> : <OtaDesktop />;
}

/* ---------- filters ---------- */
type Checkin = 'any' | '1h' | '24h' | 'old' | 'never';
interface DevFilter { type: string; states: string[]; versions: string[]; chips: string[]; checkin: Checkin; site: string }
interface BuildFilter { type: string; on: string; chips: string[]; use: string }
const NO_DEV: DevFilter = { type: 'all', states: [], versions: [], chips: [], checkin: 'any', site: 'any' };
const NO_BUILD: BuildFilter = { type: 'all', on: 'any', chips: [], use: 'any' };
const NOT_REPORTED = '';
const HOUR = 3600e3;
const PAGE_SIZE = { devices: 25, builds: 10 }; // builds tab shows 1-10 by default

const checkinOk = (iso: string | null, c: Checkin) => {
  if (c === 'any') return true;
  if (!iso) return c === 'never';
  const age = Date.now() - new Date(iso).getTime();
  return c === '1h' ? age < HOUR : c === '24h' ? age < 24 * HOUR : c === 'old' ? age >= 24 * HOUR : false;
};
const CHECKIN_LABEL: Record<Checkin, string> = { any: 'Any time', '1h': 'Last hour', '24h': 'Last 24 h', old: 'Over 1 day ago', never: 'Never' };

type Preds<T> = Record<string, (x: T) => boolean>;
const devPreds = (f: DevFilter, q: string): Preds<OtaDevice> => ({
  type: d => f.type === 'all' || d.type === f.type,
  states: d => !f.states.length || f.states.includes(d.state),
  versions: d => !f.versions.length || f.versions.includes(d.run ?? NOT_REPORTED),
  chips: d => !f.chips.length || f.chips.includes(d.chip ?? NOT_REPORTED),
  checkin: d => checkinOk(d.checkedAt, f.checkin),
  site: d => f.site === 'any' || (f.site === 'on') === !!d.site,
  q: d => !q || d.serial.toLowerCase().includes(q) || (d.site ?? '').toLowerCase().includes(q),
});
const buildPreds = (f: BuildFilter, q: string, devices: OtaDevice[]): Preds<Build> => ({
  type: b => f.type === 'all' || b.type === f.type,
  on: b => f.on === 'any' || (f.on === 'on') === b.on,
  chips: b => !f.chips.length || f.chips.includes(b.chip ?? NOT_REPORTED),
  use: b => f.use === 'any' || (f.use === 'running') === runningCount(b, devices) > 0,
  q: b => !q || b.version.toLowerCase().includes(q) || b.notes.toLowerCase().includes(q),
});
/** Passes every filter except `skip`: facet counts show what picking that option would leave. */
const passes = <T,>(p: Preds<T>, x: T, skip?: string) => Object.entries(p).every(([k, fn]) => k === skip || fn(x));
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

/* ---------- sorting ---------- */
type Sort = { key: string; asc: boolean };
const cmp = (a: unknown, b: unknown) =>
  a == null ? (b == null ? 0 : -1) : b == null ? 1 : typeof a === 'number' ? a - (b as number) : String(a).localeCompare(String(b), undefined, { numeric: true });
const STATE_ORDER: DevState[] = ['fail', 'rollback', 'download', 'wait', 'none', 'ok'];
const DEV_SORT: Record<string, (a: OtaDevice, b: OtaDevice) => number> = {
  serial: (a, b) => cmp(a.serial, b.serial),
  site: (a, b) => cmp(a.site, b.site),
  run: (a, b) => compareVersions(a.run, b.run),
  state: (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
  checkedAt: (a, b) => cmp(a.checkedAt && Date.parse(a.checkedAt), b.checkedAt && Date.parse(b.checkedAt)),
};
const buildSort = (devices: OtaDevice[]): Record<string, (a: Build, b: Build) => number> => ({
  version: (a, b) => compareVersions(a.version, b.version),
  type: (a, b) => cmp(a.type, b.type),
  chip: (a, b) => cmp(a.chip, b.chip),
  size: (a, b) => a.size - b.size,
  uploadedAt: (a, b) => cmp(Date.parse(a.uploadedAt), Date.parse(b.uploadedAt)),
  running: (a, b) => runningCount(a, devices) - runningCount(b, devices),
  on: (a, b) => Number(a.on) - Number(b.on),
});

/* ---------- small pieces ---------- */
const STATE_STYLE: Record<DevState, string> = {
  ok: 'bg-primary/10 text-primary',
  wait: 'bg-muted text-foreground',
  download: 'bg-primary/10 text-primary',
  fail: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  rollback: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  none: 'bg-muted text-muted-foreground',
};

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <fieldset className="m-0 [display:grid] gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-[3px]">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1 text-sm ${value === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{l}</button>
        ))}
      </div>
    </fieldset>
  );
}

function Checks({ label, options, picked, onToggle }: { label: string; options: { v: string; label: string; n: number }[]; picked: string[]; onToggle: (v: string) => void }) {
  if (!options.length) return null;
  return (
    <fieldset className="m-0 [display:grid] gap-1 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm font-medium">{label}</legend>
      {options.map(o => (
        <label key={o.v} className={`flex cursor-pointer items-center gap-2 text-sm ${o.n === 0 && !picked.includes(o.v) ? 'opacity-45' : ''}`}>
          <input type="checkbox" className="size-4 accent-primary" checked={picked.includes(o.v)} onChange={() => onToggle(o.v)} />
          <span className="min-w-0 flex-1 truncate">{o.label}</span>
          <span className="font-mono text-xs text-muted-foreground">{o.n}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Th({ k, sort, setSort, children, className = '' }: { k: string; sort: Sort; setSort: (s: Sort) => void; children: React.ReactNode; className?: string }) {
  const on = sort.key === k;
  return (
    <th aria-sort={on ? (sort.asc ? 'ascending' : 'descending') : 'none'} className={`px-2 py-2 lg:px-3 text-left font-medium ${className}`}>
      <button type="button" onClick={() => setSort({ key: k, asc: on ? !sort.asc : false })}
        className={`inline-flex items-center gap-1 text-sm ${on ? 'text-foreground' : 'text-muted-foreground'}`}>
        {children}<span aria-hidden className="text-xs">{on ? (sort.asc ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-sm text-primary">
      {children}
      <button type="button" aria-label="Remove filter" onClick={onRemove} className="rounded-full px-1.5 hover:bg-primary/15">×</button>
    </span>
  );
}

type Confirm = { title: string; body: React.ReactNode; label: string; tone: 'danger' | 'primary'; run: () => Promise<unknown> };

/* ---------- page ---------- */
function OtaDesktop() {
  const { isDark } = useTheme();
  const canOps = useAccess().can('device_control');
  const [builds, setBuilds] = useState<Build[]>([]);
  const [devices, setDevices] = useState<OtaDevice[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'devices' | 'builds'>('devices');
  const [df, setDf] = useState<DevFilter>(NO_DEV);
  const [bf, setBf] = useState<BuildFilter>(NO_BUILD);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(false);
  const [devSort, setDevSort] = useState<Sort>({ key: 'state', asc: true });
  const [bSort, setBSort] = useState<Sort>({ key: 'version', asc: false });
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | { kind: 'send' | 'rollback' | 'upload' } | { kind: 'build'; build: Build }>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [railOpen, setRailOpen] = useState(false); // below xl the rail folds behind a Filters button

  const load = useCallback(async () => {
    try {
      const fw = await apiService.getFirmwareVersions(false);
      const b: Build[] = (Array.isArray(fw) ? fw : fw?.results ?? []).map(toBuild);
      const rows = await apiService.getOTADevices();
      setBuilds(b);
      setDevices((rows ?? []).map(r => toDevice(r, b)));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error && e.message ? e.message : 'Could not load firmware updates.');
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const query = q.trim().toLowerCase();
  const dp = useMemo(() => devPreds(df, query), [df, query]);
  const bp = useMemo(() => buildPreds(bf, query, devices), [bf, query, devices]);
  const devRows = useMemo(() => {
    const s = DEV_SORT[devSort.key];
    return devices.filter(d => passes(dp, d)).sort((a, b) => (devSort.asc ? 1 : -1) * s(a, b) || a.serial.localeCompare(b.serial));
  }, [devices, dp, devSort]);
  const buildRows = useMemo(() => {
    const s = buildSort(devices)[bSort.key];
    return builds.filter(b => passes(bp, b)).sort((a, b) => (bSort.asc ? 1 : -1) * s(a, b));
  }, [builds, bp, bSort, devices]);
  useEffect(() => { setPage(1); }, [tab, df, bf, query, devSort, bSort, group]);
  const total = tab === 'devices' ? devRows.length : buildRows.length;
  const size = PAGE_SIZE[tab];
  const pages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, pages); // the 20 s poll can shrink the list under the current page
  const from = (safePage - 1) * size;
  const pageDevs = devRows.slice(from, from + size);
  const pageBuilds = buildRows.slice(from, from + size);

  const facet = <T,>(rows: T[], p: Preds<T>, key: string, values: string[], get: (x: T) => string, label = (v: string) => v) =>
    values.map(v => ({ v, label: label(v), n: rows.filter(x => passes(p, x, key) && get(x) === v).length }));
  const uniq = (xs: string[]) => [...new Set(xs)];
  const versionsSeen = uniq(devices.map(d => d.run ?? NOT_REPORTED)).sort((a, b) => compareVersions(b || null, a || null));
  const devChips = uniq(devices.map(d => d.chip ?? NOT_REPORTED)).sort();
  const buildChips = uniq(builds.map(b => b.chip ?? NOT_REPORTED)).sort();
  const unknown = (v: string) => v || 'Not reported';

  const chosen = devices.filter(d => ticked.has(d.serial));
  const mixedTypes = new Set(chosen.map(d => d.type)).size > 1;
  const withTarget = chosen.filter(d => d.target || d.state === 'rollback');
  const gatewaysChosen = chosen.filter(d => d.type === 'gateway');
  const done = () => { setDialog(null); setTicked(new Set()); load(); };

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    try { await confirm.run(); } catch (e) { toast.error(e instanceof Error && e.message ? e.message : 'That did not work. Try again.'); }
    setBusy(false);
    setConfirm(null);
    load();
  }

  function askStop() {
    setConfirm({
      title: `Stop updates on ${withTarget.length} device${withTarget.length === 1 ? '' : 's'}?`,
      body: 'Their planned update is removed. A device that has already been told about the build may still install it at its next check-in.',
      label: 'Stop updates', tone: 'danger',
      run: async () => {
        const res = await apiService.stopDeviceUpdates(withTarget.map(d => d.serial));
        toast.success(`Stopped ${res.stopped.length} update${res.stopped.length === 1 ? '' : 's'}.`);
        setTicked(new Set());
      },
    });
  }
  async function retry(d: OtaDevice) {
    try { await apiService.retryDeviceUpdate(d.serial); toast.success(`${d.serial} will try again at its next check-in.`); load(); }
    catch (e) { toast.error(e instanceof Error && e.message ? e.message : 'Could not reset the failed attempt.'); }
  }
  async function switchBuild(b: Build, on: boolean) {
    const run = async () => {
      await apiService.updateFirmwareVersion(b.id, { is_active: on });
      toast.success(on ? `${b.version} is on.` : `${b.version} is off. Devices already sent it keep their update.`);
    };
    if (!on) { try { await run(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not switch it off.'); } load(); return; }
    const idle = devices.filter(d => fits(b, d) && !d.target);
    const up = idle.filter(d => direction(d.run, b.version) === 'up').length;
    const down = idle.filter(d => direction(d.run, b.version) === 'down').length;
    setConfirm({
      title: `Switch ${b.version} on?`,
      body: (
        <div className="[display:grid] gap-2">
          <span>Every {TYPE_LABEL[b.type ?? '']?.toLowerCase() ?? 'device'} that fits and has no update planned gets it at its next check-in: {up} would move up{down ? `, ${down} would go back to an older version` : ''}.</span>
          {down > 0 && <span className="rounded-xl bg-amber-500/15 px-2 py-2 lg:px-3">Some devices would be downgraded. To choose who gets it, use Send to devices instead.</span>}
        </div>
      ),
      label: 'Switch on', tone: 'primary', run,
    });
  }
  function askDelete(b: Build) {
    setConfirm({
      title: `Delete build ${b.version}?`,
      body: 'The file is removed for good. Devices already running it are not affected.',
      label: 'Delete', tone: 'danger',
      run: async () => { await apiService.deleteFirmwareVersion(b.id); toast.success(`Deleted ${b.version}.`); },
    });
  }

  /* active chips + quick filters */
  const devChipsActive: { key: string; label: string; clear: () => void }[] = [
    ...(df.type !== 'all' ? [{ key: 'type', label: TYPE_LABEL[df.type] + 's', clear: () => setDf({ ...df, type: 'all' }) }] : []),
    ...df.states.map(s => ({ key: `s${s}`, label: STATE_LABEL[s as DevState], clear: () => setDf({ ...df, states: toggle(df.states, s) }) })),
    ...df.versions.map(v => ({ key: `v${v}`, label: `Running ${unknown(v)}`, clear: () => setDf({ ...df, versions: toggle(df.versions, v) }) })),
    ...df.chips.map(c => ({ key: `c${c}`, label: `Chip ${unknown(c)}`, clear: () => setDf({ ...df, chips: toggle(df.chips, c) }) })),
    ...(df.checkin !== 'any' ? [{ key: 'ci', label: `Last check: ${CHECKIN_LABEL[df.checkin]}`, clear: () => setDf({ ...df, checkin: 'any' }) }] : []),
    ...(df.site !== 'any' ? [{ key: 'site', label: df.site === 'on' ? 'On a site' : 'No site', clear: () => setDf({ ...df, site: 'any' }) }] : []),
  ];
  const buildChipsActive: { key: string; label: string; clear: () => void }[] = [
    ...(bf.type !== 'all' ? [{ key: 'type', label: `For ${TYPE_LABEL[bf.type].toLowerCase()}s`, clear: () => setBf({ ...bf, type: 'all' }) }] : []),
    ...(bf.on !== 'any' ? [{ key: 'on', label: bf.on === 'on' ? 'Switched on' : 'Switched off', clear: () => setBf({ ...bf, on: 'any' }) }] : []),
    ...bf.chips.map(c => ({ key: `c${c}`, label: `Chip ${unknown(c)}`, clear: () => setBf({ ...bf, chips: toggle(bf.chips, c) }) })),
    ...(bf.use !== 'any' ? [{ key: 'use', label: bf.use === 'running' ? 'Running somewhere' : 'Unused', clear: () => setBf({ ...bf, use: 'any' }) }] : []),
  ];
  const active = tab === 'devices' ? devChipsActive : buildChipsActive;
  const quick: { label: string; apply: () => void; n: number }[] = tab === 'devices' ? [
    { label: 'Failed', apply: () => setDf({ ...NO_DEV, states: ['fail'] }), n: devices.filter(d => d.state === 'fail').length },
    { label: 'Waiting over a day', apply: () => setDf({ ...NO_DEV, states: ['wait'], checkin: 'old' }), n: devices.filter(d => d.state === 'wait' && checkinOk(d.checkedAt, 'old')).length },
    { label: 'Downloading', apply: () => setDf({ ...NO_DEV, states: ['download'] }), n: devices.filter(d => d.state === 'download').length },
    { label: 'Never checked for an update', apply: () => setDf({ ...NO_DEV, checkin: 'never' }), n: devices.filter(d => !d.checkedAt).length },
  ] : [
    { label: 'Switched on', apply: () => setBf({ ...NO_BUILD, on: 'on' }), n: builds.filter(b => b.on).length },
    { label: 'Unused', apply: () => setBf({ ...NO_BUILD, use: 'unused' }), n: builds.filter(b => runningCount(b, devices) === 0).length },
  ];

  const groups = useMemo(() => {
    if (!group) return [{ key: '', rows: pageDevs }];
    const m = new Map<string, OtaDevice[]>();
    pageDevs.forEach(d => { const k = d.run ?? NOT_REPORTED; m.set(k, [...(m.get(k) ?? []), d]); });
    return [...m.entries()].sort(([a], [b]) => compareVersions(b || null, a || null)).map(([key, rows]) => ({ key, rows }));
  }, [group, pageDevs]);

  const allShownTicked = devRows.length > 0 && devRows.every(d => ticked.has(d.serial));
  const tickAll = () => setTicked(s => {
    const n = new Set(s);
    devRows.forEach(d => (allShownTicked ? n.delete(d.serial) : n.add(d.serial)));
    return n;
  });

  return (
    <div className="pb-28">
      <PageHeader title="Firmware updates" subtitle="Filter and sort devices and builds. Send any build to any devices of its type: newer, older or the same."
        rightSlot={canOps && <button type="button" className="ui-btn ui-btn--main" onClick={() => setDialog({ kind: 'upload' })}>Upload build</button>} />

      <div role="tablist" className="mb-4 inline-flex rounded-full bg-muted p-[3px]">
        {([['devices', 'Devices', devices.length], ['builds', 'Builds', builds.length]] as const).map(([k, l, n]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); setQ(''); }}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {l} <span className="font-mono text-xs">{n}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-500/15 px-4 py-3 text-sm">
          <span className="flex-1">{loadError}</span>
          <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={load}>Try again</button>
        </div>
      )}

      <div className="[display:grid] grid-cols-1 items-start gap-4">
        {/* filter bar, above the table */}
        <aside id="ota-filters" aria-label="Filters" className={`${railOpen ? '[display:grid]' : 'hidden'} items-start gap-5 rounded-[22px] border border-border bg-card p-4 sm:grid-cols-2 xl:[display:grid] xl:grid-cols-1`}>
          {tab === 'devices' ? (<>
            <div className="contents xl:flex xl:flex-wrap xl:items-start xl:gap-x-8 xl:gap-y-4">
            <Segmented label="Type" value={df.type} onChange={v => setDf({ ...df, type: v })}
              options={[['all', 'All'], ['gateway', 'Gateways'], ['energy_meter', 'Meters']]} />
            <label className="[display:grid] gap-1.5 text-sm font-medium">Last update check
              <select value={df.checkin} onChange={e => setDf({ ...df, checkin: e.target.value as Checkin })}
                className="h-9 rounded-md border border-border bg-input-background px-2 font-normal xl:w-44">
                {(Object.keys(CHECKIN_LABEL) as Checkin[]).map(c => <option key={c} value={c}>{CHECKIN_LABEL[c]}</option>)}
              </select>
            </label>
            <Segmented label="Site" value={df.site} onChange={v => setDf({ ...df, site: v })}
              options={[['any', 'Any'], ['on', 'On a site'], ['none', 'No site']]} />
            </div>
            <div className="contents xl:[display:grid] xl:grid-cols-3 xl:gap-8 xl:border-t xl:border-border xl:pt-4">
            <Checks label="Update state" picked={df.states} onToggle={v => setDf({ ...df, states: toggle(df.states, v) })}
              options={facet(devices, dp, 'states', STATE_ORDER, d => d.state, v => STATE_LABEL[v as DevState])} />
            <Checks label="Running version" picked={df.versions} onToggle={v => setDf({ ...df, versions: toggle(df.versions, v) })}
              options={facet(devices, dp, 'versions', versionsSeen, d => d.run ?? NOT_REPORTED, unknown)} />
            <Checks label="Chip" picked={df.chips} onToggle={v => setDf({ ...df, chips: toggle(df.chips, v) })}
              options={facet(devices, dp, 'chips', devChips, d => d.chip ?? NOT_REPORTED, unknown)} />
            </div>
          </>) : (<>
            <div className="contents xl:flex xl:flex-wrap xl:items-start xl:gap-x-8 xl:gap-y-4">
            <Segmented label="For" value={bf.type} onChange={v => setBf({ ...bf, type: v })}
              options={[['all', 'All'], ['gateway', 'Gateways'], ['energymeter', 'Meters']]} />
            <Segmented label="Switched on" value={bf.on} onChange={v => setBf({ ...bf, on: v })}
              options={[['any', 'Any'], ['on', 'On'], ['off', 'Off']]} />
            <Segmented label="In use" value={bf.use} onChange={v => setBf({ ...bf, use: v })}
              options={[['any', 'Any'], ['running', 'Running'], ['unused', 'Unused']]} />
            </div>
            <div className="contents xl:[display:grid] xl:grid-cols-3 xl:gap-8 xl:border-t xl:border-border xl:pt-4">
            <Checks label="Chip" picked={bf.chips} onToggle={v => setBf({ ...bf, chips: toggle(bf.chips, v) })}
              options={facet(builds, bp, 'chips', buildChips, b => b.chip ?? NOT_REPORTED, unknown)} />
            </div>
          </>)}
        </aside>

        {/* main card */}
        <section className="min-w-0 rounded-[22px] border border-border bg-card">
          <div className="[display:grid] gap-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* wrapper: legacy .ui-btn sets display, which beats xl:hidden on the button itself */}
              <span className="xl:hidden">
                <button type="button" className="ui-btn ui-btn--support ui-btn--sm" aria-expanded={railOpen} aria-controls="ota-filters"
                  onClick={() => setRailOpen(o => !o)}>
                  {railOpen ? 'Hide filters' : 'Filters'}{active.length > 0 && <span className="ml-1 font-mono">{active.length}</span>}
                </button>
              </span>
              <Input value={q} onChange={e => setQ(e.target.value)} aria-label="Search"
                placeholder={tab === 'devices' ? 'Search serial or site' : 'Search version or notes'} className="max-w-xs" />
              {tab === 'devices' && (
                <label className="flex items-center gap-2 text-sm"><Switch checked={group} onCheckedChange={setGroup} /> Group by version</label>
              )}
              <span className="ml-auto font-mono text-sm text-muted-foreground">
                {tab === 'devices' ? `${devRows.length} of ${devices.length}` : `${buildRows.length} of ${builds.length}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {active.length ? (<>
                {active.map(c => <Chip key={c.key} onRemove={c.clear}>{c.label}</Chip>)}
                <button type="button" className="ui-btn ui-btn--link ui-btn--sm" onClick={() => (tab === 'devices' ? setDf(NO_DEV) : setBf(NO_BUILD))}>Clear all</button>
              </>) : (<>
                <span className="text-sm text-muted-foreground">Quick filters:</span>
                {quick.map(f => (
                  <button key={f.label} type="button" disabled={!f.n} onClick={f.apply}
                    className="rounded-full border border-border px-2.5 py-0.5 text-sm hover:border-primary disabled:opacity-45">
                    {f.label} <span className="font-mono text-xs text-muted-foreground">{f.n}</span>
                  </button>
                ))}
              </>)}
            </div>
          </div>

          <div className="overflow-x-auto">
            {!loaded ? <p className="m-0 p-6 text-sm text-muted-foreground">Loading…</p>
            : tab === 'devices' ? (
              devRows.length === 0 ? <p className="m-0 p-6 text-sm text-muted-foreground">{devices.length ? 'No devices match these filters.' : 'No devices yet.'}</p> : (
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {canOps && <th className="w-10 px-2 py-2 lg:px-3"><input type="checkbox" aria-label={`Tick all ${devRows.length} matching`} title="Ticks every matching device, on every page" className="size-4 accent-primary" checked={allShownTicked} onChange={tickAll} /></th>}
                    <Th k="serial" sort={devSort} setSort={setDevSort}>Device</Th>
                    <Th k="site" sort={devSort} setSort={setDevSort}>Site</Th>
                    <Th k="run" sort={devSort} setSort={setDevSort}>Version</Th>
                    <Th k="state" sort={devSort} setSort={setDevSort}>State</Th>
                    <Th k="checkedAt" sort={devSort} setSort={setDevSort} className="whitespace-nowrap">Last check</Th>
                  </tr>
                </thead>
                {groups.map(g => (
                  <tbody key={g.key || '-'}>
                    {group && (
                      <tr className="bg-muted/50"><td colSpan={canOps ? 6 : 5} className="px-3 py-1.5 text-sm font-medium">
                        <span className="font-mono">{unknown(g.key)}</span> <span className="text-muted-foreground">· {g.rows.length}</span>
                      </td></tr>
                    )}
                    {g.rows.map(d => (
                      <tr key={d.serial} className={`border-b border-border last:border-0 ${ticked.has(d.serial) ? 'bg-primary/5' : ''}`}>
                        {canOps && <td className="px-2 py-2 lg:px-3"><input type="checkbox" aria-label={`Tick ${d.serial}`} className="size-4 accent-primary" checked={ticked.has(d.serial)}
                          onChange={() => setTicked(s => { const n = new Set(s); if (n.has(d.serial)) n.delete(d.serial); else n.add(d.serial); return n; })} /></td>}
                        <td className="px-2 py-2 lg:px-3">
                          <div className="whitespace-nowrap font-mono">{d.serial}</div>
                          <div className="text-xs text-muted-foreground">{TYPE_LABEL[d.type] ?? d.type} · {d.chip ?? 'chip unknown'}</div>
                        </td>
                        <td className="px-2 py-2 lg:px-3">{d.site ?? <span className="text-muted-foreground">No site</span>}</td>
                        <td className="whitespace-nowrap px-2 py-2 lg:px-3 font-mono">
                          {d.run ?? <span className="text-muted-foreground">?</span>}
                          {d.target && <div className="text-xs">→ {d.target}<DirTag from={d.run} to={d.target} /></div>}
                        </td>
                        <td className="min-w-[150px] px-2 py-2 lg:px-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLE[d.state]}`}>
                            {STATE_LABEL[d.state]}{d.pct != null && ` ${d.pct}%`}
                          </span>
                          {d.error && (
                            <div className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                              <div className="truncate" title={d.error}>{d.error}</div>
                              {canOps && <button type="button" className="text-primary underline" onClick={() => retry(d)}>Try again</button>}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 lg:px-3 text-muted-foreground" title={d.checkedAt ? `Last asked for an update ${d.checkedAt}` : 'Never asked for an update'}>{ago(d.checkedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>)
            ) : (
              buildRows.length === 0 ? <p className="m-0 p-6 text-sm text-muted-foreground">{builds.length ? 'No builds match these filters.' : 'No builds uploaded yet.'}</p> : (
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <Th k="version" sort={bSort} setSort={setBSort}>Version</Th>
                    <Th k="type" sort={bSort} setSort={setBSort}>For</Th>
                    <Th k="size" sort={bSort} setSort={setBSort} className="hidden xl:table-cell">Size</Th>
                    <Th k="uploadedAt" sort={bSort} setSort={setBSort}>Uploaded</Th>
                    <Th k="running" sort={bSort} setSort={setBSort}>Running on</Th>
                    <Th k="on" sort={bSort} setSort={setBSort}>On</Th>
                    {canOps && <th className="px-2 py-2 lg:px-3" />}
                  </tr>
                </thead>
                <tbody>
                  {pageBuilds.map(b => (
                    <tr key={b.id} className="border-b border-border last:border-0">
                      <td className="max-w-[280px] px-2 py-2 lg:px-3">
                        <div className="font-mono font-medium">{b.version}</div>
                        <div className="truncate text-xs text-muted-foreground" title={b.notes}>{b.notes || 'No notes'}</div>
                      </td>
                      <td className="px-2 py-2 lg:px-3">
                        <div className="whitespace-nowrap">{b.type ? `${TYPE_LABEL[b.type]}s` : 'Any'}</div>
                        <div className="font-mono text-xs text-muted-foreground">{b.chip ?? 'chip unknown'}</div>
                      </td>
                      <td className="hidden px-2 py-2 lg:px-3 font-mono xl:table-cell">{mb(b.size)}</td>
                      <td className="px-2 py-2 lg:px-3 text-muted-foreground" title={b.uploadedAt}>{ago(b.uploadedAt)}</td>
                      <td className="px-2 py-2 lg:px-3 font-mono">{runningCount(b, devices)}</td>
                      <td className="px-2 py-2 lg:px-3">
                        <Switch checked={b.on} disabled={!canOps} aria-label={`Switch ${b.version} ${b.on ? 'off' : 'on'}`} onCheckedChange={v => switchBuild(b, v)} />
                      </td>
                      {canOps && (
                        <td className="px-2 py-2 lg:px-3">
                          <div className="flex flex-wrap justify-end gap-1">
                          <button type="button" className="ui-btn ui-btn--support ui-btn--sm whitespace-nowrap" onClick={() => setDialog({ kind: 'build', build: b })}>Send to devices…</button>
                          <button type="button" className="ui-btn ui-btn--link ui-btn--sm" disabled={b.on}
                            title={b.on ? 'Switch it off before deleting' : undefined} onClick={() => askDelete(b)}>Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>)
            )}
          </div>
          {loaded && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <span className="font-mono text-sm text-muted-foreground">
                Showing {from + 1} to {Math.min(from + size, total)} of {total}
              </span>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">Page {safePage} of {pages}</span>
                  <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</button>
                  <button type="button" className="ui-btn ui-btn--support ui-btn--sm" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>Next</button>
                </div>
              )}
            </div>
          )}
          {tab === 'builds' && (
            <p className="m-0 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              On: every device of that type and chip with no update planned gets the build at its next check-in, whatever version it runs. Leave builds off and use Send to devices to choose who gets what.
            </p>
          )}
        </section>
      </div>

      {/* ticked-device dock */}
      {canOps && tab === 'devices' && chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-border bg-card px-4 py-3 shadow-lg">
            <span className="font-medium"><span className="font-mono">{chosen.length}</span> ticked</span>
            {mixedTypes && <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-sm">Gateways and meters mixed</span>}
            <button type="button" className="ui-btn ui-btn--link ui-btn--sm" onClick={() => setTicked(new Set())}>Clear</button>
            {withTarget.length > 0 && <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={askStop}>Stop their updates</button>}
            {gatewaysChosen.length > 0 && <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={() => setDialog({ kind: 'rollback' })}>Roll back</button>}
            <button type="button" className="ui-btn ui-btn--main ui-btn--sm" onClick={() => setDialog({ kind: 'send' })}>Send a build…</button>
          </div>
        </div>
      )}

      {dialog?.kind === 'send' && <SendToDevicesDialog devices={chosen} builds={builds} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'rollback' && <RollbackDialog devices={chosen} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'upload' && <UploadDialog builds={builds} onClose={() => setDialog(null)} onDone={() => { setDialog(null); setTab('builds'); load(); }} />}
      {dialog?.kind === 'build' && <SendBuildDialog build={dialog.build} devices={devices} onClose={() => setDialog(null)} onDone={done} />}
      <ConfirmDialog isDark={isDark} open={!!confirm} title={confirm?.title ?? ''} body={confirm?.body}
        confirmLabel={confirm?.label} cancelLabel="Cancel" tone={confirm?.tone} busy={busy}
        onConfirm={runConfirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}
