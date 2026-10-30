import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiService } from '../../../services/api';
import { useAccess } from '../../../shared/access/useAccess';
import { useAuth } from '../../../contexts/AuthContext';
import { ConfirmDialog } from '../siteHardware/ui';
import { at, buildsFor, isNewer, normVersion, updateFor, type Dev, type Firmware } from './DevicePage';
import OpsSettings from './OpsSettings';
import OpsFirmware from './OpsFirmware';
import OpsLogs from './OpsLogs';
import { ListSkeleton } from './Skeleton';
import { ActivityList, EmptyState, Notice } from '../../../shared/components/Feedback';
import { BellOff, Download, FileText, Gauge, RotateCcw, Stethoscope, Timer, Bug, Signal, RefreshCw, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react';
import './operationsTab.css';

type State = 'confirmed' | 'waiting' | 'not_confirmed' | 'failed' | 'sent' | 'no_record';
type Op = { op: string; state: State; confirmed_at: string | null;
  last: { at: string; action: string; actor: { id: number; name: string } | null; values: Record<string, unknown> } | null };
type Ops = { device_type: string; ops: Op[]; recent: { at: string; op: string; action: string; actor: { id: number; name: string } | null }[] };

// Action rows per device type, in default order. Settings-type ops (auto restart, APN, interval...) live in the Settings sub-tab.
const GATEWAY = ['reboot', 'diagnostics', 'mute', 'ota_update', 'send_logs', 'rollback', 'hard_reset'];
const OPKEY: Record<string, string> = { send_logs: 'fetch_logs' };  // the card is named for what it does; the backend op is fetch_logs
const METER = ['reboot', 'ota_update', 'hard_reset'];
const INFO: Record<string, [string, string]> = {  // title, one-line description
  reboot: ['Restart', 'Restarts the device. Settings are kept.'],
  diagnostics: ['Run diagnostics', 'Collects a health report from the device.'],
  mute: ['Mute alerts', 'Stops alerts for this device until you unmute it.'],
  ota_update: ['Update firmware', 'Installs a build. The device restarts and may take 3 minutes.'],
  rollback: ['Roll back firmware', 'Returns to the version it ran before. The device restarts.'],
  send_logs: ['Send logs', "The gateway uploads its log files after each restart. If it is offline, this is delivered when it reconnects."], fetch_logs: ['Send logs', ''],
  hard_reset: ['Hard reset', "Erases the device's settings and sends it back to factory state. It cannot be undone."],
  auto_reboot: ['Auto restart', ''], telemetry_debug: ['Detailed readings', ''], apn: ['Mobile data (APN)', ''],
  meter_interval: ['Publish interval', ''], meter_calibrate: ['Calibration', ''],
};
const ICON: Record<string, LucideIcon> = {
  reboot: RotateCcw, diagnostics: Stethoscope, mute: BellOff, ota_update: Download, send_logs: FileText, fetch_logs: FileText, rollback: Undo2, hard_reset: TriangleAlert,
  auto_reboot: RefreshCw, telemetry_debug: Bug, apn: Signal, meter_interval: Timer, meter_calibrate: Gauge,
};
const CHIP: Record<State, [string, string]> = {  // css class, chip
  confirmed: ['ok', 'Confirmed'], waiting: ['wait', 'Waiting'], not_confirmed: ['nc', 'Not confirmed'],
  failed: ['bad', 'Failed'], sent: ['none', 'Sent, no reply exists'], no_record: ['none', 'Never run'],
};
const SUBS = [['actions', 'Actions'], ['settings', 'Settings'], ['firmware', 'Firmware library'], ['logs', 'Logs']] as const;
const NEEDS_ONLINE = ['reboot', 'diagnostics'];
const CONFIRM = {
  reboot: { tone: 'primary' as const, title: 'Restart', body: 'It goes offline for a minute or two, then reconnects. Readings during that time may be missed.', ok: 'Restart', cancel: 'Keep it running' },
  reset: { tone: 'danger' as const, title: 'Hard reset', body: 'This erases its settings and it needs setting up again before it reports. Only do this if an engineer asked you to.', ok: 'Reset it', cancel: 'Keep it' },
  rollback: { tone: 'danger' as const, title: 'Roll back', body: 'It goes back to the firmware it ran before and restarts. Only do this if the latest update caused trouble.', ok: 'Roll back', cancel: 'Keep it' },
  update: { tone: 'danger' as const, title: 'Update', body: "It downloads the new firmware and restarts by itself. Readings pause for a few minutes. Don't unplug it while it updates.", ok: 'Update', cancel: 'Keep it' },
};
const OLDER = { ...CONFIRM.update, ok: 'Install', body: "This build is older than what the device runs now. It downloads it and restarts by itself, and settings made for newer firmware may not work. Only do this if an engineer asked you to or you are testing." };
const METER_RESET = { ...CONFIRM.reset, body: "This erases the meter's Wi-Fi and settings. It stops reporting until someone on site sets it up again from its setup hotspot. Only do this if an engineer asked you to." };
type Pending = { kind: 'reboot' | 'reset' | 'rollback' } | { kind: 'update'; fw: Firmware } | null;

const Btn = ({ children, onClick, disabled, cls = '' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; cls?: string }) =>
  <button type="button" className={`ops-btn ${cls}`} disabled={disabled} onClick={onClick}>{children}</button>;

export default function OperationsTab({ dev, firmware, isDark }: { dev: Dev; firmware: Firmware[] | null; isDark: boolean }) {
  const ctl = useAccess().can('device_control');
  const { user } = useAuth();
  const [params] = useSearchParams();
  const sub = SUBS.find(([k]) => k === params.get('ops'))?.[0] ?? 'actions';
  const href = (k: string) => { const n = new URLSearchParams(params); if (k === 'actions') n.delete('ops'); else n.set('ops', k); return `?${n}`; };
  const [data, setData] = useState<Ops | null | 'failed'>(null);
  const seq = useRef(0);
  // An older response must not overwrite a newer one (the poll and onDone can overlap).
  const load = useCallback(() => {
    const n = ++seq.current;
    return apiService.getDeviceOperations(dev.device_id).then(d => { if (n === seq.current) setData(d); }).catch(() => { if (n === seq.current) setData('failed'); });
  }, [dev.device_id]);
  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const isMeter = dev.device_type === 'energy_meter';
  const defaults = isMeter ? METER : GATEWAY;
  const [showRecent, setShowRecent] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState('');
  const name = `${isMeter ? 'Meter' : 'Monitor'} ${dev.serial}`;
  const update = firmware !== null ? updateFor(firmware, dev) : null;
  // Any active build for this device type can be installed, newer or older; the newest one is offered first.
  const builds = firmware !== null ? buildsFor(firmware, dev) : [];
  const [pickId, setPickId] = useState<number | null>(null);
  // Send logs is a flag on the gateway (logs_enabled), so the card reads it from the device record.
  const [logsOn, setLogsOn] = useState<boolean | null>(null);
  useEffect(() => { setLogsOn(null); if (!isMeter) apiService.getDevice(dev.device_id).then(d => setLogsOn(!!d?.logs_enabled)).catch(() => setLogsOn(null)); }, [dev.device_id, isMeter]);
  const sel = builds.find(b => b.id === pickId) ?? update ?? builds[0] ?? null;
  const installed = !!sel && normVersion(sel.version) === normVersion(dev.firmware_version);
  const older = !!sel && !installed && !isNewer(sel.version, dev.firmware_version);

  const run = async (call: () => Promise<unknown>, done: string) => {
    setBusy(true); setNote(null);
    try { await call(); setNote({ ok: true, text: done }); setTyped(''); await load(); }
    catch { setNote({ ok: false, text: `Couldn't send that to ${name}. Try again, or ask an admin.` }); }
    finally { setBusy(false); setPending(null); }
  };
  const confirm = () => {
    if (!pending) return;
    if (pending.kind === 'reboot') run(() => apiService.rebootDevice(dev.device_id), `Restart sent to ${name}. It restarts within a few minutes.`);
    else if (pending.kind === 'reset') run(() => apiService.hardResetDevice(dev.device_id), `Hard reset sent to ${name}. It resets within a few minutes.`);
    else if (pending.kind === 'rollback') run(() => apiService.triggerRollback(dev.serial), `Roll back sent to ${name}. It switches within a few minutes.`);
    else if (pending.kind === 'update') { const fw = pending.fw; run(() => apiService.triggerSingleUpdate(dev.serial, fw.id), `Update to ${fw.version} sent to ${name}. It starts within a few minutes.`); }
  };
  const unlocked = typed.trim().toUpperCase() === dev.serial.toUpperCase();
  const downgrade = pending?.kind === 'update' && !isNewer(pending.fw.version, dev.firmware_version);
  const c = pending ? (isMeter && pending.kind === 'reset' ? METER_RESET : downgrade ? OLDER : CONFIRM[pending.kind]) : null;

  const ops = data && data !== 'failed' ? data.ops : [];
  const byOp = Object.fromEntries(ops.map(o => [o.op, o]));
  const rows = defaults.filter(id => byOp[OPKEY[id] ?? id]);

  const who = (o: Op) => (o.last?.actor ? (o.last.actor.id === user?.id ? 'you' : o.last.actor.name) : null);
  const off = (o: Op) => busy || o.state === 'waiting' || (!dev.is_online && NEEDS_ONLINE.includes(o.op));

  const buttons = (o: Op) => {
    if (!ctl) return null;
    switch (o.op) {
      case 'reboot': return <Btn disabled={off(o)} onClick={() => setPending({ kind: 'reboot' })}>Restart</Btn>;
      case 'diagnostics': return <Btn disabled={off(o)} onClick={() => run(() => apiService.runDeviceDiagnostics(dev.device_id), `Diagnostics requested from ${name}.`)}>Run diagnostics</Btn>;
      case 'mute': return <>
        <Btn disabled={busy} onClick={() => run(() => apiService.muteDeviceAlerts(dev.device_id, 4), `Alerts muted for ${name} for 4 hours.`)}>Mute</Btn>
        <Btn disabled={busy} onClick={() => run(() => apiService.unmuteDeviceAlerts(dev.device_id), `Alerts are back on for ${name}.`)}>Unmute</Btn></>;
      case 'ota_update': return !sel ? <span className="ops-hint">No builds for this device yet.</span> : <>
        <select className="ofw-in ops-sel" aria-label="Firmware build" title="Only active builds are listed. Activate others in the Firmware library." value={sel.id} onChange={e => setPickId(Number(e.target.value))}>
          {builds.map((b, i) => <option key={b.id} value={b.id}>{b.version}{normVersion(b.version) === normVersion(dev.firmware_version) ? ' (installed)' : i === 0 ? ' (latest)' : ''}</option>)}</select>
        <Btn cls="pri" disabled={off(o) || installed} onClick={() => setPending({ kind: 'update', fw: sel })}>{installed ? 'Already installed' : older ? `Install ${sel.version}` : `Update to ${sel.version}`}</Btn></>;
      case 'fetch_logs': return <Btn disabled={busy || logsOn === null} onClick={() => run(async () => { await apiService.toggleDeviceLogs(dev.device_id, !logsOn); setLogsOn(!logsOn); }, `Send logs turned ${logsOn ? 'off' : 'on'} for ${name}.`)}>{logsOn ? 'Turn off' : 'Turn on'}</Btn>;
      case 'rollback': return <Btn disabled={off(o)} onClick={() => setPending({ kind: 'rollback' })}>Roll back</Btn>;
      case 'hard_reset': return <>
        <label className="ops-unlock"><span>Type <span className="dt-num" style={{ color: 'var(--foreground)' }}>{dev.serial}</span> to unlock</span>
          <input type="text" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" aria-label="Type the serial to unlock hard reset" /></label>
        <Btn cls="red" disabled={off(o) || !unlocked} onClick={() => setPending({ kind: 'reset' })}>Hard reset</Btn></>;
      default: return null;
    }
  };
  const status = (o: Op) => {
    if (!o.last) return '';
    const by = who(o) ? ` by ${who(o)}` : '';
    const t = at(o.state === 'confirmed' && o.confirmed_at ? o.confirmed_at : o.last.at);
    return o.state === 'confirmed' ? `Confirmed ${t}${by}` : o.state === 'sent' ? `Sent ${t}${by}` : `${CHIP[o.state][1]}${by}`;
  };
  const row = (id: string) => {
    const o = byOp[OPKEY[id] ?? id], [title, desc] = INFO[id], btns = buttons(o);
    const [cls, label] = id === 'send_logs' && logsOn !== null ? [logsOn ? 'ok' : 'none', logsOn ? 'On' : 'Off'] : CHIP[o.state];
    return (
      <section key={id} className={`ops-row${id === 'hard_reset' ? ' danger' : ''}`} aria-labelledby={`ops-${id}`}>
        <div className="ops-txt"><h3 id={`ops-${id}`}>{title}</h3><small className="ops-hint">{desc}</small></div>
        <div className="ops-stat"><span className="ops-meta">{status(o)}</span><span className={`ops-st ${cls}`}>{label}</span></div>
        {btns && <div className={`ops-btns${id === 'hard_reset' ? ' full' : ''}`}>{btns}</div>}
      </section>
    );
  };

  return (
    <section className="ops" aria-label="Operations">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 16px' }}>
        <nav className="ops-sub" aria-label="Operations sections">
          {SUBS.map(([k, label]) => <Link key={k} to={href(k)} replace aria-current={sub === k ? 'page' : undefined}>{label}</Link>)}
        </nav>
      </div>
      {sub === 'actions' && (ctl ? <Notice more="Each run is recorded with your name.">You can run every operation on this device.</Notice>
        : <Notice tone="lock" more="Running operations needs device control.">You can see what ran on this device.</Notice>)}
      {!dev.is_online && sub === 'actions' && <Notice tone="warn" more="Restart and diagnostics come back when it reconnects.">This device is offline.</Notice>}
      {sub === 'settings' && <OpsSettings dev={dev} isDark={isDark} onDone={load} data={data} />}
      {sub === 'firmware' && <OpsFirmware dev={dev} isDark={isDark} />}
      {sub === 'logs' && <OpsLogs dev={dev} isDark={isDark} />}
      {sub === 'actions' && (<>
        {data === 'failed' && <EmptyState title="Couldn't load the operation history" description="The server didn't answer. The device is not affected." onRetry={load} />}
        {data === null && <ListSkeleton rows={6} />}
        {data && data !== 'failed' && (<>
          {note && <Notice role="status" tone={note.ok ? 'ok' : 'bad'}>{note.text}</Notice>}
          <div className="ops-list">{rows.map(row)}</div>
          <div>
            <button type="button" className="ops-pill" aria-expanded={showRecent} onClick={() => setShowRecent(v => !v)}>Recent runs ({data.recent.length})</button>
            {showRecent && <div style={{ marginTop: 12 }}>{data.recent.length === 0
              ? <EmptyState icon={RotateCcw} title="No runs yet" description="A restart, update or reset run on this device shows up here with the name of whoever ran it." />
              : <ActivityList label="Recent runs" meId={user?.id} items={data.recent.map(r => ({ at: r.at, title: INFO[r.op]?.[0] ?? r.action, icon: ICON[r.op], actor: r.actor }))}
                  origin={<><strong>Recording started on 29 Oct.</strong> Earlier runs weren't saved, so those operations show Never run.</>} />}</div>}
          </div>
        </>)}
      </>)}
      <Notice tone="lock" more="Ask an admin if a group of devices needs the same update.">Updating many devices at once is for admins.</Notice>
      <ConfirmDialog isDark={isDark} open={!!c} tone={c?.tone}
        title={!pending ? '' : pending.kind === 'update' ? `${downgrade ? 'Install' : 'Update'} ${name} ${downgrade ? '' : 'to '}${pending.fw.version}?` : `${c!.title} ${name}?`}
        body={c?.body} confirmDisabled={pending?.kind === 'reset' && !unlocked} confirmLabel={c?.ok} cancelLabel={c?.cancel} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)} />
    </section>
  );
}
