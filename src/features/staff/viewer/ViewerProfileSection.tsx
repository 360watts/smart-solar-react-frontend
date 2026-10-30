import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService, type MyOperation } from '../../../services/api';
import { useAccess } from '../../../shared/access/useAccess';
import { VIEWER_ALWAYS, VIEWER_NEVER, VIEWER_OPERATIONS } from '../employees/viewerAccessCopy';
import './viewerHome.css';

const typeName = (t: string) => (t === 'energy_meter' ? 'Meter' : 'Monitor');
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const words = (r: MyOperation) => {
  const s = r.action && r.action !== r.op ? `${r.op} ${r.action}` : r.op;
  return s.replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase());
};

/** Viewer part of /profile (spec 5.4): what was given, what is allowed, the viewer's own trail. */
const ViewerProfileSection: React.FC = () => {
  const { user } = useAuth();
  const { can } = useAccess();
  const [rows, setRows] = useState<MyOperation[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    apiService.getMyOperations(30).then(r => setRows(r.rows)).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const devices = user?.assigned_devices ?? [];
  const sites = user?.assigned_sites ?? [];
  const opsOn = can('device_control');
  const given = opsOn ? [...VIEWER_ALWAYS, ...VIEWER_OPERATIONS] : VIEWER_ALWAYS;
  const ask = [...(opsOn ? [] : VIEWER_OPERATIONS), ...VIEWER_NEVER];

  return (
    <div className="vh" style={{ marginTop: 20 }}>
      <h2>What you've been given</h2>
      <div className="vh-cards">
        <div className="vh-card">
          <b>Devices</b>
          {devices.length === 0 && <span className="vh-muted">None</span>}
          {devices.map(d => (
            <Link key={d.device_id} to={`/devices/${d.device_id}/dashboard`} className="vh-link vh-num">
              {d.serial} <span className="vh-muted">{typeName(d.device_type)}</span>
            </Link>
          ))}
        </div>
        <div className="vh-card">
          <b>Sites</b>
          {sites.length === 0 && <span className="vh-muted">None</span>}
          {sites.map(s => (
            <Link key={s.site_id} to={`/my-sites/${s.site_id}`} className="vh-link">
              <span className="vh-num">{s.site_id}</span> <span className="vh-muted">{s.display_name}</span>
            </Link>
          ))}
        </div>
      </div>

      <h2>What you can do</h2>
      <div className="vh-cards">
        <div className="vh-card">
          <b>On everything given to you</b>
          <ul className="vh-list">{given.map(t => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="vh-card">
          <b>Ask an admin for</b>
          <ul className="vh-list">{ask.map(t => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <p className="vh-muted">Need more? Ask your admin.</p>

      <h2>Operations you ran, last 30 days</h2>
      {failed ? (
        <div className="vh-empty" role="alert">
          Couldn't load your operations.
          <div style={{ marginTop: 12 }}><button onClick={load}>Try again</button></div>
        </div>
      ) : rows === null ? <span className="vh-muted">Loading…</span>
        : rows.length === 0 ? <div className="vh-empty">You haven't run any operations in the last 30 days</div>
        : (
          <div className="vh-box">
            <table className="vh-table" style={{ minWidth: 0 }}>
              <thead><tr><th>Time</th><th>Operation</th><th>Device</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.at}-${i}`}>
                    <td className="vh-num">{when(r.at)}</td>
                    <td>{words(r)}</td>
                    <td>{r.serial ? <Link to={`/devices/${r.device_id}/dashboard`}>{r.serial}</Link> : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default ViewerProfileSection;
