import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
  backAction?: () => void;
}

export default function PageHeader({ title, subtitle, rightSlot, backAction }: PageHeaderProps) {
  const { isDark } = useTheme();

  const text     = isDark ? '#F0F4FF' : '#12151A';
  const textMute = isDark ? 'rgba(240,244,255,0.52)' : 'rgba(18,21,26,0.52)';
  const card     = isDark ? '#0F1623' : '#FFFFFF';
  const border   = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,21,26,0.09)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, marginBottom: 28, flexWrap: 'wrap',
    }}>
      {/* Left: optional back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {backAction && (
          <button
            onClick={backAction}
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: card, border: `1px solid ${border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke={text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.625rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: text,
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          <p style={{
            margin: '3px 0 0',
            fontSize: '0.8125rem',
            color: textMute,
            letterSpacing: '-0.01em',
          }}>
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right slot */}
      {rightSlot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}

/** Pre-built pill button to use in rightSlot */
export function HeaderPillButton({
  children,
  onClick,
  variant = 'accent',
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'accent' | 'danger' | 'muted';
  href?: string;
}) {
  const { isDark } = useTheme();

  const styles: Record<string, React.CSSProperties> = {
    accent: {
      background: 'rgba(47,191,113,0.10)',
      border: '1px solid rgba(47,191,113,0.30)',
      color: '#2FBF71',
    },
    danger: {
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.30)',
      color: '#EF4444',
    },
    muted: {
      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(18,21,26,0.05)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,21,26,0.09)'}`,
      color: isDark ? '#8892A4' : '#717182',
    },
  };

  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 999,
    fontSize: '0.8125rem', fontWeight: 700,
    cursor: 'pointer', textDecoration: 'none',
    transition: 'opacity 0.15s',
    ...styles[variant],
  };

  if (href) {
    return (
      <a href={href} style={base}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >{children}</a>
    );
  }

  return (
    <button onClick={onClick} style={{ ...base, border: styles[variant].border as string }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >{children}</button>
  );
}

/** Gradient CTA button (green, matching mobile commission button) */
export function GradientCTAButton({
  children,
  onClick,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 14,
    border: 'none', cursor: 'pointer',
    background: 'linear-gradient(90deg, #00D95F, #00A63E)',
    color: '#fff', fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '0.01em',
    boxShadow: '0 4px 14px rgba(47,191,113,0.35)',
    transition: 'opacity 0.15s, box-shadow 0.15s',
    textDecoration: 'none',
  };

  if (href) {
    return (
      <a href={href} style={base}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(47,191,113,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(47,191,113,0.35)'; }}
      >{children}</a>
    );
  }
  return (
    <button onClick={onClick} style={base}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(47,191,113,0.5)'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(47,191,113,0.35)'; }}
    >{children}</button>
  );
}
