import React from 'react';
import { PackageOpen, Plus } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  const { isDark } = useTheme();

  const surface  = isDark ? '#0F1623' : '#FFFFFF';
  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(18,21,26,0.09)';
  const text     = isDark ? '#F0F4FF' : '#12151A';
  const textMute = isDark ? 'rgba(240,244,255,0.52)' : 'rgba(18,21,26,0.52)';
  const iconFg   = isDark ? 'rgba(240,244,255,0.32)' : 'rgba(18,21,26,0.32)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
    }}>
      {/* 72px circle — matches mobile emptyIconWrap */}
      <div style={{
        width: 72, height: 72, borderRadius: 36,
        background: surface, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <span style={{ color: iconFg, display: 'flex' }}>
          {icon ?? <PackageOpen size={32} strokeWidth={1.5} />}
        </span>
      </div>

      <div style={{ color: text, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>
        {title}
      </div>

      {description && (
        <div style={{ color: textMute, fontSize: '0.875rem', lineHeight: 1.55, maxWidth: 280, marginBottom: action ? 20 : 0 }}>
          {description}
        </div>
      )}

      {action && (
        <button
          onClick={action.onClick}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 14, border: 'none',
            background: 'linear-gradient(90deg, #00D95F, #00A63E)',
            color: '#fff', fontSize: '0.9375rem', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.01em',
            boxShadow: '0 4px 14px rgba(47,191,113,0.35)',
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(47,191,113,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(47,191,113,0.35)'; }}
        >
          <Plus size={16} strokeWidth={2.5} />
          {action.label}
        </button>
      )}
    </div>
  );
};
