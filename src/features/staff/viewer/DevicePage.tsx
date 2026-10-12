import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../../services/api';
import { useTokens, StatusChip, Btn, ConfirmDialog, DetailsToggle } from '../siteHardware/ui';
import { useAccess } from '../../../shared/access/useAccess';
import LogsCard from './LogsCard';
import BuildsCard from './BuildsCard';
import { firmwareKind } from '../firmwareImage';
import { getFirmware } from './deviceCache';

/** A gateway-status row. `device_id` is the device pk (device ops + logs); OTA calls take `serial`. */
export type Dev = {
  device_id: number; device_type: string; serial: string; is_online: boolean; last_heartbeat: string | null;
  firmware_version?: string | null; connectivity_type?: string | null; signal_strength_dbm?: number | null;
};
export type Firmware = {
  id: number; version: string; device_type?: string | null; is_active?: boolean; created_at?: string; size?: number;
  release_notes?: string | null; description?: string | null;
};
type OtaLog = {
  id?: number; status: string; bytes_downloaded?: number; error_message?: string | null; firmware_version?: { version: string; size?: number } | null;
  started_at?: string | null; completed_at?: string | null; last_checked_at?: string | null;
};
/** The viewer-visible part of GET /devices/<pk>/ (Wi-Fi name, IP and password are stripped for viewers). */
type Detail = {
  config_version?: string | null; config_ack_ver?: number | null; pending_config_update?: boolean;
  alerts_muted_until?: string | null; logs_enabled?: boolean; auto_reboot_enabled?: boolean;
  /** Last automatic (RS-485 stall) restart; null = none recorded. */
  rs485_reboot_at?: string | null;
  /** Detailed telemetry logging on until this time; null/past = off; year 9999 = until turned off. */
  telemetry_debug_until?: string | null;
  pending_reboot?: boolean; pending_hard_reset?: boolean; pending_rollback?: boolean;
};
type Coverage = {
  total_configured: number; total_received: number; last_telemetry_at?: string | null;
  slaves?: { device_name?: string; registers?: { id: number; label: string; unit?: string | null; received: boolean }[] }[];
};
type Pending = { kind: 'reboot' | 'reset' | 'rollback' } | { kind: 'update'; fw: Firmware } | null;

export const devName = (d: Dev) => `${d.device_type === 'energy_meter' ? 'Meter' : 'Monitor'} ${d.serial}`;
const KIND: Record<string, string> = { gateway: 'Inverter monitor', energy_meter: 'Whole-home meter' };

/** "9 Oct, 02:14 pm" in the viewer's locale clock. */
export const at = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isForever = (iso: string) => new Date(iso).getUTCFullYear() >= 9999;

export function ago(iso: string | null): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'last update just now';
  if (min < 60) return `last update ${min} minute${min === 1 ? '' : 's'} ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `last update ${h} hour${h === 1 ? '' : 's'} ago`;
  return `last update ${Math.round(h / 24)} days ago`;
}

// Same rule as the backend's _normalize_fw_version: "v2.2.1-3P" and "2.2.1" are the same build.
const normVersion = (v?: string | null) => (v ?? '').trim().replace(/^v/i, '').split('-')[0];

/** Register labels like "serial_no_1" read as "Serial no 1"; labels already written for people stay as they are. */
const niceLabel = (l: string) => (/^[a-z0-9_]+$/.test(l) ? l.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : l);

/** True when version `a` is higher than `b` ("1.0.10" > "1.0.9"); a device running a newer build than the list's latest is not offered a downgrade as an update. */
const isNewer = (a: string, b?: string | null) => {
  const pa = normVersion(a).split('.').map(Number), pb = normVersion(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
};
/** One tile grid for every card, so tiles in different cards share column widths. */
const TILES: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 };

const isRunning = (fw: Firmware, dev: Dev) => normVersion(fw.version) === normVersion(dev.firmware_version);

/** Active builds for this device's type, newest first. */
export function buildsFor(firmware: Firmware[] | null, dev: Dev): Firmware[] {
  return (firmware ?? [])
    .filter(f => f.is_active !== false && (!f.device_type || f.device_type === firmwareKind(dev.device_type)))
    .sort((a, b) => (isNewer(a.version, b.version) ? -1 : isNewer(b.version, a.version) ? 1 : (b.created_at ?? '').localeCompare(a.created_at ?? '')));
}

/** The newest active build for this device's type when it differs from what the device runs, else null. */
export function updateFor(firmware: Firmware[] | null, dev: Dev): Firmware | null {
  const latest = buildsFor(firmware, dev)[0];
  return latest && isNewer(latest.version, dev.firmware_version) ? latest : null;
}

const OTA_WORDS: Record<string, string> = {
  pending: 'Waiting to start', available: 'Waiting to start', checking: 'Checking',
  downloading: 'Downloading', completed: 'Installed', failed: "Didn't finish", skipped: 'Skipped',
};

function connection(d: Dev): string {
  const kind = { wifi: 'Wi-Fi', cellular: 'Mobile data', ethernet: 'Wired' }[(d.connectivity_type ?? '').toLowerCase()] ?? d.connectivity_type;
  const dbm = d.signal_strength_dbm;
  const signal = dbm == null ? null : dbm >= -60 ? 'strong signal' : dbm >= -75 ? 'fair signal' : 'weak signal';
  return [kind, signal].filter(Boolean).join(', ') || 'Connection not reported';
}

function progress(log: OtaLog | undefined): string | null {
  if (!log) return null;
  const v = log.firmware_version?.version ?? 'the new version';
  const size = log.firmware_version?.size;
  switch (log.status) {
    case 'downloading': return `Downloading ${v}${size ? ` · ${Math.min(100, Math.round(((log.bytes_downloaded ?? 0) / size) * 100))}%` : ''}`;
    case 'completed': return `Updated to ${v}`;
    case 'failed': return `Update to ${v} didn't finish. Try again, or ask an admin.`;
    case 'pending': case 'available': return `Update to ${v} waits for its next check-in`;
    case 'checking': return 'Checking for an update';
    default: return null;
  }
}

const CONFIRM = {
  reboot: { tone: 'primary' as const, title: 'Restart', body: 'It goes offline for a minute or two, then reconnects. Readings during that time may be missed.', ok: 'Restart', cancel: 'Keep it running' },
  reset: { tone: 'danger' as const, title: 'Hard reset', body: 'This erases its settings and it needs setting up again before it reports. Only do this if an engineer asked you to.', ok: 'Reset it', cancel: 'Keep it' },
  rollback: { tone: 'danger' as const, title: 'Roll back', body: 'It goes back to the firmware it ran before and restarts. Only do this if the latest update caused trouble.', ok: 'Roll back', cancel: 'Keep it' },
  update: { tone: 'danger' as const, title: 'Update', body: "It downloads the new firmware and restarts by itself. Readings pause for a few minutes. Don't unplug it while it updates.", ok: 'Update', cancel: 'Keep it' },
};

function Switch({ isDark, label, hint, checked, onChange }: { isDark: boolean; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  const t = useTokens(isDark);
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 44, padding: '11px 13px', borderRadius: 12,
      border: `1.5px solid ${checked ? t.good : t.line}`, background: checked ? t.goodBg : t.card2, cursor: 'pointer',
    }}>
      <input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ accentColor: t.good, width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
      <span>
        <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 600, color: t.ink }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.84rem', color: t.ink2, marginTop: 2 }}>{hint}</span>
      </span>
    </label>
  );
}

/** One device's page: facts on the left, the control panel (sticky) and the logs on the right/left. Reads always show; every write
 *  is shown only with device control. The backend scopes and enforces every call. */
const DevicePage: React.FC<{ isDark: boolean; dev: Dev; firmware: Firmware[] | null }> = ({ isDark, dev, firmware: firmwareProp }) => {
  const [firmware, setFirmware] = useState(firmwareProp);
  const t = useTokens(isDark);
  const access = useAccess();
  const ctl = access.can('device_control');
  const name = devName(dev);
  const update = updateFor(firmware, dev);
  const builds = buildsFor(firmware, dev);
  const isMeter = dev.device_type === 'energy_meter';

  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [otaLogs, setOtaLogs] = useState<OtaLog[]>([]);
  // Switch, settings and mute states come from GET /devices/<pk>/ (gateway-status does not carry them); undefined = not known.
  const [detail, setDetail] = useState<Detail | undefined>();
  const [autoReboot, setAutoReboot] = useState<boolean | undefined>();
  const [logsOn, setLogsOn] = useState<boolean | undefined>();
  const [mutedUntil, setMutedUntil] = useState<string | null | undefined>();
  const [waiting, setWaiting] = useState<{ reboot: boolean; reset: boolean; rollback: boolean }>({ reboot: false, reset: false, rollback: false });
  const [cov, setCov] = useState<Coverage | null>(null);
  const [covFailed, setCovFailed] = useState(false);
  const [openPanel, setOpenPanel] = useState<Record<string, boolean>>({});

  const loadProgress = useCallback(() => {
    apiService.getDeviceUpdateLogs(dev.serial).then(r => setOtaLogs(Array.isArray(r) ? r : [])).catch(() => {});
  }, [dev.serial]);
  // Mount: the device record and the OTA status in parallel; the log list loads itself in LogsCard.
  useEffect(() => {
    loadProgress();
    apiService.getDevice(dev.device_id)
      .then((d: Detail) => {
        setDetail(d); setAutoReboot(d?.auto_reboot_enabled); setLogsOn(d?.logs_enabled); setMutedUntil(d?.alerts_muted_until);
        setWaiting({ reboot: !!d?.pending_reboot, reset: !!d?.pending_hard_reset, rollback: !!d?.pending_rollback });
      })
      .catch(() => {});
  }, [dev.device_id, loadProgress]);
  // The Readings summary is always on screen, so coverage loads with the page (monitors only; meters have no inverter values).
  useEffect(() => {
    if (isMeter) return;
    apiService.getRegisterCoverage(dev.device_id).then(setCov).catch(() => setCovFailed(true));
  }, [isMeter, dev.device_id]);
  // No polling, except OTA progress while an update is downloading and the tab is visible.
  // Update requests that never started (still waiting after 3 days) are noise, not history.
  const stale = (l: OtaLog) => ['pending', 'available'].includes(l.status) && Date.now() - new Date(l.last_checked_at || l.started_at || 0).getTime() > 3 * 86_400_000;
  const downloading = ['downloading', 'pending', 'available', 'checking'].includes(otaLogs[0]?.status ?? '') && !stale(otaLogs[0]);
  useEffect(() => {
    if (!downloading) return;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') loadProgress(); }, 15_000);
    return () => window.clearInterval(id);
  }, [downloading, loadProgress]);

  const fail = () => setNote({ ok: false, text: `Couldn't send that to ${name}. Try again, or ask an admin.` });
  const run = async (call: () => Promise<any>, done: string, after?: (r: any) => void) => {
    setBusy(true); setNote(null);
    try { const r = await call(); after?.(r); setNote({ ok: true, text: done }); }
    catch { fail(); }
    finally { setBusy(false); setPending(null); }
  };
  const toggle = async (set: (v: boolean | undefined) => void, prev: boolean | undefined, v: boolean, call: () => Promise<unknown>) => {
    set(v); setNote(null);
    try { await call(); } catch { set(prev); fail(); }
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === 'reboot') run(() => apiService.rebootDevice(dev.device_id), `Restart sent to ${name}. It restarts within a few minutes.`, () => setWaiting(w => ({ ...w, reboot: true })));
    else if (pending.kind === 'reset') run(() => apiService.hardResetDevice(dev.device_id), `Hard reset sent to ${name}. It resets within a few minutes.`, () => setWaiting(w => ({ ...w, reset: true })));
    else if (pending.kind === 'rollback') run(() => apiService.triggerRollback(dev.serial), `Roll back sent to ${name}. It switches within a few minutes.`, () => setWaiting(w => ({ ...w, rollback: true }))).then(loadProgress);
    else if (pending.kind === 'update') { const fw = pending.fw; run(() => apiService.triggerSingleUpdate(dev.serial, fw.id), `Update to ${fw.version} sent to ${name}. It starts within a few minutes.`).then(loadProgress); }
  };
  const c = pending ? CONFIRM[pending.kind] : null;

  const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 22, border: `1px solid ${t.line}`, borderRadius: 18, background: t.card };
  const inner: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '9px 11px', border: `1px solid ${t.line}`, borderRadius: 12, background: t.card2 };
  const row: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' };
  const section = (title: string, children: React.ReactNode) => (
    <section className={title === 'Status' ? 'dp-status' : 'dp-rest'} style={card}><h3 style={{ margin: 0, display: 'flex', alignItems: 'center', minHeight: 40, fontFamily: t.head, fontSize: '1.02rem' }}>{title}</h3>{children}</section>
  );
  // Label / value rows: the eye scans the left column for the field and the right for its state.
  const facts = (rows: [string, React.ReactNode, boolean?][]) => (
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(96px, max-content) minmax(0, 1fr)', columnGap: 18, rowGap: 8, fontSize: '0.88rem' }}>
      {rows.filter(([, v]) => v != null && v !== '' && v !== false).map(([k, v, warn]) => (
        <React.Fragment key={k}>
          <dt style={{ color: t.ink2 }}>{k}</dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere', fontWeight: warn ? 600 : 500, color: warn ? t.waitInk : t.ink }}>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
  const tile = (k: string, value: React.ReactNode, sub?: React.ReactNode, warn = false) => (
    <div key={k} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6, minHeight: 96, boxSizing: 'border-box', padding: 16, borderRadius: 16, border: `1px solid ${warn ? t.waitInk : t.line}`, background: t.card2 }}>
      <span style={{ fontSize: '0.8rem', color: t.ink2 }}>{k}</span>
      <span style={{ fontFamily: t.head, fontSize: '1.3rem', fontWeight: 600, color: warn ? t.waitInk : t.ink, overflowWrap: 'anywhere' }}>{value}</span>
      <span style={{ fontSize: '0.8rem', color: t.ink2, minHeight: '1em' }}>{sub ?? '\u00a0'}</span>
    </div>
  );
  const dim = (text: React.ReactNode, warn = false) => <p style={{ margin: 0, fontSize: '0.82rem', color: warn ? t.waitInk : t.ink2 }}>{text}</p>;
  const line = (text: React.ReactNode) => <p style={{ margin: 0, fontSize: '0.88rem', color: t.ink2 }}>{text}</p>;
  const small = (text: React.ReactNode) => <span style={{ display: 'block', fontSize: '0.78rem', color: t.ink2 }}>{text}</span>;
  const label = (text: string, tone?: string) => <div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.06em', color: tone ?? t.ink2 }}>{text}</div>;
  const expander = (key: string, text: string, body: () => React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <DetailsToggle isDark={isDark} label={text} open={!!openPanel[key]} onToggle={() => setOpenPanel(p => ({ ...p, [key]: !p[key] }))} />
      {openPanel[key] && body()}
    </div>
  );
  const history = otaLogs.filter(l => !stale(l)).slice(0, 5);
  const status = progress(otaLogs[0]);
  const cur = otaLogs[0];
  const steps = ['Queued', 'Downloading', 'Done']; // the backend reports no separate installing status
  const stepNow = !cur || stale(cur) ? -1 : { pending: 0, available: 0, checking: 0, downloading: 1, completed: 2, failed: 1 }[cur.status as 'pending'] ?? -1;
  const dlPct = cur?.status === 'downloading' && cur.firmware_version?.size ? Math.min(100, Math.round(((cur.bytes_downloaded ?? 0) / cur.firmware_version.size) * 100)) : null;
  const lastOta = otaLogs[0]?.completed_at || otaLogs[0]?.started_at || otaLogs[0]?.last_checked_at;
  const onOff = (v: boolean | undefined) => (v === undefined ? 'not reported' : v ? 'on' : 'off');

  const mutedNow = !!mutedUntil && new Date(mutedUntil).getTime() > Date.now();
  // Stat tiles: a short value plus an optional second line. Older backends omit some keys: show no tile rather than a wrong one.
  const settingsTile: [string, string?] | null = !detail ? null
    : !detail.config_version ? ['Not set']
    : detail.pending_config_update ? ['Waiting', 'to apply settings']
    : ['Applied'];
  const alertsTile: [string, string?] | null = mutedUntil === undefined ? null
    : !mutedNow ? ['On']
    : isForever(mutedUntil!) ? ['Muted', 'until turned back on']
    : ['Muted', `until ${at(mutedUntil!)}`];
  const restartTile = !detail || !('rs485_reboot_at' in detail) ? null
    : detail.rs485_reboot_at ? at(detail.rs485_reboot_at) : 'None recorded';
  const debugUntil = detail?.telemetry_debug_until;
  // Debug mode is an engineer's tool and "Off" is normal, so it only gets a tile when it is on: while on, the dashboard stops updating from this device.
  const debugTile: [string, string] | null = !debugUntil || !detail || new Date(debugUntil).getTime() <= Date.now() ? null
    : ['On', isForever(debugUntil) ? 'dashboard data paused until turned off' : `dashboard data paused until ${at(debugUntil)}`];
  const missing = (cov?.slaves ?? []).flatMap(s => (s.registers ?? []).filter(r => !r.received));
  const pbtn = (text: string, hint: string, onClick: () => void, waitingNow = false) => (
    <Btn isDark={isDark} size="sm" variant="soft" aria-label={waitingNow ? `${text} sent, waiting` : text} disabled={busy || waitingNow} onClick={onClick}>
      {waitingNow ? `${text} sent, waiting` : text}{small(waitingNow ? 'It happens within a few minutes.' : hint)}
    </Btn>
  );

  return (
    <div style={{ fontFamily: t.body, color: t.ink }}>
      <style>{`.dp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:stretch}.dp-left>:last-child,.dp-right>:last-child{flex:1 1 auto}.dp-logs{display:flex}.dp-logs>*{flex:1}@media(max-width:820px){.dp-grid{grid-template-columns:minmax(0,1fr)}.dp-left,.dp-right{display:contents}.dp-status{order:1}.dp-panel{order:2}.dp-rest{order:3}.dp-logs{order:4}}`}</style>
      <h2 style={{ margin: '0 0 14px', fontFamily: t.head, fontSize: '1.4rem', fontWeight: 700 }}>{name}</h2>
      <div className="dp-grid">
        <div className="dp-left" style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {section('Status', <>
            <div style={TILES}>
              {tile('State', dev.is_online ? 'Live' : 'Not reporting', ago(dev.last_heartbeat) || 'No update yet', !dev.is_online)}
              {dev.last_heartbeat && tile('Last update', new Date(dev.last_heartbeat).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), new Date(dev.last_heartbeat).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}
              {tile('Firmware', dev.firmware_version || 'Not reported', update ? 'Update available' : undefined)}
              {tile('Signal', connection(dev).split(', ').reverse().join(' · ').replace(/^./, c => c.toUpperCase()))}
              {settingsTile && tile('Settings', settingsTile[0], settingsTile[1], settingsTile[0] === 'Waiting')}
              {alertsTile && tile('Alerts', alertsTile[0], alertsTile[1], alertsTile[0] === 'Muted')}
              {restartTile && tile('Last auto restart', restartTile)}
              {debugTile && tile('Debug mode', debugTile[0], debugTile[1], true)}
              {!ctl && tile('Sending logs', onOff(logsOn))}
              {!ctl && tile('Auto reboot', onOff(autoReboot))}
            </div>
            {expander('adv', 'Advanced details', () => (
              <div style={inner}>
                {facts([
                  ['Kind', KIND[dev.device_type] ?? 'Device'],
                  ['Serial', dev.serial],
                  ['Device type', dev.device_type],
                  ['Settings preset', detail?.config_version ?? null],
                  ['Applied version', detail?.config_ack_ver != null ? String(detail.config_ack_ver) : null],
                ])}
              </div>
            ))}
          </>)}

          {!isMeter && section('Readings', <>
            {(() => {
              if (covFailed) return line("Couldn't check which inverter values arrive yet.");
              if (!cov) return line('Checking inverter values…');
              if (cov.total_configured === 0) return line('No inverter values are set up to read.');
              const got = cov.total_received, all = cov.total_configured;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: t.head, fontSize: '1.6rem', fontWeight: 600, color: got === 0 ? t.waitInk : t.ink }}>{got} <span style={{ fontSize: '1rem', color: t.ink2, fontWeight: 500 }}>of {all}</span></span>
                    <span style={{ fontSize: '0.86rem', color: t.ink2 }}>inverter values arriving</span>
                  </div>
                  <div role="meter" aria-label="Inverter values arriving" aria-valuemin={0} aria-valuemax={all} aria-valuenow={got}
                    style={{ height: 8, borderRadius: 4, background: t.idleBg, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((got / all) * 100)}%`, height: '100%', background: got === all ? t.good : t.wait }} />
                  </div>
                  {cov.last_telemetry_at && line(`Last message from the monitor: ${at(cov.last_telemetry_at)}.`)}
                  {got === 0 && line('None are arriving right now. The monitor may not be able to reach the inverter. Check the cable, or ask an admin.')}
                  {missing.length > 0 && expander('missing', `Each value not arriving (${missing.length})`, () => (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 220, overflow: 'auto' }}>
                      {missing.map(r => (
                        <span key={r.id} style={{ fontSize: '0.82rem', padding: '4px 10px', borderRadius: 999, border: `1px solid ${t.line}`, background: t.card2 }}>
                          {niceLabel(r.label)}{r.unit ? ` (${r.unit})` : ''}
                        </span>
                      ))}
                    </div>
                  ))}
                </>
              );
            })()}
          </>)}

          {section('Firmware updates', <>
            <div style={TILES}>
              {tile('Running', dev.firmware_version || 'Not reported')}
              {tile('Newest', builds[0]?.version ?? 'Not available', firmware === null ? 'Not available to you' : update ? 'Update available' : 'You have it', !!update)}
            </div>
            {stepNow >= 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 600 }}><span>{status}</span>{dlPct != null && <span style={{ color: t.ink2 }}>{dlPct}%</span>}</div>
                <div role="meter" aria-label="Update progress" aria-valuemin={0} aria-valuemax={steps.length - 1} aria-valuenow={stepNow}
                  style={{ height: 8, borderRadius: 4, background: t.idleBg, overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ width: `${cur?.status === 'completed' ? 100 : cur?.status === 'failed' ? ((dlPct ?? 0) || 50) : stepNow === 1 ? 33 + (dlPct ?? 0) * 0.5 : 10}%`, height: '100%', background: cur?.status === 'failed' ? t.wait : t.good }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 6, fontSize: '0.76rem', color: t.ink2 }}>
                  {steps.map((x, i) => <span key={x} style={{ color: i <= stepNow ? t.goodInk : t.ink2, textAlign: i === 2 ? 'right' : i === 1 ? 'center' : 'left' }}>{x}</span>)}
                </div>
              </div>
            )}
            {stepNow < 0 && status && line(`${status}${lastOta ? ` · ${at(lastOta)}` : ''}`)}
            {firmware === null && line("Firmware versions aren't available to you. To update this device, ask an admin.")}
            {update && !ctl && line(`Version ${update.version} is available.`)}
            {builds.length > 0 && expander('versions', 'Choose another version', () => builds.map(fw => {
              const meta = [
                fw.created_at && `Released ${new Date(fw.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                fw.size && `${(fw.size / 1048576).toFixed(1)} MB`,
              ].filter(Boolean).join(' · ');
              const notes = fw.release_notes || fw.description;
              return (
                <div key={fw.id} style={{ ...inner, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: '0.88rem', minWidth: 0, overflowWrap: 'anywhere' }}>
                    {fw.version}
                    {meta && small(meta)}
                    {notes && small(notes)}
                  </span>
                  {isRunning(fw, dev)
                    ? <StatusChip isDark={isDark} state="good">Running now</StatusChip>
                    : ctl && <Btn isDark={isDark} size="sm" variant="plain" aria-label={`Install ${fw.version}`} onClick={() => setPending({ kind: 'update', fw })}>Install</Btn>}
                </div>
              );
            }))}
          </>)}

          {section('Update history', history.length === 0 ? line('No updates yet.') : <>
            {history.map((l, i) => {
              const when = l.completed_at || l.started_at || l.last_checked_at;
              return (
                <div key={l.id ?? i} style={{ ...inner, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: '0.88rem' }}>{l.firmware_version?.version ?? 'Unknown version'}{when && small(at(when))}{l.status === 'failed' && l.error_message && small(l.error_message)}</span>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: l.status === 'failed' ? t.waitInk : l.status === 'completed' ? t.goodInk : t.ink2 }}>{OTA_WORDS[l.status] ?? l.status}</span>
                </div>
              );
            })}
          </>)}

          {ctl && <BuildsCard isDark={isDark} deviceType={dev.device_type} kindLabel={KIND[dev.device_type] ?? 'Device'} onChanged={() => getFirmware().then(setFirmware)} />}

        </div>

        <div className="dp-right" style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        {ctl && (
          <aside aria-label="What you can do" className="dp-panel" style={{ ...card, border: `1px solid ${t.good}`, gap: 12 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', minHeight: 40, fontFamily: t.head, fontSize: '1.02rem' }}>What you can do</h3>
            {note && <p role="status" style={{ margin: 0, fontSize: '0.86rem', color: note.ok ? t.goodInk : t.waitInk, background: note.ok ? t.goodBg : t.waitBg, borderRadius: 10, padding: '9px 12px' }}>{note.text}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {label('EVERYDAY')}
              {/* Mute state unknown (detail failed) → offer both. */}
              {(mutedUntil === undefined || !mutedNow) && (
                <Btn isDark={isDark} size="sm" variant="plain" disabled={busy}
                  onClick={() => run(() => apiService.muteDeviceAlerts(dev.device_id, 4), `Alerts muted for ${name} for 4 hours.`,
                    r => setMutedUntil(r?.indefinite ? '9999-12-31T23:59:59Z' : r?.alerts_muted_until ?? undefined))}>Mute alerts for 4 hours</Btn>
              )}
              {(mutedUntil === undefined || mutedNow) && (
                <Btn isDark={isDark} size="sm" variant="plain" disabled={busy}
                  onClick={() => run(() => apiService.unmuteDeviceAlerts(dev.device_id), `Alerts are back on for ${name}.`, () => setMutedUntil(null))}>Turn alerts back on</Btn>
              )}
              <Switch isDark={isDark} label="Auto reboot" checked={!!autoReboot}
                hint={autoReboot === undefined ? 'Current setting not reported.' : 'Restarts it by itself when the inverter readings stop changing.'}
                onChange={v => toggle(setAutoReboot, autoReboot, v, () => apiService.setDeviceAutoReboot(dev.device_id, v))} />
              <Switch isDark={isDark} label="Send logs" checked={!!logsOn}
                hint={logsOn === undefined ? 'Current setting not reported.' : logsOn ? 'It uploads its log files.' : "It doesn't upload logs."}
                onChange={v => toggle(setLogsOn, logsOn, v, () => apiService.toggleDeviceLogs(dev.device_id, v))} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {label('NEEDS CONFIRMING', t.waitInk)}
              {pbtn('Restart', 'Takes about a minute.', () => setPending({ kind: 'reboot' }), waiting.reboot)}
              {firmware !== null && update && (
                <Btn isDark={isDark} size="sm" variant="primary" disabled={busy} onClick={() => setPending({ kind: 'update', fw: update })}>Update to {update.version}</Btn>
              )}
              {pbtn('Roll back', 'Goes back to the version it ran before.', () => setPending({ kind: 'rollback' }), waiting.rollback)}
            </div>

            <div style={{ border: `1px dashed ${t.line}`, borderRadius: 12, padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DetailsToggle isDark={isDark} label="Engineer only" open={!!openPanel.eng} onToggle={() => setOpenPanel(p => ({ ...p, eng: !p.eng }))} />
              {openPanel.eng && <>
                {line('Hard reset erases its settings. Only if an engineer asked you to.')}
                {pbtn('Hard reset', '', () => setPending({ kind: 'reset' }), waiting.reset)}
              </>}
            </div>
          </aside>
        )}
          <div className="dp-logs"><LogsCard deviceId={dev.device_id} isDark={isDark} /></div>
        </div>
      </div>

      <ConfirmDialog
        isDark={isDark}
        open={!!c}
        tone={c?.tone}
        title={!pending ? '' : pending.kind === 'update' ? `Update ${name} to ${pending.fw.version}?` : `${c!.title} ${name}?`}
        body={c?.body}
        confirmLabel={c?.ok}
        cancelLabel={c?.cancel}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
};

export default DevicePage;
