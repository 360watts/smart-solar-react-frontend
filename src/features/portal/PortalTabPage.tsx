// Shared wrapper used by Weather / History / Solar / Load portal pages.
// Fetches the user's first site and renders SiteDataPanel locked to a given tab.
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';

const SiteDataPanel = lazy(() => import('../../shared/components/SiteDataPanel'));

type TabId = 'details' | 'weather' | 'history' | 'forecast' | 'phase-load';

interface Props {
  tab: TabId;
  title: string;
}

export default function PortalTabPage({ tab, title }: Props) {
  const { isDark } = useTheme();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [inverterKw, setInverterKw] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService.getPortalSummary()
      .then((data: any) => {
        const site = data?.sites?.[0];
        if (site) {
          setSiteId(site.site_id);
          setInverterKw(site.inverter_capacity_kw ?? null);
        } else {
          setError('No site found for your account.');
        }
      })
      .catch(() => setError('Failed to load site data.'))
      .finally(() => setLoading(false));
  }, []);

  const muted = isDark ? 'rgba(240,244,255,0.5)' : '#64748b';
  const text  = isDark ? '#f0f8ff' : '#1e293b';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (error || !siteId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: muted, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
        {error ?? 'No site available.'}
      </div>
    );
  }

  return (
    <div style={{ padding: 'clamp(16px, 2.5vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontFamily: "'Outfit', 'Outfit', sans-serif", fontSize: 22, fontWeight: 700, color: text, marginBottom: 20, letterSpacing: '-0.02em' }}>
        {title}
      </h1>
      <Suspense fallback={<div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted, fontSize: 13 }}>Loading…</div>}>
        <SiteDataPanel
          siteId={siteId}
          autoRefresh
          inverterCapacityKw={inverterKw}
          initialTab={tab}
          hideTabs
        />
      </Suspense>
    </div>
  );
}
