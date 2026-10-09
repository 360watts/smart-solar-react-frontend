import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { apiService } from '../../../services/api';
import { useTokens, StatusChip, Btn, ConfirmDialog, DetailsToggle } from '../siteHardware/ui';
import { useDialogBehavior } from '../employees/useDialogBehavior';
import { useAccess } from '../../../shared/access/useAccess';

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
type LogFile = { id: number; filename?: string; name?: string; created_at?: string; uploaded_at?: string };
/** The viewer-visible part of GET /devices/<pk>/ (Wi-Fi name, IP and password are stripped for viewers). */
type Detail = {
  config_version?: string | null; config_ack_ver?: number | null; pending_config_update?: boolean;
  alerts_muted_until?: string | null; logs_enabled?: boolean; auto_reboot_enabled?: boolean;
  /** Last automatic (RS-485 stall) restart; null = none recorded. */
  rs485_reboot_at?: string | null;
  /** Detailed telemetry logging on until this time; null/past = off; year 9999 = until turned off. */
  telemetry_debug_until?: string | null;
};
type Coverage = {
  total_configured: number; total_received: number; last_telemetry_at?: string | null;
  slaves?: { device_name?: string; registers?: { id: number; label: string; unit?: string | null; received: boolean }[] }[];
};
type Scan = { files_scanned: number; total_errors: number; total_warnings: number };
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

const isRunning = (fw: Firmware, dev: Dev) => normVersion(fw.version) === normVersion(dev.firmware_version);

/** Active builds for this device's type, newest first. */
export function buildsFor(firmware: Firmware[] | null, dev: Dev): Firmware[] {
  return (firmware ?? [])
    .filter(f => f.is_active !== false && (!f.device_type || f.device_type === dev.device_type))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/** The newest active build for this device's type when it differs from what the device runs, else null. */
export function updateFor(firmware: Firmware[] | null, dev: Dev): Firmware | null {
  const latest = buildsFor(firmware, dev)[0];
  return latest && !isRunning(latest, dev) ? latest : null;
}

const OTA_WORDS: Record<string, string> = {
  pending: 'Waiting for its next check-in', available: 'Waiting for its next check-in', checking: 'Checking',
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

/** Side drawer for one device: status, firmware, logs, diagnostics, auto reboot and the device operations.
 *  Reads always show; every write is shown only with device control. The backend scopes and enforces every call. */
const DeviceDrawer: React.FC<{ isDark: boolean; dev: Dev; firmware: Firmware[] | null; onClose: () => void }> = ({ isDark, dev, firmware, onClose }) => {
  const t = useTokens(isDark);
  const ref = useDialogBehavior(onClose);
  const ctl = useAccess().can('device_control');
  const name = devName(dev);
  const update = updateFor(firmware, dev);
  const builds = buildsFor(firmware, dev);
  const isMeter = dev.device_type === 'energy_meter';

  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [otaLogs, setOtaLogs] = useState<OtaLog[]>([]);
  const [files, setFiles] = useState<LogFile[] | null>(null);
  const [filesFailed, setFilesFailed] = useState(false);
  const [viewing, setViewing] = useState<{ id: number; text: string } | null>(null);
  // Switch, settings and mute states come from GET /devices/<pk>/ (gateway-status does not carry them); undefined = not known.
  const [detail, setDetail] = useState<Detail | undefined>();
  const [autoReboot, setAutoReboot] = useState<boolean | undefined>();
  const [logsOn, setLogsOn] = useState<boolean | undefined>();
  const [mutedUntil, setMutedUntil] = useState<string | null | undefined>();
  const [cov, setCov] = useState<Coverage | null>(null);
  const [covFailed, setCovFailed] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [logWork, setLogWork] = useState(false);
  const [openPanel, setOpenPanel] = useState<Record<string, boolean>>({});

  const loadProgress = useCallback(() => {
    apiService.getDeviceUpdateLogs(dev.serial).then(r => setOtaLogs(Array.isArray(r) ? r : [])).catch(() => {});
  }, [dev.serial]);
  useEffect(() => {
    loadProgress();
    apiService.getDevice(dev.device_id)
      .then((d: Detail) => { setDetail(d); setAutoReboot(d?.auto_reboot_enabled); setLogsOn(d?.logs_enabled); setMutedUntil(d?.alerts_muted_until); })
      .catch(() => {});
    apiService.getDeviceLogFiles(dev.device_id, 10)
      .then(r => setFiles(Array.isArray(r?.files) ? r.files : []))
      .catch(() => setFilesFailed(true));
    if (dev.device_type !== 'energy_meter') {
      apiService.getRegisterCoverage(dev.device_id).then(setCov).catch(() => setCovFailed(true));
    }
  }, [dev.device_id, dev.device_type, loadProgress]);

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
  const logTask = async (call: () => Promise<void>, failText: string) => {
    setLogWork(true); setNote(null);
    try { await call(); } catch { setNote({ ok: false, text: failText }); } finally { setLogWork(false); }
  };
  // The scan route reads one IST calendar day: today's date in Asia/Kolkata as YYYY-MM-DD.
  const scanToday = () => logTask(
    async () => setScan(await apiService.scanDeviceLogFiles(dev.device_id, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))),
    "Couldn't scan today's logs. Try again.");
  const downloadAll = () => logTask(
    () => apiService.bulkDownloadLogFiles(dev.device_id),
    "Couldn't download the log files. There may be too many at once; ask an admin.");

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === 'reboot') run(() => apiService.rebootDevice(dev.device_id), `Restart sent to ${name}. It restarts at its next check-in.`);
    else if (pending.kind === 'reset') run(() => apiService.hardResetDevice(dev.device_id), `Hard reset sent to ${name}. It resets at its next check-in.`);
    else if (pending.kind === 'rollback') run(() => apiService.triggerRollback(dev.serial), `Roll back sent to ${name}. It switches at its next check-in.`).then(loadProgress);
    else if (pending.kind === 'update') { const fw = pending.fw; run(() => apiService.triggerSingleUpdate(dev.serial, fw.id), `Update to ${fw.version} sent to ${name}. It starts at its next check-in.`).then(loadProgress); }
  };
  const c = pending ? CONFIRM[pending.kind] : null;

  const section = (title: string, children: React.ReactNode) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ margin: 0, fontFamily: t.head, fontSize: '1.02rem' }}>{title}</h3>
      {children}
    </section>
  );
  const line = (text: React.ReactNode) => <p style={{ margin: 0, fontSize: '0.88rem', color: t.ink2 }}>{text}</p>;
  const small = (text: React.ReactNode) => <span style={{ display: 'block', fontSize: '0.78rem', color: t.ink2 }}>{text}</span>;
  const row: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' };
  const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '9px 11px', border: `1px solid ${t.line}`, borderRadius: 12, background: t.card2 };
  const expander = (key: string, label: string, body: () => React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <DetailsToggle isDark={isDark} label={label} open={!!openPanel[key]} onToggle={() => setOpenPanel(p => ({ ...p, [key]: !p[key] }))} />
      {openPanel[key] && body()}
    </div>
  );
  const status = progress(otaLogs[0]);
  const onOff = (v: boolean | undefined) => (v === undefined ? 'not reported' : v ? 'on' : 'off');

  // config_version is the preset id and config_ack_ver the applied preset version, so they can't be
  // compared directly; pending_config_update is the backend's own "not applied yet" flag (same as staff Devices).
  const settings = !detail ? null
    : !detail.config_version ? 'No settings assigned yet'
    : detail.pending_config_update ? 'Waiting for the device to apply settings'
    : 'Settings applied';
  const mutedNow = !!mutedUntil && new Date(mutedUntil).getTime() > Date.now();
  const muteLine = mutedUntil === undefined ? null
    : !mutedNow ? 'Alerts are on.'
    : isForever(mutedUntil!) ? 'Alerts are muted until someone turns them back on.'
    : `Alerts muted until ${at(mutedUntil!)}.`;
  // Older backends omit these keys: show nothing rather than a wrong "None recorded" / "Off".
  const rebootLine = !detail || !('rs485_reboot_at' in detail) ? null
    : `Last automatic restart: ${detail.rs485_reboot_at ? at(detail.rs485_reboot_at) : 'None recorded'}`;
  const debugUntil = detail?.telemetry_debug_until;
  const debugLine = !detail || !('telemetry_debug_until' in detail) ? null
    : !debugUntil || new Date(debugUntil).getTime() <= Date.now() ? 'Detailed logging: Off'
    : isForever(debugUntil) ? 'Detailed logging: On until turned off'
    : `Detailed logging: On until ${at(debugUntil)}`;
  const missing = (cov?.slaves ?? []).flatMap(s => (s.registers ?? []).filter(r => !r.received));

  return ReactDOM.createPortal(
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', justifyContent: 'flex-end', background: isDark ? 'rgba(6,8,11,0.6)' : 'rgba(17,24,39,0.4)' }}
    >
      <div
        ref={ref} role="dialog" aria-modal="true" aria-label={name}
        style={{ width: 'min(520px, 100%)', height: '100%', background: t.card, color: t.ink, fontFamily: t.body, display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: `1px solid ${t.line2}` }}>
          <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: t.head, fontSize: '1.2rem', fontWeight: 700 }}>{name}</h2>
          <button type="button" aria-label="Close" onClick={onClose}
            style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${t.line}`, background: 'transparent', color: t.ink2, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {note && (
            <p role="status" style={{ margin: 0, fontSize: '0.86rem', color: note.ok ? t.goodInk : t.waitInk, background: note.ok ? t.goodBg : t.waitBg, borderRadius: 10, padding: '9px 12px' }}>{note.text}</p>
          )}

          {section('Status', <>
            <div style={row}>
              <StatusChip isDark={isDark} state={dev.is_online ? 'good' : 'wait'}>{dev.is_online ? 'Live' : 'Not reporting'}</StatusChip>
              <span style={{ fontSize: '0.86rem', color: t.ink2 }}>{ago(dev.last_heartbeat)}</span>
            </div>
            {line(dev.last_heartbeat ? `Last update at ${at(dev.last_heartbeat)}` : 'No update received yet.')}
            {line(`${KIND[dev.device_type] ?? 'Device'} · firmware ${dev.firmware_version || 'not reported'}`)}
            {line(connection(dev))}
            {settings && line(settings)}
            {muteLine && line(muteLine)}
            {rebootLine && line(rebootLine)}
            {debugLine && line(debugLine)}
            {expander('adv', 'Advanced details', () => (
              <div style={card}>
                {small(`Serial ${dev.serial}`)}
                {small(`Device type ${dev.device_type}`)}
                {detail?.config_version && small(`Settings preset ${detail.config_version}`)}
                {detail?.config_ack_ver != null && small(`Applied settings version ${detail.config_ack_ver}`)}
              </div>
            ))}
          </>)}

          {section('Firmware', <>
            {status && line(status)}
            {firmware === null ? line("Firmware versions aren't available to you. To update this device, ask an admin.") : <>
              {update
                ? ctl
                  ? <div style={row}><Btn isDark={isDark} size="sm" onClick={() => setPending({ kind: 'update', fw: update })}>Update to {update.version}</Btn></div>
                  : line(`Version ${update.version} is available.`)
                : line('It runs the latest version.')}
              {builds.length > 0 && expander('versions', 'Choose a version', () => builds.map(fw => {
                const meta = [
                  fw.created_at && `Released ${new Date(fw.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                  fw.size && `${(fw.size / 1048576).toFixed(1)} MB`,
                ].filter(Boolean).join(' · ');
                const notes = fw.release_notes || fw.description;
                return (
                  <div key={fw.id} style={{ ...card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
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
            </>}
            <div style={row}>
              {ctl && <Btn isDark={isDark} size="sm" variant="plain" onClick={() => setPending({ kind: 'rollback' })}>Roll back to the previous version</Btn>}
              <Btn isDark={isDark} size="sm" variant="plain" onClick={loadProgress}>Check progress</Btn>
            </div>
            {expander('history', 'Update history', () => otaLogs.length === 0 ? line('No updates yet.') : otaLogs.slice(0, 5).map((l, i) => {
              const when = l.completed_at || l.started_at || l.last_checked_at;
              return (
                <div key={l.id ?? i} style={card}>
                  <span style={{ fontSize: '0.88rem' }}>{`${l.firmware_version?.version ?? 'Unknown version'} · ${OTA_WORDS[l.status] ?? l.status}`}</span>
                  {when && small(at(when))}
                  {l.status === 'failed' && l.error_message && small(l.error_message)}
                </div>
              );
            }))}
          </>)}

          {section('Logs', <>
            {ctl
              ? <Switch isDark={isDark} label="Send logs" checked={!!logsOn}
                  hint={logsOn === undefined ? 'Current setting not reported.' : logsOn ? 'It uploads its log files.' : "It doesn't upload logs."}
                  onChange={v => toggle(setLogsOn, logsOn, v, () => apiService.toggleDeviceLogs(dev.device_id, v))} />
              : line(`Sending logs: ${onOff(logsOn)}.`)}
            {filesFailed ? line("Couldn't load the log files.")
              : files === null ? line('Loading log files…')
              : files.length === 0 ? line('No log files yet.')
              : <>
                <div style={row}>
                  <Btn isDark={isDark} size="sm" variant="plain" disabled={logWork} onClick={scanToday}>Scan today's logs</Btn>
                  <Btn isDark={isDark} size="sm" variant="plain" disabled={logWork} onClick={downloadAll}>Download all</Btn>
                </div>
                {scan && line(scan.files_scanned === 0 ? 'No log files from today to check.'
                  : `Checked ${plural(scan.files_scanned, 'log file')} from today: ${plural(scan.total_errors, 'error')}, ${plural(scan.total_warnings, 'warning')}.`)}
                {files.map(f => {
                  const fname = f.filename || f.name || `Log ${f.id}`;
                  // The list route returns uploaded_at; created_at kept for older payloads.
                  const when = f.uploaded_at || f.created_at;
                  return (
                    <div key={f.id} style={card}>
                      <div style={{ ...row, justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.88rem', minWidth: 0, overflowWrap: 'anywhere' }}>
                          {fname}
                          {when && small(at(when))}
                        </span>
                        <span style={row}>
                          <Btn isDark={isDark} size="sm" variant="plain" aria-label={`View ${fname}`}
                            onClick={() => viewing?.id === f.id ? setViewing(null) : apiService.getDeviceLogFileContent(dev.device_id, f.id).then(text => setViewing({ id: f.id, text })).catch(() => setNote({ ok: false, text: "Couldn't open that log file." }))}>
                            {viewing?.id === f.id ? 'Hide' : 'View'}
                          </Btn>
                          <Btn isDark={isDark} size="sm" variant="plain" aria-label={`Download ${fname}`}
                            onClick={() => apiService.getDeviceLogFileDownloadUrl(dev.device_id, f.id).then(({ url }) => window.open(url, '_blank')).catch(() => setNote({ ok: false, text: "Couldn't download that log file." }))}>
                            Download
                          </Btn>
                        </span>
                      </div>
                      {viewing?.id === f.id && (
                        <pre style={{ margin: 0, maxHeight: 240, overflow: 'auto', fontSize: '0.76rem', whiteSpace: 'pre-wrap', background: t.card, borderRadius: 8, padding: 8 }}>{viewing.text}</pre>
                      )}
                    </div>
                  );
                })}
              </>}
          </>)}

          {!isMeter && section('Diagnostics', <>
            {line(covFailed ? "Couldn't check which inverter values arrive yet."
              : !cov ? 'Checking inverter values…'
              : cov.total_configured === 0 ? 'No inverter values are set up to read.'
              : `Reading ${cov.total_received} of ${cov.total_configured} inverter values${cov.last_telemetry_at ? ` (latest reading ${at(cov.last_telemetry_at)})` : ''}.`)}
            {missing.length > 0 && expander('missing', 'Show missing values', () => (
              <div style={card}>{missing.map(r => <span key={r.id} style={{ fontSize: '0.84rem' }}>{r.label}{r.unit ? ` (${r.unit})` : ''}</span>)}</div>
            ))}
          </>)}

          {section('Auto reboot', ctl ? (
            <Switch isDark={isDark} label="Auto reboot" checked={!!autoReboot}
              hint={autoReboot === undefined ? 'Current setting not reported.' : 'Restarts it by itself when the inverter readings stop changing.'}
              onChange={v => toggle(setAutoReboot, autoReboot, v, () => apiService.setDeviceAutoReboot(dev.device_id, v))} />
          ) : line(`Auto reboot: ${onOff(autoReboot)}.`))}

          {ctl && section('Actions', <>
            <div style={row}>
              <Btn isDark={isDark} size="sm" variant="soft" onClick={() => setPending({ kind: 'reboot' })}>Restart</Btn>
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
            </div>
            <div style={{ borderTop: `1px solid ${t.line2}`, paddingTop: 10 }}>
              <Btn isDark={isDark} size="sm" variant="plain" onClick={() => setPending({ kind: 'reset' })}>Hard reset</Btn>
              {line('Erases its settings. Only if an engineer asked you to.')}
            </div>
          </>)}
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
    </div>,
    document.body,
  );
};

export default DeviceDrawer;
