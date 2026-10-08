import React from 'react';
import { Link } from 'react-router-dom';
import { Sun } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { EmptyState, SetupCard, SetupShell, useTokens } from '../siteHardware/ui';

export const openLinkStyle = (t: ReturnType<typeof useTokens>): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44,
  padding: '0 20px', borderRadius: 12, background: t.good, color: '#fff',
  fontFamily: t.body, fontSize: '0.92rem', fontWeight: 600, textDecoration: 'none',
});

const MySites: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const sites = user?.assigned_sites ?? [];

  return (
    <SetupShell isDark={isDark} heading="Your sites" sub="The systems you can watch and run.">
      {sites.length === 0 ? (
        <EmptyState isDark={isDark} headline="No sites yet" detail="Ask an admin to give you access to a site." />
      ) : sites.map((s, i) => (
        <SetupCard
          key={s.site_id} isDark={isDark} index={i} icon={<Sun size={20} />}
          title={s.display_name || s.site_id} purpose="Live readings and history"
          action={<Link to={`/my-sites/${encodeURIComponent(s.site_id)}`} style={openLinkStyle(t)} aria-label={`Open ${s.display_name || s.site_id}`}>Open</Link>}
        >
          {null}
        </SetupCard>
      ))}
    </SetupShell>
  );
};

export default MySites;
