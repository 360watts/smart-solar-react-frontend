import { HeartPulse } from 'lucide-react';
import { EmptyState, Notice } from '../../../shared/components/Feedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { apiService, DeviceEvent } from '../../../services/api';
import { Check, healthChecks, rawRows } from '../HealthCheckResult';
import { ListSkeleton } from './Skeleton';
import './opsHealth.css';

// Operations > Logs > Gateway health: what the logs say for a day (scan), the latest diagnostics report as tiles, notes that need action, the last 5 reports.
// Running diagnostics lives in the Actions list. Same data as GatewayActivity (kept for the staff device page). Scenarios: docs/test-scenarios/viewer-operations-flex.md (HL1-HL18).

export type HealthDevice = { wifi_failure?: { ssid?: string; reason?: string } | null; config_rejected?: string; battery_pct?: number | null };
type Scan = { files_scanned: number; total_errors: number; total_warnings: number };

const WIFI_REASON: Record<string, string> = { auth_failed: 'wrong password', no_ap: 'network not found', ap_not_found: 'network not found', timeout: 'timed out' };
const wifiReason = (r: string) => WIFI_REASON[r] ?? r.replace(/_/g, ' ');
const at = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ago = (iso: string) => { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`; };
const looks = (cs: Check[]) => cs.filter(c => c.state === 'look').length;
const verdict = (n: number) => (n ? `${n} need${n === 1 ? 's' : ''} a look` : 'All good');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export default function OpsHealth({ deviceId, device }: { deviceId: number; device?: HealthDevice }) {
  const [params] = useSearchParams();
  const [events, setEvents] = useState<DeviceEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [scanDate, setScanDate] = useState(today);
  const [scan, setScan] = useState<{ date: string; r: Scan } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const alive = useRef(true);

  const load = useCallback(() => {
    setFailed(false);
    apiService.getDeviceEvents(deviceId).then(r => { if (alive.current) setEvents(r.results ?? []); }, () => { if (alive.current) { setFailed(true); setEvents(null); } });
  }, [deviceId]);
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);

  const runScan = async () => {
    setScanning(true); setScanErr('');
    try {
      const r = await apiService.scanDeviceLogFiles(deviceId, scanDate);
      if (alive.current) setScan({ date: scanDate, r });
    } catch { if (alive.current) setScanErr("Couldn't scan those logs. Try again."); }
    finally { if (alive.current) setScanning(false); }
  };
  const withParam = (k: string, v: string | null) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); return `?${p.toString()}`; };

  const notes: { text: string; wifi?: boolean }[] = [];
  if (device?.wifi_failure) {
    const { ssid, reason } = device.wifi_failure;
    notes.push({ text: `Couldn't join Wi-Fi${ssid ? ` ${ssid}` : ''}${reason ? `: ${wifiReason(reason)}` : ''}. Check the network name and password.`, wifi: true });
  }
  if (device?.config_rejected) {
    const [id, ver] = device.config_rejected.split(':');
    notes.push({ text: `The gateway refused settings ${id}${ver ? ` v${ver}` : ''}. Fix the preset and save it again; it won't be resent until then.` });
  }

  if (failed) return (
    <section aria-label="Gateway health" className="ohl">
      <h3 className="ohl-h">Gateway health</h3>
      <EmptyState title="Couldn't load the health history" description="The server didn't answer. The device is not affected." onRetry={load} />
    </section>
  );
  if (events === null) return <section aria-label="Gateway health" className="ohl"><h3 className="ohl-h">Gateway health</h3><ListSkeleton rows={4} /></section>;

  const diags = events.filter(e => e.event === 'diag');
  const shown = diags.find(e => e.id === pickedId) ?? diags[0];
  const checks: Check[] = [
    ...(shown ? healthChecks(shown.payload || {}, shown.device_ts) : []),
    ...(device?.battery_pct != null ? [{ name: 'Backup battery', state: 'ok' as const, text: `${device.battery_pct}% charged` }] : []),
  ];
  const tiles = [...checks.filter(c => c.state === 'look'), ...checks.filter(c => c.state !== 'look')];
  const bad = looks(checks) + notes.length;

  return (
    <section aria-label="Gateway health" className="ohl">
      <div className="ohl-head">
        <div className="ohl-title">
          <h3 className="ohl-h">Gateway health</h3>
          {shown || notes.length ? <span className={`ops-st ${bad ? 'nc' : 'ok'}`}>{verdict(bad)}</span> : <span className="ops-st none">No health report yet</span>}
          {diags[0] && <span className="ops-meta">Last report {at(diags[0].received_at)} ({ago(diags[0].received_at)})</span>}
        </div>
        <div className="ops-btns">
          <input type="date" className="ofw-in" aria-label="Day to scan" value={scanDate} max={today()} onChange={e => setScanDate(e.target.value)} />
          <button type="button" className="ops-btn pri" disabled={scanning || !scanDate} onClick={runScan}>{scanning ? 'Scanning…' : 'Scan logs'}</button>
        </div>
      </div>

      {scanErr && <Notice role="alert" tone="bad">{scanErr}</Notice>}
      {scan && (scan.r.files_scanned === 0
        ? <p role="status" className="ops-meta">No log files from {scan.date} to scan.</p>
        : (
          <div role="status" className="ohl-scan">
            <ul className="ohl-tiles" aria-label="Log scan result">
              <li aria-label="Scan errors" className={`ohl-tile ${scan.r.total_errors ? 'look' : 'ok'}`}>
                <div className="ohl-tn"><span>Errors</span><span className={`ops-st ${scan.r.total_errors ? 'bad' : 'ok'}`}>{scan.r.total_errors}</span></div>
                <span className="ohl-tt">{scan.r.total_errors ? 'Open the log files above and filter to errors.' : 'No errors logged.'}</span>
              </li>
              <li aria-label="Scan warnings" className={`ohl-tile ${scan.r.total_warnings ? 'look' : 'ok'}`}>
                <div className="ohl-tn"><span>Warnings</span><span className={`ops-st ${scan.r.total_warnings ? 'nc' : 'ok'}`}>{scan.r.total_warnings}</span></div>
                <span className="ohl-tt">{scan.r.total_warnings ? 'Worth a look, not always a fault.' : 'No warnings logged.'}</span>
              </li>
            </ul>
            <span className="ops-meta">Scanned {plural(scan.r.files_scanned, 'log file')} from {scan.date}.</span>
          </div>
        ))}

      {notes.length > 0 && (
        <div className="ohl-notes">
          {notes.map(n => (
            <div key={n.text} role="status" className="ohl-alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{n.text}</span>
              {n.wifi && <Link to={withParam('ops', 'settings')} className="ohl-link">Change Wi-Fi</Link>}
            </div>
          ))}
        </div>
      )}

      {tiles.length > 0 ? (
        <ul className="ohl-tiles" aria-label="Health report">
          {tiles.map(c => (
            <li key={c.name} aria-label={`Check ${c.name}`} className={`ohl-tile ${c.state}`}>
              <div className="ohl-tn"><span>{c.name}</span><span className={`ops-st ${c.state === 'look' ? 'nc' : c.state === 'ok' ? 'ok' : 'none'}`}>{c.state === 'look' ? 'Look' : c.state === 'ok' ? 'OK' : 'Not used'}</span></div>
              <span className="ohl-tt">{c.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={HeartPulse} title="Waiting for the first report"
          description={<>Use Run diagnostics in <Link to={withParam('ops', null)} replace>Actions</Link>. Older firmware does not report health.</>} />
      )}

      {diags.length > 0 && (
        <div className="ohl-hist">
          <h4 className="ohl-h4">History</h4>
          <ul className="ops-list">
            {diags.slice(0, 5).map(d => {
              const n = looks(healthChecks(d.payload || {}, d.device_ts));
              return (
                <li key={d.id}>
                  <button type="button" className="ohl-hrow" aria-pressed={d.id === shown?.id} aria-label={`Health report ${at(d.received_at)}, ${verdict(n)}`} onClick={() => setPickedId(d.id)}>
                    <span className={`ohl-dot ${n ? 'nc' : 'ok'}`} aria-hidden="true" />
                    <span>{at(d.received_at)}</span>
                    <span className="ops-meta">{n ? `${n} to check` : 'OK'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {shown && (
        <div className="ohl-raw">
          <button type="button" className="ohl-toggle" aria-expanded={rawOpen} onClick={() => setRawOpen(v => !v)}>All raw values</button>
          {rawOpen && (
            <dl className="ohl-dl">
              {rawRows(shown.payload || {}, shown.device_ts).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}
