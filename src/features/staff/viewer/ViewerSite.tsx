import { Lock } from 'lucide-react';
import { EmptyState } from '../../../shared/components/Feedback';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import SiteDataPanel from '../../../shared/components/SiteDataPanel';
import type { TabId } from '../../../shared/components/SiteDataPanel/types';
import { useTokens } from '../siteHardware/ui';
import { apiService, type AccessDevice } from '../../../services/api';
import DeviceStrip from './DeviceStrip';
import './viewerHome.css';
import BackButton from './BackButton';
import { useAccess } from '../../../shared/access/useAccess';


// Read-only monitoring tabs (Forecast and Weather are staff-only; Events lists incidents and operations). Details (settings) and Health are left out. Usage and Smart plugs only show when the site has a meter / a plug (the panel decides).
// Devices (list + device drawer) is added only with device control.
const VIEWER_TABS: TabId[] = ['overview', 'history', 'phase-load', 'plugs', 'usage', 'events'];

const ViewerSite: React.FC = () => {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const canDevices = useAccess().can('device_control');
  const site = user?.assigned_sites?.find(s => s.site_id === siteId);
  const [devices, setDevices] = useState<AccessDevice[]>([]);
  useEffect(() => {
    let live = true;
    setDevices([]);
    apiService.getAccessSummary().then(r => { if (live) setDevices(r.devices.filter(d => d.site_id === siteId)); }).catch(() => {});
    return () => { live = false; };
  }, [siteId]);

  if (!site) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: '0 16px' }}>
        <EmptyState icon={Lock} title="This site isn't available to you" description="Ask an admin if you need access."
          action={{ label: 'Back to dashboard', to: '/my-sites' }} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: t.body, color: t.ink }}>
      <BackButton to="/my-sites">Back to dashboard</BackButton>
      <h2 style={{ fontFamily: t.head, fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.015em', margin: '0 0 14px' }}>
        {site.display_name || site.site_id}
      </h2>
      {devices.length > 0 && (
        <div className="vh" style={{ padding: 0, gap: 8, marginBottom: 14 }}>
          {devices.map(d => (
            <Link key={d.device_id} to={`/devices/${d.device_id}/dashboard`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, color: 'inherit', textDecoration: 'none' }}>
              <span className="vh-num" style={{ fontFamily: "'Fira Code', monospace", fontSize: 13, fontVariantLigatures: 'none' }}>{d.serial}</span>
              <div style={{ flex: 1 }}><DeviceStrip d={d} /></div>
              <span className={`vh-state${d.is_online ? ' on' : ''}`}>{d.is_online ? 'Sending' : 'Silent'}</span>
            </Link>
          ))}
        </div>
      )}
      <SiteDataPanel key={site.site_id} siteId={site.site_id} autoRefresh hideHeader visibleTabs={canDevices ? [...VIEWER_TABS, 'devices'] : VIEWER_TABS} />
      {/* ponytail: no reusable battery-control UI exists yet, so no Controls section (follow-up). */}
    </div>
  );
};

export default ViewerSite;
