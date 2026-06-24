// src/shared/components/SiteDataPanel/components/KpiCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Battery, Home, Activity, Thermometer } from 'lucide-react';
import { useTheme } from '../../../../contexts/ThemeContext';

const iconSize = 16;
export const IconSunKpi = () => <Sun size={iconSize} className="site-data-panel-icon-solar" />;
export const IconBattery = () => <Battery size={iconSize} />;
export const IconLoad = () => <Home size={iconSize} />;
export const IconGrid = () => <Activity size={iconSize} />;
export const IconThermometer = () => <Thermometer size={iconSize} />;

const kpiCardVariants = {
  initial: { opacity: 0, scale: 0.8, rotateX: -15 },
  animate: (i: number) => ({
    opacity: 1,
    scale: 1,
    rotateX: 0,
    transition: {
      delay: i * 0.08,
      type: 'spring' as const,
      stiffness: 200,
      damping: 15,
    },
  }),
  hover: {
    scale: 1.05,
    rotateY: 2,
    rotateX: -2,
    boxShadow: '0 15px 35px rgba(0, 166, 62, 0.2)',
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 },
  },
};

interface KpiCardProps {
  label: string; value: string; unit?: string; sub?: string;
  accent: string; icon: React.ReactNode; badge?: React.ReactNode;
  index: number; noHover?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, sub, accent, icon, badge, index, noHover }) => {
  const { isDark } = useTheme();

  return (
    <motion.div
      custom={index}
      variants={kpiCardVariants as any}
      initial="initial"
      animate="animate"
      whileHover={noHover ? undefined : 'hover'}
      style={{
        padding: '20px',
        flex: 1,
        minWidth: 130,
        borderRadius: 16,
        background: isDark
          ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.8))'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9))',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.15)'}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
          {label}
        </span>
        <motion.div
          whileHover={{ rotate: 360, scale: 1.15 }}
          transition={{ duration: 0.6 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}25, ${accent}15)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            flexShrink: 0,
            boxShadow: `0 4px 12px ${accent}30`,
          }}
        >
          {icon}
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 + index * 0.05 }}
        style={{
          margin: 0,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '1.75rem',
          fontWeight: 800,
          lineHeight: 1,
          color: accent,
        }}
      >
        {value}
        {unit && <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </motion.p>
      {sub && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + index * 0.05 }}
          style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}
        >
          {sub}
        </motion.p>
      )}
      {badge && <div style={{ marginTop: 8 }}>{badge}</div>}
    </motion.div>
  );
};

export default KpiCard;
