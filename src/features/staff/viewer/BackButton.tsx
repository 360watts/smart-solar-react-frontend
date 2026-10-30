import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTokens } from '../siteHardware/ui';

/** The viewer pages' way back: a soft outlined button (44 px tall for touch), not a text link. */
const BackButton: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => {
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', margin: '0 0 12px',
        borderRadius: 12, border: `1px solid ${t.line}`, background: t.card, color: t.ink,
        fontFamily: t.body, fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none',
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {children}
    </Link>
  );
};

export default BackButton;
