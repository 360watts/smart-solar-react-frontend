import { Lock } from 'lucide-react';
import { EmptyState } from '../../../shared/components/Feedback';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiService, type AccessDevice, type AccessSummary } from '../../../services/api';
import DeviceStrip from './DeviceStrip';
import { ago } from './DevicePage';
import { HomeSkeleton } from './Skeleton';
import './viewerHome.css';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const headline = (d: number, s: number) =>
  `You can test ${[d && plural(d, 'device'), s && plural(s, 'site')].filter(Boolean).join(' and ')}`;
const typeName = (d: AccessDevice) => (d.device_type === 'energy_meter' ? 'Meter' : 'Monitor');

/** Viewer home (spec 5.1): everything this viewer was given, from one call. */
const ViewerHome: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AccessSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const load = useCallback(() => {
    const mine = ++seq.current; // a slower, older response must not overwrite a newer one
    apiService.getAccessSummary()
      .then(r => { if (mine === seq.current) { setData(r); setFailed(false); } })
      .catch(() => { if (mine === seq.current) setFailed(true); });
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener('focus', load);
    return () => { clearInterval(timer); window.removeEventListener('focus', load); seq.current++; };
  }, [load]);

  if (!data) {
    return (
      <div className="vh">
        {failed ? (
          <EmptyState title="Couldn't load your devices and sites" description="The server didn't answer. Your devices are not affected." onRetry={load} />
        ) : <HomeSkeleton />}
      </div>
    );
  }

  const { devices, sites } = data;
  if (devices.length === 0 && sites.length === 0) {
    return (
      <div className="vh">
        <EmptyState icon={Lock} title="Nothing has been given to you yet" description="An admin assigns devices and sites." />
      </div>
    );
  }

  return (
    <div className="vh">
      <h1>{headline(devices.length, sites.length)}</h1>
      {failed && (
        <div className="vh-fault" role="alert">Couldn't refresh. Showing the last data. <button onClick={load}>Try again</button></div>
      )}

      {devices.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>Devices</h2>
          <div className="vh-box">
            <table className="vh-table">
              <thead><tr><th>Device</th><th>Serial</th><th>Firmware</th><th>Last 24 hours</th><th>Status</th><th>Last data</th></tr></thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d.device_id} data-row className={d.is_online ? '' : 'silent'} onClick={() => navigate(`/devices/${d.device_id}/dashboard`)}>
                    <td>{typeName(d)} <span className="vh-muted">{d.site_id ?? 'bench, no site'}</span></td>
                    <td><Link to={`/devices/${d.device_id}/dashboard`} onClick={e => e.stopPropagation()}>{d.serial}</Link></td>
                    <td className="vh-num">{d.firmware_version ?? '-'}</td>
                    <td>
                      <DeviceStrip d={d} />
                    </td>
                    <td><span className={`vh-state${d.is_online ? ' on' : ''}`}>{d.is_online ? 'Sending' : 'Silent'}</span></td>
                    <td className="vh-muted">{d.last_reading_at ? ago(d.last_reading_at) : 'no data yet'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {sites.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>Sites</h2>
          <div className="vh-cards">
            {sites.map(s => (
              <Link key={s.site_id} className="vh-card" to={`/my-sites/${encodeURIComponent(s.site_id)}`}>
                <b>{s.display_name || s.site_id}</b>
                <span className="vh-muted vh-num">{s.site_id}</span>
                <span><span className="vh-num">{s.devices_sending}</span> of <span className="vh-num">{s.devices_total}</span> devices sending</span>
                <span className={s.latest_incident ? 'vh-fault' : 'vh-muted'}>{s.latest_incident ? s.latest_incident.title : 'No open faults'}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="vh-muted" style={{ margin: 0 }}>
        You can run every operation on these devices. <Link className="vh-link" to="/profile">See your access</Link>
      </p>
    </div>
  );
};

export default ViewerHome;
