import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiService, DeviceEvent } from '../../services/api';
import { useTokens, Btn, Field, controlStyle, DetailsToggle, ConfirmDialog } from './siteHardware/ui';

// What firmware V2 gateways report: Wi-Fi join failures, refused settings, backup battery, event history, APN.
// V1 gateways send none of it, so the card just says "No activity yet". Scenarios: docs/test-scenarios/gateway-activity.md.

export type GatewayFields = {
  wifi_failure?: { ssid?: string; reason?: string } | null;
  config_rejected?: string;
  battery_pct?: number | null;
};

const SHOWN = 15;
const QUIET = new Set(['diag', 'mqtt_connected']); // routine; behind "Show health checks"

const WIFI_REASON: Record<string, string> = {
  auth_failed: 'wrong password', no_ap: 'network not found', ap_not_found: 'network not found', timeout: 'timed out',
};
// Firmware OTA error codes (backend api/services/device_events.py OTA_ERROR_CODES), in plain words.
const OTA_REASON: Record<number, string> = {
  1: 'bad update request', 2: 'already updating', 3: 'same update sent twice', 4: 'storage problem',
  5: 'file size did not match', 6: 'download failed', 7: 'download link expired', 8: 'download kept stalling',
  9: 'could not write the update', 10: 'file check failed', 11: 'took longer than 9 minutes',
  12: 'out of memory', 13: 'battery too low',
};
const COMMAND: Record<string, string> = { reboot: 'restart', reset: 'hard reset', hard_reset: 'hard reset', log: 'log upload' };

const words = (s: string) => s.replace(/_/g, ' ');
const wifiReason = (r?: string) => (r ? WIFI_REASON[r] ?? words(r) : '');

/** Plain-language line for one event, and whether it is a problem. */
export function describe(e: DeviceEvent): { text: string; problem: boolean } {
  const p = e.payload || {};
  switch (e.event) {
    case 'ota_started': return { text: 'Firmware update started', problem: false };
    case 'ota_progress': return { text: `Downloading firmware: ${p.percent ?? '?'}%`, problem: false };
    case 'ota_success': return { text: 'Firmware installed, restarting', problem: false };
    case 'ota_interrupted': return { text: 'Firmware download paused (connection dropped); it will resume', problem: false };
    case 'ota_rejected_busy': return { text: 'Firmware update skipped: another one is running', problem: false };
    case 'ota_failed': {
      const why = OTA_REASON[Number(p.errorCode)];
      return { text: `Firmware update failed${why ? `: ${why}` : ''}`, problem: true };
    }
    case 'uplink_wifi': return { text: 'Switched to Wi-Fi', problem: false };
    case 'uplink_cellular': return { text: 'Switched to mobile data', problem: false };
    case 'wifi_failed': {
      const why = wifiReason(p.reason);
      return { text: `Couldn't join Wi-Fi${p.ssid ? ` ${p.ssid}` : ''}${why ? `: ${why}` : ''}`, problem: true };
    }
    case 'config_rejected': return { text: 'Refused the new settings', problem: true };
    case 'command_deferred':
      return { text: `Postponed ${COMMAND[p.command] ?? words(String(p.command ?? 'a command'))} (busy); it runs within 20 minutes`, problem: false };
    case 'time_synced': return { text: 'Clock set', problem: false };
    case 'mqtt_connected': return { text: 'Connected to the cloud', problem: false };
    case 'offline_discarded': return { text: 'A saved-data upload could not be read (kept for engineers)', problem: true };
    case 'offline_partial': return { text: 'A saved-data upload was partly unreadable (kept for engineers)', problem: true };
    case 'diag': {
      const bits = [p.net_active_text && `network ${p.net_active_text}`, p.data_status_text && `inverter link ${p.data_status_text}`];
      return { text: `Health check${bits.some(Boolean) ? `: ${bits.filter(Boolean).join(', ')}` : ''}`, problem: p.data_status ? p.data_status !== 0 : false };
    }
    default: return { text: words(e.event || 'event'), problem: false };
  }
}

const at = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const GatewayActivity: React.FC<{ deviceId: number; isDark: boolean; device?: GatewayFields; allowApn?: boolean; allowCheck?: boolean }> = ({
  deviceId, isDark, device, allowApn = false, allowCheck = false,
}) => {
  const t = useTokens(isDark);
  const [events, setEvents] = useState<DeviceEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showQuiet, setShowQuiet] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [apnOpen, setApnOpen] = useState(false);
  const [apn, setApn] = useState({ apn: '', user: '', password: '' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apnMsg, setApnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    apiService.getDeviceEvents(deviceId).then(r => setEvents(r.results ?? []), () => setFailed(true));
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

  const visible = (events ?? []).filter(e => showQuiet || !QUIET.has(e.event));
  const rows = showAll ? visible : visible.slice(0, SHOWN);
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
      setShowQuiet(true); // the result is a health check, which is hidden by default
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
    <section aria-label="Gateway activity" style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: t.body, color: t.ink }}>
      <h3 style={{ margin: 0, fontFamily: t.head, fontSize: '1.02rem' }}>Gateway activity</h3>

      {notes.map(n => (
        <div key={n} role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: t.waitBg, color: t.waitInk, fontSize: '0.88rem', lineHeight: 1.45 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{n}</span>
        </div>
      ))}
      {device?.battery_pct != null && <span style={{ fontSize: '0.88rem' }}>Backup battery {device.battery_pct}%</span>}

      {failed ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.88rem', color: t.ink2 }}>
          Couldn't load activity.
          <Btn isDark={isDark} size="sm" variant="plain" onClick={load}>Try again</Btn>
        </div>
      ) : events === null ? (
        <span style={{ fontSize: '0.88rem', color: t.ink2 }}>Loading…</span>
      ) : visible.length === 0 ? (
        <span style={{ fontSize: '0.88rem', color: t.ink2 }}>No activity yet. Older gateways don't report it.</span>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(e => {
            const d = describe(e);
            return (
              <li key={e.id} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                <span style={{ color: d.problem ? t.waitInk : t.ink, fontWeight: d.problem ? 600 : 400, minWidth: 0, overflowWrap: 'anywhere' }}>{d.text}</span>
                <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.78rem', color: t.ink2, whiteSpace: 'nowrap' }}>{at(e.received_at)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {events !== null && !failed && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {visible.length > SHOWN && (
            <Btn isDark={isDark} size="sm" variant="plain" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${visible.length}`}</Btn>
          )}
          {events.some(e => QUIET.has(e.event)) && (
            <Btn isDark={isDark} size="sm" variant="plain" onClick={() => setShowQuiet(v => !v)}>{showQuiet ? 'Hide health checks' : 'Show health checks'}</Btn>
          )}
        </div>
      )}
      <span style={{ fontSize: '0.78rem', color: t.ink2 }}>Kept for 30 days.</span>

      {allowCheck && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <Btn isDark={isDark} size="sm" variant="plain" disabled={checking} onClick={runCheck}>{checking ? 'Sending…' : 'Run health check'}</Btn>
          {checkMsg && <span role="status" style={{ fontSize: '0.82rem', color: checkMsg.ok ? t.goodInk : t.waitInk }}>{checkMsg.text}</span>}
        </div>
      )}

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
