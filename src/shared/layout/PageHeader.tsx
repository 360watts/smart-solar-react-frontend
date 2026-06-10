import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { getDesignTokens } from '../theme';

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
  backAction?: () => void;
}

export default function PageHeader({ title, subtitle, rightSlot, backAction }: PageHeaderProps) {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);

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
              background: tokens.surface, border: `1px solid ${tokens.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: tokens.shadow,
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke={tokens.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.625rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: tokens.text,
            lineHeight: 1.2,
          }}>
            {title}
          </h1>
          <p style={{
            margin: '3px 0 0',
            fontSize: '0.8125rem',
            color: tokens.textMuted,
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
  const tokens = getDesignTokens(isDark);

  const styles: Record<string, React.CSSProperties> = {
    accent: {
      background: tokens.primarySoft,
      border: `1px solid ${tokens.primary}`,
      color: tokens.primary,
    },
    danger: {
      background: tokens.dangerSoft,
      border: `1px solid ${tokens.danger}`,
      color: tokens.danger,
    },
    muted: {
      background: tokens.surfaceMuted,
      border: `1px solid ${tokens.border}`,
      color: tokens.textMuted,
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
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);

  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 14,
    border: 'none', cursor: 'pointer',
    background: `linear-gradient(90deg, ${tokens.primary}, ${tokens.primaryHover})`,
    color: tokens.textInverse, fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '0.01em',
    boxShadow: tokens.shadow,
    transition: 'opacity 0.15s, box-shadow 0.15s',
    textDecoration: 'none',
  };

  if (href) {
    return (
      <a href={href} style={base}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = tokens.shadow; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = tokens.shadow; }}
      >{children}</a>
    );
  }
  return (
    <button onClick={onClick} style={base}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = tokens.shadow; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = tokens.shadow; }}
    >{children}</button>
  );
}
