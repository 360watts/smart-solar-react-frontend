import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import { useAccess } from '../../../shared/access/useAccess';
import { useAuth } from '../../../contexts/AuthContext';
import DevicePage, { at, type Dev, type Firmware } from './DevicePage';

type Op = { op: string; state: 'confirmed' | 'waiting' | 'not_confirmed' | 'failed' | 'sent' | 'no_record'; confirmed_at: string | null;
  last: { at: string; action: string; actor: { id: number; name: string } | null; values: Record<string, unknown> } | null };
type Ops = { device_type: string; ops: Op[]; recent: { at: string; op: string; action: string; actor: { id: number; name: string } | null }[] };

const OP: Record<string, [string, string, string]> = {  // name, what it does, group
  reboot: ['Restart', 'Restarts the device. Data pauses for about a minute.', 'Everyday'],
  mute: ['Mute alerts', 'Stops new fault alerts for a while.', 'Everyday'],
  auto_reboot: ['Auto restart', 'Restarts by itself when the inverter link freezes.', 'Everyday'],
  fetch_logs: ['Device logs', 'Asks the device to upload its log files.', 'Checks'],
  telemetry_debug: ['Detailed telemetry', 'Keeps extra debug readings for a set time.', 'Checks'],
  diagnostics: ['Diagnostics', 'Checks Wi-Fi, SIM, inverter link and memory.', 'Checks'],
  ota_update: ['Update firmware', 'Installs a chosen version on this device only.', 'Firmware and network'],
  rollback: ['Roll back firmware', 'Returns to the version it ran before. Asks to confirm.', 'Firmware and network'],
  apn: ['Mobile data (APN)', 'Sets the SIM access point. The gateway restarts. Asks to confirm.', 'Firmware and network'],
  meter_interval: ['Publish interval', 'How often the meter sends a reading.', 'Meter'],
  meter_calibrate: ['Calibration', 'Needs a known load switched on. Asks to confirm.', 'Meter'],
  hard_reset: ['Hard reset', 'Wipes settings back to factory. Asks you to confirm.', 'Last resort'],
};
const GROUPS = ['Everyday', 'Checks', 'Firmware and network', 'Meter'];

export default function OperationsTab({ dev, firmware, isDark }: { dev: Dev; firmware: Firmware[] | null; isDark: boolean }) {
  const access = useAccess();
  const { user } = useAuth();
  const [data, setData] = useState<Ops | null | 'failed'>(null);
  const seq = useRef(0);
  // An older response must not overwrite a newer one (the poll and onDone can overlap).
  const load = useCallback(() => {
    const n = ++seq.current;
    return apiService.getDeviceOperations(dev.device_id).then(d => { if (n === seq.current) setData(d); }).catch(() => { if (n === seq.current) setData('failed'); });
  }, [dev.device_id]);
  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const who = (o: Op) => (o.last?.actor ? (o.last.actor.id === user?.id ? 'by you' : `by ${o.last.actor.name}`) : '');
  const status = (o: Op): [string, string] => {
    if (!o.last) return ['No record yet', 'dt-state-none'];
    const ran = [at(o.last.at), who(o)].filter(Boolean).join(' ');
    switch (o.state) {
      case 'confirmed': return [`Confirmed${o.confirmed_at ? ` ${at(o.confirmed_at)}` : ''}, sent ${ran}`, 'dt-state-ok'];
      case 'waiting': return [`Sent ${ran}, waiting for the device`, 'dt-state-wait'];
      case 'not_confirmed': return [`Sent ${ran}. Not confirmed after 5 min`, 'dt-state-wait'];
      case 'failed': return [`Sent ${ran}. The device reported a failure. Try again, or ask an admin.`, 'dt-state-wait'];
      default: return [`Sent ${ran}`, 'dt-state-none'];
    }
  };
  const ops = data && data !== 'failed' ? data.ops : [];
  const reset = ops.find(o => o.op === 'hard_reset');

  return (
    <section aria-labelledby="dt-ops-h" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 id="dt-ops-h" style={{ margin: 0, fontSize: 18 }}>Operations</h3>
        <p className="dt-sub" style={{ margin: '4px 0 0', fontSize: 14 }}>When each last ran and whether the device confirmed it. Operations from before 29 Oct have no record.</p>
      </div>
      {!dev.is_online && <p className="dt-sub" style={{ margin: 0 }}>This device is offline. Restart, diagnostics, logs and the APN need it online. The publish interval and auto restart apply when it reconnects.</p>}
      {data === 'failed' && <p className="dt-sub">Couldn't load the operation history.</p>}
      <div className="dt-ops">
        {GROUPS.map(g => {
          const list = ops.filter(o => OP[o.op]?.[2] === g);
          return list.length ? (
            <div key={g} className="dt-card" style={{ gap: 0, padding: '14px 20px 6px' }}>
              <h4 style={{ margin: '4px 0 6px', fontSize: 15 }}>{g}</h4>
              {list.map(o => { const [text, cls] = status(o); return (
                <div key={o.op} className="dt-op">
                  <span style={{ fontWeight: 500 }}>{OP[o.op][0]}</span>
                  <span className="dt-sub">{OP[o.op][1]}</span>
                  <span className={cls}>{text}</span>
                </div>
              ); })}
            </div>
          ) : null;
        })}
      </div>
      {reset && (
        <div className="dt-card dt-danger" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><span style={{ fontWeight: 600, color: 'var(--destructive)' }}>Hard reset</span><span className="dt-sub" style={{ display: 'block' }}>{OP.hard_reset[1]}</span></div>
          <span className={status(reset)[1]}>{status(reset)[0]}</span>
        </div>
      )}
      {access.can('device_control') && (
        <section className="dt-card" aria-label="Run an operation">
          <h4 style={{ margin: 0, fontSize: 15 }}>Run an operation</h4>
          <DevicePage key={dev.device_id} variant="ops" isDark={isDark} dev={dev} firmware={firmware} onDone={load} />
        </section>
      )}
      {data && data !== 'failed' && data.recent.length > 0 && (
        <section className="dt-card" aria-label="Recent operations" style={{ gap: 0 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>Recent operations on this device</h4>
          {data.recent.map((r, i) => (
            <div key={i} className="dt-op" style={{ gridTemplateColumns: '150px minmax(0, 1fr)' }}>
              <span className="dt-num dt-sub">{at(r.at)}</span>
              <span>{OP[r.op]?.[0] ?? r.action} {r.actor ? (r.actor.id === user?.id ? 'by you' : `by ${r.actor.name}`) : ''}</span>
            </div>
          ))}
        </section>
      )}
      <p className="dt-sub" style={{ margin: 0 }}>Updating many devices at once stays with admins.</p>
    </section>
  );
}
