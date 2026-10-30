import React, { useCallback, useEffect, useState } from 'react';
import { apiService, type SiteEvent } from '../../../services/api';
import './viewerHome.css';

const when = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The site panel's Events tab (viewer): incidents and operations at this site, last 7 days, newest first. */
const ViewerEvents: React.FC<{ siteId: string }> = ({ siteId }) => {
  const [events, setEvents] = useState<SiteEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    apiService.getSiteEvents(siteId, 7).then(r => setEvents(r.events)).catch(() => setFailed(true));
  }, [siteId]);
  useEffect(load, [load]);

  if (failed) {
    return (
      <div className="vh" style={{ padding: 0 }}><div className="vh-empty" role="alert">
        Couldn't load events.<div style={{ marginTop: 12 }}><button onClick={load}>Try again</button></div>
      </div></div>
    );
  }
  if (!events) return <span className="vh-muted">Loading…</span>;
  if (events.length === 0) return <div className="vh" style={{ padding: 0 }}><div className="vh-empty">Nothing happened in the last 7 days</div></div>;
  return (
    <div className="vh" style={{ padding: 0 }}>
      <div className="vh-box">
        <table className="vh-table">
          <thead><tr><th>When</th><th>Kind</th><th>What</th><th>Who</th><th>Device</th></tr></thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i}>
                <td className="vh-muted">{when(e.at)}</td>
                <td><span className={`vh-state${e.kind === 'operation' ? ' on' : ''}`}>{e.kind === 'incident' ? 'Incident' : 'Operation'}</span></td>
                <td style={{ whiteSpace: 'normal' }}>{e.title}</td>
                <td>{e.actor?.name ?? '-'}</td>
                <td className="vh-num">{e.serial ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewerEvents;
