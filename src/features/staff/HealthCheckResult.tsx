import React, { useState } from 'react';
import { DeviceEvent } from '../../services/api';
import { useTokens, DetailsToggle } from './siteHardware/ui';

// One firmware V2 health check (data/diag) as a checklist plus the raw values.
// Codes are from MQTT_Interface_Reference.pdf section 3.6. Scenarios: docs/test-scenarios/gateway-activity.md (H4-H12).

export type CheckState = 'ok' | 'look' | 'na';
export type Check = { name: string; state: CheckState; text: string };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const gb = (mb: number) => `${(mb / 1000).toFixed(1)} GB`;
const wifiBand = (dbm: number) => (dbm >= -67 ? 'good' : dbm >= -75 ? 'fair' : 'weak');
// Modem quality 0-31, dBm = -113 + 2 x CSQ (0 = not measured).
const cellDbm = (csq: number) => -113 + 2 * csq;

const WIFI_WHY: Record<number, string> = { 11: 'network not found', 12: 'wrong password', 13: 'could not get an address' };
const DATA_WHY: Record<number, string> = { 51: 'Not answering. Check the RS-485 wiring.', 52: 'Reading has stopped.', 53: 'Not set up yet. Send it a configuration.' };

/** The six plain-language checks for one health-check payload. */
export function healthChecks(p: Record<string, any>, deviceTs: string | null): Check[] {
  const net = num(p.net_active);
  const wifiSt = num(p.wifi_status), rssi = num(p.wifi_rssi);
  const cellSt = num(p.cell_status), csq = num(p.cell_csq);
  const mqttSt = num(p.mqtt_status), lat = num(p.mqtt_latency_ms);
  const dataSt = num(p.data_status), devs = num(p.data_devices);
  const sdSt = num(p.sd_status), sdSize = num(p.sd_size), sdFree = num(p.sd_free);
  const out: Check[] = [];

  if (net === 0) out.push({ name: 'Internet', state: 'look', text: `No connection${wifiSt ? `: Wi-Fi ${WIFI_WHY[wifiSt] ?? 'problem'}` : ''}.` });
  else if (net === 2) out.push({ name: 'Internet', state: 'ok', text: `On mobile data${csq ? `, signal ${cellDbm(csq)} dBm` : ''}` });
  else if (wifiSt && wifiSt !== 0) out.push({ name: 'Internet', state: 'look', text: `Wi-Fi: ${WIFI_WHY[wifiSt] ?? 'problem'}` });
  else {
    const band = rssi ? wifiBand(rssi) : null;
    out.push({ name: 'Internet', state: band === 'weak' ? 'look' : 'ok', text: `On Wi-Fi${rssi ? `, signal ${band} (${rssi} dBm)` : ''}` });
  }

  if (mqttSt === 0) out.push({ name: 'Cloud', state: 'ok', text: lat ? `Connected, replies in ${lat} ms` : 'Connected' });
  else out.push({ name: 'Cloud', state: 'look', text: mqttSt === 41 ? "Can't reach the cloud." : 'Not connected.' });

  if (dataSt === 0) out.push({ name: 'Inverter link', state: 'ok', text: `Answering, ${devs ?? 0} device${devs === 1 ? '' : 's'} set up` });
  else out.push({ name: 'Inverter link', state: 'look', text: DATA_WHY[dataSt ?? -1] ?? 'Problem with the inverter link.' });

  if (sdSt === 0) out.push({ name: 'Memory card', state: 'ok', text: sdSize != null && sdFree != null ? `${gb(sdFree)} free of ${gb(sdSize)}` : 'OK' });
  else out.push({ name: 'Memory card', state: 'look', text: sdSt === 31 ? 'No card inserted.' : sdSt === 33 ? 'Card is full.' : 'Card problem.' });

  out.push(deviceTs
    ? { name: 'Clock', state: 'ok', text: `Set (${new Date(deviceTs).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})` }
    : { name: 'Clock', state: 'look', text: 'Not set yet. It sets itself once online.' });

  // Wi-Fi-only gateways have no SIM, so "not registered" matters only when nothing else is connected.
  if (cellSt === 0) out.push({ name: 'Mobile data', state: 'ok', text: csq ? `Registered, signal ${cellDbm(csq)} dBm` : 'Registered' });
  else if (cellSt === 22 && net === 0) out.push({ name: 'Mobile data', state: 'look', text: 'Not registered on the network. Check the SIM and APN.' });
  else out.push({ name: 'Mobile data', state: 'na', text: 'Not used' });
  return out;
}

export function checkSummary(checks: Check[]): string {
  const counted = checks.filter(c => c.state !== 'na');
  const bad = counted.filter(c => c.state === 'look').length;
  return bad === 0 ? 'All good' : `${counted.length - bad} of ${counted.length} fine, ${bad} need${bad === 1 ? 's' : ''} a look`;
}

/** The 14 values as the gateway sent them. */
export function rawRows(p: Record<string, any>, deviceTs: string | null): [string, string][] {
  const v = (x: unknown, unit = '') => (x === undefined || x === null || x === '' ? 'n/a' : `${x}${unit}`);
  const named = (x: unknown, label: string) => (x === undefined || x === null ? 'n/a' : `${x} (${label})`);
  return [
    ['Time', deviceTs ? new Date(deviceTs).toLocaleString('en-IN') : 'not set'],
    ['Started by', p.trigger === 1 ? '1 (cloud)' : p.trigger === 2 ? '2 (BOOT button)' : v(p.trigger)],
    ['SD status', v(p.sd_status)], ['SD size', v(p.sd_size, ' MB')], ['SD free', v(p.sd_free, ' MB')],
    ['Data status', v(p.data_status)], ['Data devices', v(p.data_devices)],
    ['Active network', named(p.net_active, String(p.net_active_text ?? 'unknown'))],
    ['Wi-Fi status', v(p.wifi_status)], ['Wi-Fi signal', v(p.wifi_rssi, ' dBm')],
    ['Cell status', v(p.cell_status)], ['Cell signal', p.cell_csq === 0 ? '0 (unknown)' : v(p.cell_csq)],
    ['MQTT status', v(p.mqtt_status)], ['MQTT reply', v(p.mqtt_latency_ms, ' ms')],
  ];
}

/** One tile per check; a problem turns amber, "not used" stays quiet. */
export const CheckTiles: React.FC<{ checks: Check[]; isDark: boolean }> = ({ checks, isDark }) => {
  const t = useTokens(isDark);
  return (
    <ul aria-label="Health check result" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
      {checks.map(c => (
        <li key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 14px', borderRadius: 16, background: c.state === 'look' ? t.waitBg : t.idleBg }}>
          <span style={{ fontSize: '0.78rem', color: c.state === 'look' ? t.waitInk : t.ink2 }}>{c.name}</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 500, color: c.state === 'look' ? t.waitInk : c.state === 'na' ? t.ink2 : t.ink, overflowWrap: 'anywhere' }}>{c.text}</span>
        </li>
      ))}
    </ul>
  );
};

/** The 14 values as a table, closed until asked for. */
export const RawValues: React.FC<{ event: DeviceEvent; isDark: boolean }> = ({ event, isDark }) => {
  const t = useTokens(isDark);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${t.line2}`, paddingTop: 4 }}>
      <DetailsToggle isDark={isDark} label="All 14 values" open={open} onToggle={() => setOpen(v => !v)} />
      {open && (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', columnGap: 20 }}>
          {rawRows(event.payload || {}, event.device_ts).map(([k, val]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderTop: `1px solid ${t.line2}`, fontSize: '0.85rem' }}>
              <dt style={{ color: t.ink2 }}>{k}</dt>
              <dd style={{ margin: 0, fontFamily: 'Fira Code, monospace', textAlign: 'right' }}>{val}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};
