import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService, type MyOperation } from '../../../services/api';
import { useAccess } from '../../../shared/access/useAccess';
import { VIEWER_ALWAYS, VIEWER_NEVER, VIEWER_OPERATIONS } from '../employees/viewerAccessCopy';
import { Wrench } from 'lucide-react';
import { ActivityList, EmptyState } from '../../../shared/components/Feedback';
import { ListSkeleton } from './Skeleton';
import './viewerHome.css';

const typeName = (t: string) => (t === 'energy_meter' ? 'Meter' : 'Monitor');
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

      <h2>Operations you ran, last 30 days</h2>
      {failed ? <EmptyState title="Couldn't load your operations" description="The server didn't answer. Your devices are not affected." onRetry={load} />
        : rows === null ? <ListSkeleton rows={3} />
        : rows.length === 0 ? <EmptyState icon={Wrench} title="No operations in the last 30 days" description="Restarts, updates and setting changes you run show up here." />
        : (
          <div className="vh-box" style={{ padding: '8px 20px 12px' }}>
            <ActivityList label="Operations you ran" items={rows.map(r => ({
              at: r.at, title: words(r), icon: Wrench,
              detail: r.serial ? <Link to={`/devices/${r.device_id}/dashboard`} className="vh-num">{r.serial}</Link> : undefined,
            }))} />
          </div>
        )}
    </div>
  );
};

export default ViewerProfileSection;
