// src/shared/components/SiteDataPanel/components/ChartCard.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  isDark: boolean;
  isLive?: boolean;
  isLoading?: boolean;
  height: number;
  accentColor?: string;
  delay?: number;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title, subtitle, isDark, isLive, isLoading, height, accentColor = '#00a63e',
  delay = 0, children, headerRight,
}) => {
  const cardBg = isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.75)';
  const borderBase = isDark ? 'rgba(148,163,184,0.15)' : `${accentColor}22`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
      style={{
        position: 'relative', padding: '18px 16px', borderRadius: 18, marginBottom: 16,
        background: cardBg,
        backdropFilter: 'blur(24px)',
        border: `1px solid ${borderBase}`,
        boxShadow: isDark
          ? `0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`
          : `0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.8)`,
        overflow: 'hidden',
      }}
    >
      {/* Subtle radial accent top-right */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at top right, ${accentColor}14, transparent 60%)` }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '0.92rem',
              color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
              {title}
            </h3>
            {isLive && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ display: 'flex', alignItems: 'center', gap: 5,
                  padding: '2px 8px', borderRadius: 999,
                  background: isDark ? 'rgba(0,166,62,0.12)' : 'rgba(0,166,62,0.08)',
                  border: '1px solid rgba(0,166,62,0.3)' }}
              >
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#00a63e',
                    boxShadow: '0 0 6px #00a63e' }}
                />
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#00a63e', fontFamily: 'Poppins, sans-serif' }}>
                  Live
                </span>
              </motion.div>
            )}
          </div>
          {subtitle && (
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600,
              color: 'var(--muted-foreground)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerRight}
      </div>

      {/* Content / Skeleton */}
      {isLoading ? (
        <div style={{ height, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
          {[0.4, 0.7, 0.55, 0.85, 0.6, 0.75].map((w, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
              style={{ height: Math.random() * 20 + 20, borderRadius: 6, alignSelf: 'flex-end',
                width: `${w * 100}%`,
                background: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.1)' }}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scaleY: 0.96 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.35, delay: delay + 0.12, ease: 'easeOut' }}
          style={{ height, position: 'relative' }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
};

export default ChartCard;
