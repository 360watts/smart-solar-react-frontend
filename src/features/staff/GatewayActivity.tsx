import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiService, DeviceEvent } from '../../services/api';
import { useTokens, Btn, Field, controlStyle, DetailsToggle, ConfirmDialog } from './siteHardware/ui';
import { CheckTiles, RawValues, healthChecks, Check } from './HealthCheckResult';

// What firmware V2 gateways report: Wi-Fi join failures, refused settings, backup battery, health check, APN.
// V1 gateways send none of it, so the card stays empty. Scenarios: docs/test-scenarios/gateway-activity.md.

export type GatewayFields = {
  wifi_failure?: { ssid?: string; reason?: string } | null;
  config_rejected?: string;
  battery_pct?: number | null;
};

const WIFI_REASON: Record<string, string> = {
  auth_failed: 'wrong password', no_ap: 'network not found', ap_not_found: 'network not found', timeout: 'timed out',
};
const words = (s: string) => s.replace(/_/g, ' ');
const wifiReason = (r?: string) => (r ? WIFI_REASON[r] ?? words(r) : '');

const at = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const GatewayActivity: React.FC<{ deviceId: number; isDark: boolean; device?: GatewayFields; allowApn?: boolean; allowCheck?: boolean }> = ({
  deviceId, isDark, device, allowApn = false, allowCheck = false,
}) => {
  const t = useTokens(isDark);
  const [events, setEvents] = useState<DeviceEvent[] | null>(null);
  const [apnOpen, setApnOpen] = useState(false);
  const [apn, setApn] = useState({ apn: '', user: '', password: '' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apnMsg, setApnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    apiService.getDeviceEvents(deviceId).then(r => setEvents(r.results ?? []), () => setEvents([]));
  }, [deviceId]);
  useEffect(load, [load]);

  const notes: string[] = [];
  if (device?.wifi_failure) {
    const { ssid, reason } = device.wifi_failure;
    notes.push(`Couldn't join Wi-Fi${ssid ? ` ${ssid}` : ''}${reason ? `: ${wifiReason(reason)}` : ''}. Check the network name and password.`);
  }
  if (device?.config_rejected) {
    const [id, ver] = device.config_rejected.split(':');
    notes.push(`The gateway refused settings ${id}${ver ? ` v${ver}` : ''}. Fix the preset and save it again; it won't be resent until then.`);
  }

  const diags = (events ?? []).filter(e => e.event === 'diag');
  const shownCheck = diags.find(e => e.id === pickedId) ?? diags[0];
  const checks: Check[] = [
    ...(shownCheck ? healthChecks(shownCheck.payload || {}, shownCheck.device_ts) : []),
    ...(device?.battery_pct != null ? [{ name: 'Backup battery', state: 'ok' as const, text: `${device.battery_pct}% charged` }] : []),
  ];
  const bad = checks.filter(c => c.state === 'look').length + notes.length;
  const apnError = /\^/.test(apn.apn + apn.user + apn.password) ? "The ^ character can't be used." : '';

  const sendApn = async () => {
    setBusy(true);
    try {
      const body: { apn: string; user?: string; password?: string } = { apn: apn.apn.trim() };
      if (apn.user.trim()) body.user = apn.user.trim();
      if (apn.password) body.password = apn.password;
      await apiService.setDeviceApn(deviceId, body);
      setApnMsg({ ok: true, text: 'Sent. The gateway restarts to use it (newer firmware only).' });
      setApn({ apn: '', user: '', password: '' });
    } catch (err) {
      setApnMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't send the APN." });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const runCheck = async () => {
    setChecking(true);
    setCheckMsg(null);
    try {
      await apiService.runDeviceDiagnostics(deviceId);
      setPickedId(null); // show the newest result when it arrives
      setCheckMsg({ ok: true, text: 'Sent. The result appears below in about half a minute (newer firmware only).' });
      setTimeout(load, 15000);
      setTimeout(load, 30000);
    } catch (err) {
      setCheckMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't send the health check." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section aria-label="Gateway activity" style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 22, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: t.body, color: t.ink }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h3 style={{ margin: 0, fontFamily: t.head, fontSize: '1.05rem' }}>Gateway activity</h3>
          {shownCheck && <span style={{ fontSize: '0.82rem', color: t.ink2 }}>Health check {at(shownCheck.received_at)}</span>}
        </div>
        {(shownCheck || bad > 0) && (
          <span style={{ padding: '6px 12px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, background: bad ? t.waitBg : t.goodBg, color: bad ? t.waitInk : t.goodInk }}>
            {bad ? `${bad} need${bad === 1 ? 's' : ''} a look` : 'All good'}
          </span>
        )}
      </div>

      {notes.map(n => (
        <div key={n} role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: t.waitBg, color: t.waitInk, fontSize: '0.88rem', lineHeight: 1.45 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{n}</span>
        </div>
      ))}

      {checks.length > 0 && <CheckTiles checks={checks} isDark={isDark} />}

      {allowCheck && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn isDark={isDark} disabled={checking} onClick={runCheck}>{checking ? 'Sending…' : shownCheck ? 'Run again' : 'Run health check'}</Btn>
          {checkMsg && <span role="status" style={{ fontSize: '0.82rem', color: checkMsg.ok ? t.goodInk : t.waitInk }}>{checkMsg.text}</span>}
        </div>
      )}

      {shownCheck && <RawValues event={shownCheck} isDark={isDark} />}

      {allowApn && (
        <div style={{ borderTop: `1px solid ${t.line2}`, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DetailsToggle isDark={isDark} label="Mobile data settings (APN)" open={apnOpen} onToggle={() => setApnOpen(v => !v)} />
          {apnOpen && <>
            <span style={{ fontSize: '0.82rem', color: t.ink2 }}>Only for gateways with a SIM card. Ask the SIM provider for these values.</span>
            <Field isDark={isDark} label="APN"><input value={apn.apn} maxLength={63} onChange={e => setApn(a => ({ ...a, apn: e.target.value }))} style={controlStyle(isDark)} /></Field>
            <Field isDark={isDark} label="User name (optional)"><input value={apn.user} maxLength={63} onChange={e => setApn(a => ({ ...a, user: e.target.value }))} style={controlStyle(isDark)} /></Field>
            <Field isDark={isDark} label="Password (optional)"><input type="password" value={apn.password} maxLength={63} onChange={e => setApn(a => ({ ...a, password: e.target.value }))} style={controlStyle(isDark)} /></Field>
            {apnError && <span role="alert" style={{ fontSize: '0.82rem', color: t.waitInk }}>{apnError}</span>}
            {apnMsg && <span role="status" style={{ fontSize: '0.82rem', color: apnMsg.ok ? t.goodInk : t.waitInk }}>{apnMsg.text}</span>}
            <div><Btn isDark={isDark} size="sm" disabled={!apn.apn.trim() || !!apnError || busy} onClick={() => { setApnMsg(null); setConfirming(true); }}>Save APN</Btn></div>
          </>}
        </div>
      )}

      <ConfirmDialog
        isDark={isDark}
        open={confirming}
        tone="primary"
        title="Send the new APN?"
        body="The gateway restarts to use it and is offline for about a minute. If the APN is wrong it can't reach the cloud over mobile data until Wi-Fi is back."
        confirmLabel="Send"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={sendApn}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};

export default GatewayActivity;
