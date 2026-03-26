import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}

export default function PageHeader({ icon, title, subtitle, rightSlot }: PageHeaderProps) {
  const { isDark } = useTheme();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #00a63e, #007a55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,166,62,0.3)',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700 }}>{title}</h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: isDark ? '#64748b' : '#94a3b8' }}>{subtitle}</p>
        </div>
      </div>
      {rightSlot ? <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{rightSlot}</div> : null}
    </div>
  );
}
