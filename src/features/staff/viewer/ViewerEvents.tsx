import React, { useCallback, useEffect, useState } from 'react';
import { apiService, type SiteEvent } from '../../../services/api';
import { AlertTriangle, Wrench } from 'lucide-react';
import { ActivityList, EmptyState } from '../../../shared/components/Feedback';
import { ListSkeleton } from './Skeleton';
import './viewerHome.css';

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
    return <EmptyState title="Couldn't load events" description="The server didn't answer. Your devices are not affected." onRetry={load} />;
  }
  if (!events) return <ListSkeleton />;
  if (events.length === 0) return <EmptyState icon={Wrench} title="Nothing happened in the last 7 days" description="Incidents and operations at this site show up here." />;
  return (
    <div className="vh" style={{ padding: 0 }}>
      <div className="vh-box" style={{ padding: '8px 20px 12px' }}>
        <ActivityList label="Events" items={events.map(e => ({
          at: e.at, title: e.title, icon: e.kind === 'incident' ? AlertTriangle : Wrench, tone: e.kind === 'incident' ? 'warn' : 'ok',
          chip: e.kind === 'incident' ? 'Incident' : 'Operation', detail: e.serial && <span className="vh-num">{e.serial}</span>,
          ...(e.kind === 'operation' && { actor: e.actor ?? null }),
        }))} />
      </div>
    </div>
  );
};

export default ViewerEvents;
