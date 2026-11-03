import React, { useState } from 'react';
import MobileAlerts from '../mobile/staff/MobileAlerts';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import AlertsTriage from './alerts/AlertsTriage';
import FleetHealthTab from './alerts/FleetHealthTab';
import AnalyticsTab from './alerts/AnalyticsTab';

const TABS = [['triage', 'Triage'], ['fleet', 'Fleet health'], ['analytics', 'Analytics']] as const;
type Tab = typeof TABS[number][0];

const Alerts: React.FC = () => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>('triage');
  if (isMobile) return <MobileAlerts />;
  return (
    <div className="admin-container responsive-page">
      <h1 className="m-0 text-[2rem] font-semibold leading-tight tracking-tight text-foreground">Alerts</h1>
      <div role="tablist" aria-label="Alerts sections" className="mb-5 mt-4 flex gap-6 border-b border-border">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-0 border-b-[3px] bg-transparent px-0.5 py-2.5 text-[15px] font-medium ${tab === k ? 'border-[var(--brand-green)] text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>
        ))}
      </div>
      {tab === 'triage' && <AlertsTriage />}
      {tab === 'fleet' && <FleetHealthTab />}
      {tab === 'analytics' && <AnalyticsTab />}
    </div>
  );
};

export default Alerts;
