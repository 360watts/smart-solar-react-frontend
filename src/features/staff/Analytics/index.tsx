import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import PageHeader from '../../../shared/layout/PageHeader';
import { useTheme } from '../../../contexts/ThemeContext';
import { getDesignTokens } from '../../../shared/theme';
import { apiService } from '../../../services/api';
import FleetOverview from './FleetOverview';
import SiteDeepDive from './SiteDeepDive';
import type { AnalyticsMode, AnalyticsSite } from './types';

export default function Analytics() {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  const [mode, setMode] = useState<AnalyticsMode>('fleet');
  const [sites, setSites] = useState<AnalyticsSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [sitesLoading, setSitesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiService.getAllSites()
      .then((list: any[]) => {
        if (cancelled) return;
        const mapped: AnalyticsSite[] = Array.isArray(list) ? list.map(s => ({
          site_id: s.site_id, display_name: s.display_name,
          capacity_kw: s.capacity_kw ?? null, inverter_capacity_kw: s.inverter_capacity_kw ?? null,
          devices: Array.isArray(s.devices) ? s.devices : [],
        })) : [];
        setSites(mapped);
        if (mapped.length && !selectedSiteId) setSelectedSiteId(mapped[0].site_id);
      })
      .catch(() => { if (!cancelled) setSites([]); })
      .finally(() => { if (!cancelled) setSitesLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    setMode('site');
  };

  return (
    <div>
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Real-Time Analytics"
        subtitle="Live grid reliability, power quality, solar resource, performance, and utilization"
        rightSlot={
          <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 10, background: tokens.surfaceMuted }}>
            {(['fleet', 'site'] as AnalyticsMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  border: 'none', borderRadius: 8, cursor: 'pointer', padding: '8px 16px',
                  fontSize: '0.82rem', fontWeight: 700,
                  background: mode === m ? tokens.surface : 'transparent',
                  color: mode === m ? tokens.text : tokens.textMuted,
                  boxShadow: mode === m ? tokens.shadow : 'none',
                }}
              >
                {m === 'fleet' ? 'Fleet Overview' : 'Site Deep-Dive'}
              </button>
            ))}
          </div>
        }
      />

      {sitesLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: tokens.textMuted }}>Loading sites…</div>
      ) : sites.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: tokens.textMuted }}>No sites found.</div>
      ) : mode === 'fleet' ? (
        <FleetOverview sites={sites} onSelectSite={goToSite} />
      ) : (
        <SiteDeepDive sites={sites} selectedSiteId={selectedSiteId} onSelectSite={setSelectedSiteId} />
      )}
    </div>
  );
}
