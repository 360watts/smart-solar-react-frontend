import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../../services/api';
import { useAccess } from '../../../shared/access/useAccess';
import { useAuth } from '../../../contexts/AuthContext';
import { ConfirmDialog } from '../siteHardware/ui';
import { CAL_I, CAL_V, INTERVAL_S } from '../MeterSettingsSection';
import type { Dev } from './DevicePage';
import { ListSkeleton } from './Skeleton';
import { ActivityList, EmptyState, Notice } from '../../../shared/components/Feedback';
import { SlidersHorizontal } from 'lucide-react';
import './opsSettings.css';

// The Settings sub-tab. Scenarios: docs/test-scenarios/viewer-ops-settings.md.
type Op = { op: string; state: string; confirmed_at: string | null; last: { at: string; actor: { id: number; name: string } | null; values: Record<string, unknown> } | null };
type Recent = { at: string; op: string; actor: { id: number; name: string } | null };
type OpsData = { ops: Op[]; recent: Recent[] } | null | 'failed';
type Draft = { auto?: boolean; logs?: boolean; iv?: number | null };

const NAMES: Record<string, string> = { auto_reboot: 'Restart if stalled', fetch_logs: 'Send logs', telemetry_debug: 'Detailed readings', apn: 'Mobile data name', wifi: 'Wi-Fi', meter_interval: 'Publish interval', meter_calibrate: 'Calibration' };
const onOff = (v: unknown) => (v ? 'on' : 'off');
// Staged changes, the label shown, how a value reads, and the existing endpoint each one calls.
const CH = (id: number) => ({
  auto: { label: 'Restart if the inverter stops answering', show: onOff, call: (v: boolean) => apiService.setDeviceAutoReboot(id, v) },
  logs: { label: 'Send logs', show: onOff, call: (v: boolean) => apiService.toggleDeviceLogs(id, v) },
  iv: { label: 'Publish interval', show: (v: number | null) => (v == null ? 'meter default' : `${v / 1000} s`), call: (v: number | null) => apiService.updateDevice(id, { meter_publish_interval_ms: v }) },
}) as Record<keyof Draft, { label: string; show: (v: any) => string; call: (v: any) => Promise<unknown> }>;

const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const when = (iso: string) => {
  const d = new Date(iso), n = Math.round((day(new Date()) - day(d)) / 86_400_000);
  return n <= 0 ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : n === 1 ? 'yesterday' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const valuesText = (v: Record<string, unknown>) => Object.entries(v).filter(([k]) => !/pass/i.test(k))
  .map(([k, x]) => (typeof x === 'boolean' ? onOff(x) : `${k.replace(/_/g, ' ')} ${String(x)}`)).join(', ');

const Sw = ({ on, label, chg, onChange }: { on: boolean; label: string; chg: boolean; onChange: (v: boolean) => void }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} className={`os-tg${chg ? ' chg' : ''}`} onClick={() => onChange(!on)}>
    <span className={`os-sw${on ? ' on' : ''}`} />{on ? 'On' : 'Off'}
  </button>
);
const Row = ({ label, help, st, wide, children }: { label: string; help?: string; st?: [string, string, string?] | null; wide?: boolean; children?: React.ReactNode }) => (
  <div className={`os-set${wide ? ' wide' : ''}`}>
    <div><b>{label}</b>{help && <small>{help}</small>}</div>
    {children && <div className="os-ctl">{children}</div>}
    {st ? <span className="os-st"><span className={`ops-st ${st[0]}`}>{st[1]}</span>{st[2] && <small>{st[2]}</small>}</span> : <span />}
  </div>
);

export default function OpsSettings({ dev, isDark, onDone, data }: { dev: Dev; isDark: boolean; onDone: () => void; data?: OpsData }) {
  const can = useAccess().can('device_control');
  const { user } = useAuth();
  const isMeter = dev.device_type === 'energy_meter';
  const groups = isMeter ? [['meter', 'Meter', 2], ['connection', 'Connection', 1]] as const : [['behaviour', 'Device behaviour', 3], ['connection', 'Connection', 3]] as const;
  const [cur, setCur] = useState<any>(null);
  const [grp, setGrp] = useState<string>(groups[0][0]);
  const [draft, setDraft] = useState<Draft>({});
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<'apn' | 'wifi' | 'dbg' | 'cal' | null>(null);  // which confirm dialog is open
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<{ ok: boolean; text: string }[]>([]);
  const [apn, setApn] = useState({ apn: '', user: '', password: '' });
  const [wifi, setWifi] = useState({ ssid: '', password: '' });
  const [wifiShow, setWifiShow] = useState(false);
  const [cal, setCal] = useState({ mode: 'single' as 'single' | 'three', v: ['230', '230', '230'], i: ['5', '5', '5'] });
  const [dbgHours, setDbgHours] = useState(1);

  const load = useCallback(() => apiService.getDevice(dev.device_id).then(setCur).catch(() => setCur('failed')), [dev.device_id]);
  useEffect(() => { setCur(null); setDraft({}); setResults([]); if (can) load(); }, [load, can]);

  if (!can) return <Notice tone="lock">Settings can be changed by people with device control.</Notice>;
  if (cur === 'failed') return <EmptyState title="Couldn't load this device's settings" description="The server didn't answer. The device is not affected." onRetry={load} />;
  if (cur === null || data === null) return <ListSkeleton rows={6} />;

  const ch = CH(dev.device_id);
  const base: Required<Draft> = { auto: !!cur.auto_reboot_enabled, logs: !!cur.logs_enabled, iv: cur.meter_publish_interval_ms ?? null };
  const val = <K extends keyof Draft>(k: K) => (k in draft ? draft[k] : base[k]) as Required<Draft>[K];
  const stage = (k: keyof Draft, v: any) => setDraft(d => { const n = { ...d, [k]: v }; if (v === base[k]) delete n[k]; return n; });
  const keys = Object.keys(draft) as (keyof Draft)[];
  const ivBad = 'iv' in draft && draft.iv != null && !(draft.iv >= INTERVAL_S[0] * 1000 && draft.iv <= INTERVAL_S[1] * 1000);
  const staged = (k: keyof Draft) => k in draft;
  const ops = data && data !== 'failed' ? data.ops : [];
  const byOp = Object.fromEntries(ops.map(o => [o.op, o]));

  // The state the operations endpoint gives; ops that have no reply signal show Applied from the last run.
  const chip = (id: string, k?: keyof Draft, sent = false): [string, string] | null => {
    if (k && staged(k)) return ['wait', 'Changed, not applied'];
    const o = byOp[id];
    if (!o?.last) return null;
    const s = sent ? 'sent' : o.state;
    if (s === 'confirmed' || s === 'sent') return ['ok', `Applied ${when(o.confirmed_at || o.last.at)}`];
    if (s === 'waiting') return ['wait', 'Waiting'];
    if (s === 'not_confirmed') return ['nc', 'Not confirmed'];
    if (s === 'failed') { const r = o.last.values?.reason; return ['bad', `Device rejected${typeof r === 'string' && r ? `: ${r}` : ''}`]; }
    return null;
  };

  // Send logs is only a flag: On/Off now, when it last changed, and (if the data we already hold says so) when a log file last arrived.
  const logsChip = (): [string, string, string?] => {
    if (staged('logs')) return ['wait', 'Changed, not applied'];
    const o = byOp.fetch_logs, on = base.logs;
    const got = on && o?.last?.values?.enabled === true && o.confirmed_at ? `Last log file received ${when(o.confirmed_at)}` : undefined;
    return [on ? 'ok' : '', `${on ? 'On' : 'Off'}${o?.last ? `, changed ${when(o.last.at)}` : ''}`, got];
  };

  const apply = async () => {
    setBusy(true);
    const left = { ...draft }, res: { ok: boolean; text: string }[] = [];
    for (const k of keys) {
      try { await ch[k].call(draft[k]); res.push({ ok: true, text: `${ch[k].label}: sent.` }); delete left[k]; }
      catch { res.push({ ok: false, text: `${ch[k].label}: couldn't send. It is still waiting to be applied.` }); }
    }
    setDraft(left); setResults(res); setReview(false); setBusy(false);
    await load(); onDone();
  };
  // Send logs is a retained command, so it may be queued while offline; every other setting needs the device online.
  const startReview = () => (dev.is_online || keys.every(k => k === 'logs') ? setReview(true) : setNotice('This device is offline. Changes cannot reach it until it is back online.'));
  const discard = () => { setDraft({}); setNotice(null); };

  const apnError = /\^/.test(apn.apn + apn.user + apn.password) ? "The ^ character can't be used." : '';
  // One shape for every immediate send: call, show the result line, close the dialog, refresh.
  const send = async (call: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try { await call(); setResults([{ ok: true, text: ok }]); } catch { setResults([{ ok: false, text: fail }]); }
    setBusy(false); setAsk(null); await load(); onDone();
  };
  const sendApn = () => send(async () => {
    await apiService.setDeviceApn(dev.device_id, { apn: apn.apn.trim(), ...(apn.user.trim() && { user: apn.user.trim() }), ...(apn.password && { password: apn.password }) });
    setApn({ apn: '', user: '', password: '' });
  }, 'Mobile data name: sent. The gateway restarts to use it.', "Mobile data name: couldn't send.");

  // Wi-Fi is write-only: only the fields typed are sent, and nothing is ever read back.
  const sendWifi = () => send(async () => {
    await apiService.updateDevice(dev.device_id, { ...(wifi.ssid.trim() && { wifi_ssid: wifi.ssid.trim() }), ...(wifi.password && { wifi_password: wifi.password }) });
    setWifi({ ssid: '', password: '' });
  }, 'Wi-Fi: sent. The device reconnects to use it.', "Wi-Fi: couldn't send.");

  const ph = cal.mode === 'single' ? 1 : 3;
  const rng = (x: number, [lo, hi]: readonly [number, number]) => Number.isFinite(x) && x >= lo && x <= hi;
  const vN = cal.v.slice(0, ph).map(Number), iN = cal.i.slice(0, ph).map(s => (s.trim() === '' ? NaN : Number(s)));
  const calError = !vN.every(x => rng(x, CAL_V)) ? `Voltage must be ${CAL_V[0]} to ${CAL_V[1]} V` : !iN.every(x => x === 0 || rng(x, CAL_I)) ? `Current must be 0 (no load) or ${CAL_I[0]} to ${CAL_I[1]} A` : null;
  // Detailed readings: acts at once (own confirm to turn on, none to turn off). Treated as on while telemetry_debug_until is in the future; year 9999 = until turned off.
  const dbgUntil: string | null = cur.telemetry_debug_until && new Date(cur.telemetry_debug_until).getTime() > Date.now() ? cur.telemetry_debug_until : null;
  const dbgForever = !!dbgUntil && new Date(dbgUntil).getUTCFullYear() >= 9999;
  const setDbg = (on: boolean) => send(
    () => (on ? apiService.setDeviceTelemetryDebug(dev.device_id, { hours: dbgHours }) : apiService.clearDeviceTelemetryDebug(dev.device_id)),
    `Detailed readings: ${on ? `on for ${dbgHours} h` : 'off'}.`, "Detailed readings: couldn't send.");
  const sendCal = () => send(() => apiService.calibrateMeter(dev.device_id, { mode: cal.mode, v: vN, i: iN }), 'Calibration: sent. The meter confirms shortly.', "Calibration: couldn't send.");

  const settingRecent = (data && data !== 'failed' ? data.recent : []).filter(r => NAMES[r.op]);
  const sec = (title: string, meta: string, id: string, rows: React.ReactNode) => (
    <section className="os-card" role="tabpanel" aria-labelledby={id}>
      <div className="os-ch"><h3 id={id}>{title}</h3><span className="ops-meta">{meta}</span></div>{rows}
    </section>
  );

  return (
    <div className="os-body">
      <div className="os-main">
        <div role="tablist" aria-label="Setting groups" className="os-tabs">
          {groups.map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={grp === k} className="os-gt" onClick={() => setGrp(k)}>
              {label} <span className="ops-cnt">{n}</span>
              <span className={`os-dot${k === 'connection' ? ' amber' : ''}`} aria-hidden="true" />
            </button>
          ))}
        </div>

        {grp === 'behaviour' && sec('Device behaviour', '3 settings', 'os-h1', <>
          <Row label="Restart if the inverter stops answering" help="Automatic restart after repeated stale readings." st={chip('auto_reboot', 'auto')}>
            <Sw on={val('auto')} label="Restart if the inverter stops answering" chg={staged('auto')} onChange={v => stage('auto', v)} />
          </Row>
          <Row label="Detailed readings" help="Pauses this page's data. Keeps the raw messages only, for debugging."
            st={dbgUntil ? ['nc', dbgForever ? 'On until turned off' : `On until ${when(dbgUntil)}`] : chip('telemetry_debug', undefined, true)}>
            <Sw on={!!dbgUntil} label="Detailed readings" chg={false} onChange={v => (v ? setAsk('dbg') : setDbg(false))} />
          </Row>
          <Row label="Send logs" help="The gateway uploads its log files after each restart." st={logsChip()}>
            <Sw on={val('logs')} label="Send logs" chg={staged('logs')} onChange={v => stage('logs', v)} />
          </Row>
        </>)}

        {grp === 'connection' && sec('Connection', isMeter ? 'Wi-Fi' : 'Mobile data and Wi-Fi', 'os-h2', <>
          {!isMeter && <>
          <Row label="Mobile data name (APN)" help="The gateway restarts when this changes." st={chip('apn')}>
            <input className="os-in" aria-label="APN" maxLength={63} value={apn.apn} onChange={e => setApn(a => ({ ...a, apn: e.target.value }))} />
          </Row>
          <Row label="APN user and password" help="Leave empty if your SIM does not need them.">
            <div className="os-pair">
              <input className="os-in" placeholder="user" aria-label="APN user" maxLength={63} value={apn.user} onChange={e => setApn(a => ({ ...a, user: e.target.value }))} />
              <input className="os-in" type="password" placeholder="password" aria-label="APN password" maxLength={63} value={apn.password} onChange={e => setApn(a => ({ ...a, password: e.target.value }))} />
            </div>
          </Row>
          <div className="os-set wide">
            <div className="os-actions">
              <button type="button" className="ops-btn pri" disabled={!apn.apn.trim() || !!apnError || busy} onClick={() => setAsk('apn')}>Send mobile data settings</button>
              {apnError && <span role="alert" className="ops-meta">{apnError}</span>}
            </div>
          </div>
          </>}
          <Row label="Wi-Fi name" help="The device reconnects when this changes. Neither value is ever shown again." st={chip('wifi')}>
            <input className="os-in" aria-label="Wi-Fi name" maxLength={32} placeholder="Leave empty to keep the current one" autoComplete="off" value={wifi.ssid} onChange={e => setWifi(w => ({ ...w, ssid: e.target.value }))} />
          </Row>
          <Row label="Wi-Fi password">
            <div className="os-pair">
              <input className="os-in" aria-label="Wi-Fi password" type={wifiShow ? 'text' : 'password'} maxLength={63} placeholder="Leave empty to keep the current one" autoComplete="new-password" value={wifi.password} onChange={e => setWifi(w => ({ ...w, password: e.target.value }))} />
              <button type="button" className="ops-btn" onClick={() => setWifiShow(v => !v)}>{wifiShow ? 'Hide password' : 'Show password'}</button>
            </div>
          </Row>
          <div className="os-set wide">
            <div className="os-actions">
              <button type="button" className="ops-btn pri" disabled={(!wifi.ssid.trim() && !wifi.password) || busy} onClick={() => setAsk('wifi')}>Send Wi-Fi settings</button>
            </div>
          </div>
        </>)}

        {grp === 'meter' && sec('Meter', '2 settings', 'os-h3', <>
          <Row label="Publish interval" help={`How often the meter sends readings. ${INTERVAL_S[0]} to ${INTERVAL_S[1]} seconds, empty for the meter default.`} st={chip('meter_interval', 'iv')}>
            <div className="os-unit">
              <input className={`os-in${staged('iv') ? ' chg' : ''}`} type="number" aria-label="Publish interval (seconds)" min={INTERVAL_S[0]} max={INTERVAL_S[1]} placeholder="5 (default)"
                value={val('iv') == null ? '' : String(val('iv')! / 1000)} onChange={e => stage('iv', e.target.value === '' ? null : Math.round(Number(e.target.value) * 1000))} />
              <span className="ops-meta">seconds</span>
            </div>
            {ivBad && <span role="alert" className="ops-meta os-bad">Enter {INTERVAL_S[0]} to {INTERVAL_S[1]} seconds</span>}
          </Row>
          <Row label="Calibration" help="Put a known reference load on first. The meter recalibrates as soon as it receives this." st={chip('meter_calibrate')}>
            {dev.is_online
              ? <button type="button" className="ops-btn pri" disabled={!!calError || busy} onClick={() => setAsk('cal')}>Calibrate meter</button>
              : <Notice tone="warn" more="Calibration needs it online.">The meter is offline.</Notice>}
          </Row>
          <div className="os-set wide">
            <div className="os-cal">
              <div role="radiogroup" aria-label="Phases" className="os-pair">
                {(['single', 'three'] as const).map(m => <button key={m} type="button" role="radio" aria-checked={cal.mode === m} className="ops-pill" onClick={() => setCal(c => ({ ...c, mode: m }))}>{m === 'single' ? 'Single-phase' : 'Three-phase'}</button>)}
              </div>
              {[0, 1, 2].slice(0, ph).map(n => (
                <div key={n} className="os-pair">
                  <label className="ops-meta">{ph === 1 ? 'Voltage (V)' : `Phase ${'ABC'[n]} voltage (V)`}
                    <input className="os-in" type="number" value={cal.v[n]} onChange={e => setCal(c => ({ ...c, v: c.v.map((x, k) => (k === n ? e.target.value : x)) }))} /></label>
                  <label className="ops-meta">{ph === 1 ? 'Current (A)' : `Phase ${'ABC'[n]} current (A)`}
                    <input className="os-in" type="number" value={cal.i[n]} onChange={e => setCal(c => ({ ...c, i: c.i.map((x, k) => (k === n ? e.target.value : x)) }))} /></label>
                </div>
              ))}
              {calError && <span role="alert" className="ops-meta os-bad">{calError}</span>}
            </div>
          </div>
        </>)}

        {notice && <Notice role="status" tone="bad">{notice}</Notice>}
        {results.length > 0 && <div role="status" style={{ display: 'grid', gap: 8 }}>{results.map((r, i) => <Notice key={i} tone={r.ok ? 'ok' : 'bad'}>{r.text}</Notice>)}</div>}

        {keys.length > 0 && (
          <div className="os-bar">
            <span className="os-bar-n">{keys.length} change{keys.length === 1 ? '' : 's'} not applied</span>
            <span className="os-bar-t">{keys.map(k => `${ch[k].label}: ${ch[k].show(base[k])} to ${ch[k].show(draft[k])}`).join('. ')}.</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="os-bar-b" onClick={discard}>Discard</button>
            <button type="button" className="os-bar-b pri" disabled={ivBad || busy} onClick={startReview}>Review and apply</button>
          </div>
        )}
      </div>

      <aside className="ops-side os-side" aria-labelledby="os-hist">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}><h3 id="os-hist">Setting changes</h3><span className="ops-cnt">{settingRecent.length}</span></div>
        {settingRecent.length === 0
          ? <EmptyState icon={SlidersHorizontal} title="No setting changes yet" description="Changes you apply here show up with the name of whoever made them." />
          : <ActivityList label="Setting changes" meId={user?.id} items={settingRecent.map(r => {
              const v = byOp[r.op]?.last?.at === r.at ? valuesText(byOp[r.op]!.last!.values) : '';
              return { at: r.at, title: NAMES[r.op], icon: SlidersHorizontal, actor: r.actor, detail: v && <span className="dt-num">{v}</span> };
            })} />}
        <div style={{ marginTop: 12 }}><Notice tone="lock" more="Settings you cannot change are not shown.">Which settings you can change depends on your access.</Notice></div>
      </aside>

      <ConfirmDialog isDark={isDark} open={review} tone="primary" title="Apply these changes?" busy={busy} confirmLabel="Apply" cancelLabel="Not yet"
        body={<><ul>{keys.map(k => <li key={k}>{ch[k].label}: {ch[k].show(base[k])} to {ch[k].show(draft[k])}</li>)}</ul>{!dev.is_online && <p>This gateway is offline. The change is delivered when it reconnects.</p>}</>}
        onConfirm={apply} onCancel={() => setReview(false)} />
      <ConfirmDialog isDark={isDark} open={ask === 'apn'} tone="primary" title="Send the new APN?" busy={busy} confirmLabel="Send" cancelLabel="Cancel"
        body="The gateway restarts to use it and is offline for about a minute. If the APN is wrong it can't reach the cloud over mobile data until Wi-Fi is back."
        onConfirm={sendApn} onCancel={() => setAsk(null)} />
      <ConfirmDialog isDark={isDark} open={ask === 'wifi'} tone="primary" title="Send the new Wi-Fi settings?" busy={busy} confirmLabel="Send" cancelLabel="Cancel"
        body="The device will reconnect to use them and may go offline for about a minute. If the name or password is wrong it stays offline until someone corrects them."
        onConfirm={sendWifi} onCancel={() => setAsk(null)} />
      <ConfirmDialog isDark={isDark} open={ask === 'dbg'} tone="primary" title="Turn on detailed readings?" busy={busy} confirmLabel="Turn on" cancelLabel="Not now"
        body={<>While this is on, this page's data stops updating, and the device's readings are only stored raw: no checks, no alerts. It turns off by itself after the time you pick.
          <label style={{ display: 'block', marginTop: 10 }}>Keep it on for <select value={dbgHours} onChange={e => setDbgHours(Number(e.target.value))}>{[1, 6, 24].map(h => <option key={h} value={h}>{h} h</option>)}</select></label></>}
        onConfirm={() => setDbg(true)} onCancel={() => setAsk(null)} />
      <ConfirmDialog isDark={isDark} open={ask === 'cal'} tone="primary" title="Calibrate this meter?" busy={busy} confirmLabel="Calibrate" cancelLabel="Not yet"
        body={`The meter will recalibrate straight away against ${ph === 1 ? 'one phase' : 'all three phases'}. Make sure the reference load is on now.`}
        onConfirm={sendCal} onCancel={() => setAsk(null)} />
    </div>
  );
}
