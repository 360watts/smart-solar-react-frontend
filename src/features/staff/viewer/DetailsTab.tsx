import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { apiService, type AlertItem } from '../../../services/api';
import { EmptyState, Notice } from '../../../shared/components/Feedback';
import { at } from './DevicePage';
import SlaveRegisterSection, { type Slave } from './SlaveRegisterSection';
import { ListSkeleton } from './Skeleton';

const mono = { fontFamily: 'Fira Code, monospace' };
const card = 'rounded-[22px] border border-border bg-card p-5';
const SEV: Record<string, string> = { critical: 'var(--destructive, #c8553d)', warning: 'var(--gap, #e8930c)', info: 'var(--info, #3570c8)' };
const dash = (v: unknown) => (v == null || v === '' ? '–' : String(v));

type Coverage = { coverage_pct: number; total_received: number; total_configured: number; last_telemetry_at: string; slaves: Slave[] };

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="m-0 [display:grid] grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-3.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0"><dt className="text-muted-foreground">{k}</dt><dd className="m-0 mt-0.5 break-words font-medium text-foreground">{v}</dd></div>
      ))}
    </dl>
  );
}

function Alerts({ deviceId, serial }: { deviceId: number; serial: string }) {
  const [list, setList] = useState<AlertItem[] | null | 'failed'>(null);
  useEffect(() => {
    let live = true;
    apiService.getAlerts()
      .then(all => { if (live) setList(all.filter(a => a.status !== 'resolved' && !a.resolved && (String(a.device_id) === String(deviceId) || a.device_serial === serial))); })
      .catch(() => { if (live) setList('failed'); });
    return () => { live = false; };
  }, [deviceId, serial]);
  return (
    <section className={card} aria-label="Active alerts">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-lg font-semibold">Active alerts</h3>
        <Link to="/alerts" className="text-sm font-medium text-[var(--brand-green)]">All alerts</Link>
      </div>
      {list === null ? <ListSkeleton rows={2} />
        : list === 'failed' ? <p className="m-0 text-sm text-muted-foreground">Couldn't load the alerts. The device is not affected.</p>
        : list.length === 0 ? <p className="m-0 text-sm text-muted-foreground">No active alerts for this device.</p>
        : <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {list.slice(0, 5).map(a => (
            <li key={a.id} className="flex flex-col gap-1 rounded-2xl bg-muted/50 px-4 py-3 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <b style={{ color: SEV[a.severity] ?? SEV.info }}>{a.severity === 'critical' ? 'Critical' : a.severity === 'warning' ? 'Warning' : 'Info'}</b>
                {a.fault_code && <span className="text-xs text-muted-foreground" style={mono}>{a.fault_code}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{at(a.timestamp)}</span>
              </span>
              <span>{a.message}</span>
            </li>
          ))}
          {list.length > 5 && <li className="text-sm text-muted-foreground">Showing 5 of {list.length}. The rest are in All alerts.</li>}
        </ul>}
    </section>
  );
}

function Config({ d, preset }: { d: any; preset: any }) {
  const state = !d.config_version ? 'No preset assigned' : d.pending_config_update ? 'Waiting for device' : 'Up to date';
  const latest = preset?.version;
  return (
    <section className={card} aria-label="Settings sent to the device">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-lg font-semibold">Settings sent to the device</h3>
        <span className="text-sm font-medium" style={{ color: d.pending_config_update || !d.config_version ? 'var(--gap, #e8930c)' : 'var(--brand-green)' }}>{state}</span>
      </div>
      {d.config_version ? <Facts rows={[
        ['Preset', preset?.name || d.config_version],
        ['Preset ID', <span style={mono}>{d.config_version}</span>],
        ...(preset?.slaves_count != null ? [['Connected meters and inverters', preset.slaves_count] as [string, React.ReactNode]] : []),
        ['Version on the device', d.config_ack_ver != null ? <span style={mono}>v{d.config_ack_ver}{latest != null && latest !== d.config_ack_ver ? `, latest is v${latest}` : ''}</span> : '–'],
        ['Last confirmed by the device', d.config_acked_at ? at(d.config_acked_at) : '–'],
        ...(d.config_downloaded_at && d.config_acked_at ? [['Time to apply', `${Math.round((Date.parse(d.config_acked_at) - Date.parse(d.config_downloaded_at)) / 1000)} s`] as [string, React.ReactNode]] : []),
      ]} /> : <p className="m-0 text-sm text-muted-foreground">Pick a preset when you edit the device.</p>}
    </section>
  );
}

function Coverage({ deviceId }: { deviceId: number }) {
  const [open, setOpen] = useState(false);
  const [cov, setCov] = useState<Coverage | null | 'failed'>(null);
  useEffect(() => {
    if (!open || cov) return;
    apiService.getRegisterCoverage(deviceId).then(setCov).catch(() => setCov('failed'));
  }, [open, cov, deviceId]);
  const c = cov && cov !== 'failed' ? cov : null;
  return (
    <section className="overflow-hidden rounded-[22px] border border-border bg-card" aria-label="Register coverage">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-3 border-0 bg-transparent px-5 py-4 text-left text-foreground">
        <span className="text-lg font-semibold">Register coverage</span>
        <span className="text-sm text-muted-foreground">{c ? `${c.coverage_pct}%, ${c.total_received} / ${c.total_configured} registers` : open ? '' : 'Show'}</span>
      </button>
      {open && (cov === null ? <div className="px-5 pb-5"><ListSkeleton rows={3} /></div>
        : !c ? <EmptyState icon={Activity} title="No telemetry yet" description="Readings show here within a minute of the device connecting." />
        : <>
          <div className="px-5 pb-3" aria-hidden="true"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full" style={{ width: `${c.coverage_pct}%`, background: c.coverage_pct >= 80 ? 'var(--brand-green)' : 'var(--gap, #e8930c)' }} /></div></div>
          <p className="m-0 px-5 pb-3 text-sm text-muted-foreground">Missing {c.total_configured - c.total_received}. Last sample {at(c.last_telemetry_at)}.</p>
          {c.slaves.map(s => <SlaveRegisterSection key={s.slave_id} slave={s} />)}
        </>)}
    </section>
  );
}

/** Staff-only: everything the old in-page device view showed that the other tabs don't. */
export default function DetailsTab({ deviceId, serial, meter, siteId }: { deviceId: number; serial: string; meter: boolean; siteId: string | null }) {
  const [d, setD] = useState<any | null | 'failed'>(null);
  const [preset, setPreset] = useState<any>(null);
  useEffect(() => {
    let live = true;
    apiService.getDevice(deviceId).then(r => {
      if (!live) return;
      setD(r);
      if (r.config_version) apiService.getPresetFresh(r.config_version)
        .then(p => { const l = Array.isArray(p) ? p : p?.results ?? []; if (live) setPreset(l.find((x: any) => x.config_id === r.config_version) ?? null); })
        .catch(() => {});
    }).catch(() => { if (live) setD('failed'); });
    return () => { live = false; };
  }, [deviceId]);

  if (d === null) return <ListSkeleton rows={6} />;
  if (d === 'failed') return <EmptyState title="Couldn't load the device details" description="The server didn't answer. The device is not affected." />;
  const seen = d.last_seen_at || d.last_heartbeat;
  const health = d.heartbeat_health?.severity || (d.is_online ? 'ok' : 'critical');
  return (
    <>
      <Alerts deviceId={deviceId} serial={serial} />
      <section className={card} aria-label="About this device">
        <h3 className="m-0 mb-3 text-lg font-semibold">About this device</h3>
        <Facts rows={[
          ['Status', d.is_active === false ? 'Inactive' : d.is_online ? 'Online' : 'Offline'],
          ['Last heard from', seen ? at(seen) : 'Never'],
          ['Site', siteId ? <Link to={`/sites/${encodeURIComponent(siteId)}`} className="text-[var(--brand-green)]">{siteId}</Link> : 'Not at a site'],
          ['Hardware ID', <span style={mono}>{dash(d.hw_id)}</span>],
          ['Model', dash(d.model)],
          ['Assigned to', dash(d.user)],
          ['Connection', dash(d.connectivity_type)],
          ['Network address', <span style={mono}>{dash(d.network_ip)}</span>],
          ['Signal', d.signal_strength_dbm != null ? `${d.signal_strength_dbm} dBm` : '–'],
          ['Temperature', d.device_temp_c != null ? `${Number(d.device_temp_c).toFixed(1)} °C` : '–'],
          ['Free memory', d.memory_status?.free_heap != null ? `${d.memory_status.free_heap} bytes` : '–'],
          ['Connection health', `${health === 'ok' ? 'Good' : health === 'warn' ? 'Needs a look' : 'Poor'}${d.heartbeat_health?.issues?.length ? `: ${d.heartbeat_health.issues.join(', ')}` : ''}`],
          ['Set up on', d.provisioned_at ? at(d.provisioned_at) : '–'],
          ['Added by', dash(d.created_by_username)],
        ]} />
      </section>
      <Config d={d} preset={preset} />
      {!meter && <Coverage deviceId={deviceId} />}
      <Notice more="Auto restart and Send logs are in Operations, Settings.">Switches for this device live in Operations.</Notice>
    </>
  );
}
