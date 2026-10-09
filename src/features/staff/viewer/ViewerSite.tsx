import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import SiteDataPanel from '../../../shared/components/SiteDataPanel';
import type { TabId } from '../../../shared/components/SiteDataPanel/types';
import { useTokens } from '../siteHardware/ui';
import { openLinkStyle } from './MySites';
import { useAccess } from '../../../shared/access/useAccess';

// Read-only monitoring tabs. Details (settings) and Health are left out. Usage and Smart plugs only show when the site has a meter / a plug (the panel decides).
// Devices (list + device drawer) is added only with device control.
const VIEWER_TABS: TabId[] = ['overview', 'history', 'forecast', 'weather', 'phase-load', 'plugs', 'usage'];

const ViewerSite: React.FC = () => {
  const { siteId = '' } = useParams<{ siteId: string }>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const canDevices = useAccess().can('device_control');
  const site = user?.assigned_sites?.find(s => s.site_id === siteId);

  if (!site) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px', fontFamily: t.body, color: t.ink }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontFamily: t.head, fontSize: 18, margin: '0 0 8px' }}>This site isn't available to you</h1>
          <p style={{ margin: '0 0 20px', color: t.ink2 }}>Ask an admin if you need access.</p>
          <Link to="/my-sites" style={openLinkStyle(t)}>Back to your sites</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: t.body, color: t.ink }}>
      <Link to="/my-sites" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: t.ink2, textDecoration: 'none', fontSize: '0.9rem' }}>
        Back to your sites
      </Link>
      <h2 style={{ fontFamily: t.head, fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.015em', margin: '0 0 14px' }}>
        {site.display_name || site.site_id}
      </h2>
      <SiteDataPanel key={site.site_id} siteId={site.site_id} autoRefresh hideHeader visibleTabs={canDevices ? [...VIEWER_TABS, 'devices'] : VIEWER_TABS} />
      {/* ponytail: no reusable battery-control UI exists yet, so no Controls section (follow-up). */}
    </div>
  );
};

export default ViewerSite;
