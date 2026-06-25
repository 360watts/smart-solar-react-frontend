/**
 * ComponentDetailModalPremium — Premium component specifications modal
 *
 * Aesthetic: Luxury Tech Dashboard
 * - Refined geometric layouts with asymmetrical balance
 * - Sophisticated color palette (cyan + amber accents on dark)
 * - Premium typography (Outfit display + DM Sans body)
 * - Glassmorphism with selective blur and transparency
 * - Organized information hierarchy via tabs and cards
 * - Subtle animations and micro-interactions
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import type { ComponentHealth } from '../../services/api';

// ─── Utility Functions ──────────────────────────────────────────────────────

const toTitleCase = (text: string): string => {
  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

// ─── Design Tokens ──────────────────────────────────────────────────────────

const PALETTE_DARK = {
  // Base canvas
  canvas: '#0a0e18',
  backdrop: 'rgba(10, 14, 24, 0.92)',
  glass: 'rgba(10, 14, 24, 0.6)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderHeavy: 'rgba(255, 255, 255, 0.12)',

  // Text hierarchy
  textPrimary: '#f0f8ff',
  textSecondary: '#c4e0f8',
  textTertiary: '#9dc4e4',

  // Accent colors (component-specific)
  inverterColor: '#60a5fa',    // blue
  batteryColor: '#fbbf24',      // amber
  panelColor: '#10ffcb',        // cyan/mint

  // State colors
  success: '#4ade80',
  warning: '#facc15',
  critical: '#f87171',

  // Gradients
  gradientPrimary: 'linear-gradient(135deg, #60a5fa 0%, #00d4ff 100%)',
  gradientWarm: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
  gradientGreen: 'linear-gradient(135deg, #10ffcb 0%, #4ade80 100%)',
};

const PALETTE_LIGHT = {
  // Base canvas
  canvas: '#f9fafb',
  backdrop: 'rgba(249, 250, 251, 0.80)',
  glass: 'rgba(249, 250, 251, 0.75)',
  border: 'rgba(0, 0, 0, 0.08)',
  borderHeavy: 'rgba(0, 0, 0, 0.12)',

  // Text hierarchy
  textPrimary: '#0f172a',
  textSecondary: '#374151',
  textTertiary: '#64748b',

  // Accent colors (component-specific)
  inverterColor: '#2563eb',    // blue
  batteryColor: '#d97706',      // amber
  panelColor: '#059669',        // green

  // State colors
  success: '#16a34a',
  warning: '#ca8a04',
  critical: '#dc2626',

  // Gradients
  gradientPrimary: 'linear-gradient(135deg, #2563eb 0%, #0284c7 100%)',
  gradientWarm: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
  gradientGreen: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
};

const mkPalette = (isDark: boolean) => isDark ? PALETTE_DARK : PALETTE_LIGHT;
const PALETTE = PALETTE_DARK;

const TYPOGRAPHY = {
  display: "'Outfit', 'Outfit', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Tab Navigation Component ──────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: '◉' },
  { id: 'specs', label: 'Specifications', icon: '⚙' },
  { id: 'diagnostics', label: 'Diagnostics', icon: '📊' },
];

interface TabNavProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <div style={{
      display: 'flex', gap: 2, borderBottom: `1px solid ${PALETTE.border}`,
      padding: '0 24px', background: `linear-gradient(90deg, ${PALETTE.glass}, transparent)`,
    }}>
      {TABS.map((tab) => (
        <motion.button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '14px 16px',
            border: 'none',
            background: 'transparent',
            color: activeTab === tab.id ? PALETTE.textPrimary : PALETTE.textTertiary,
            fontFamily: TYPOGRAPHY.body,
            fontSize: 11,
            fontWeight: activeTab === tab.id ? 600 : 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            position: 'relative',
            transition: 'color 0.3s ease',
          }}
          whileHover={{ color: PALETTE.textSecondary }}
        >
          {tab.icon} {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="tabUnderline"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                background: PALETTE.gradientPrimary,
                borderRadius: '1px 1px 0 0',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}
        </motion.button>
      ))}
    </div>
  );
}

// ─── Spec Card Component ───────────────────────────────────────────────────

interface SpecCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  isNumeric?: boolean;
  highlight?: boolean;
  delay?: number;
}

function SpecCard({ label, value, unit, icon, isNumeric = false, highlight = false, delay = 0 }: SpecCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{
        padding: '14px',
        borderRadius: 10,
        background: highlight
          ? `linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(0, 212, 255, 0.08))`
          : `rgba(255, 255, 255, 0.03)`,
        border: `1px solid ${highlight ? 'rgba(96, 165, 250, 0.3)' : PALETTE.border}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        cursor: 'default',
      }}
      whileHover={{
        background: highlight
          ? `linear-gradient(135deg, rgba(96, 165, 250, 0.18), rgba(0, 212, 255, 0.14))`
          : `rgba(255, 255, 255, 0.06)`,
        borderColor: highlight ? 'rgba(96, 165, 250, 0.5)' : PALETTE.borderHeavy,
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <span style={{
          fontFamily: TYPOGRAPHY.body,
          fontSize: 12,
          color: PALETTE.textTertiary,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {icon && <span>{icon}</span>}
          {label}
        </span>
        <span style={{
          fontFamily: TYPOGRAPHY.body,
          fontSize: 14,
          fontWeight: 600,
          color: highlight ? PALETTE.inverterColor : PALETTE.textPrimary,
          whiteSpace: 'nowrap',
        }}>
          {isNumeric && typeof value === 'number' ? value.toFixed(2) : value}
          {unit && <span style={{ fontSize: 12, marginLeft: 4, color: PALETTE.textSecondary }}>{unit}</span>}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Health Score Ring ─────────────────────────────────────────────────────

interface HealthRingProps {
  score: number;
  color: string;
  size: number;
}

function HealthRing({ score, color, size }: HealthRingProps) {
  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - score / 100);

  const mv = useMotionValue(0);
  const offset = useTransform(mv, [0, 100], [circumference, 0]);

  useEffect(() => {
    const c = animate(mv, score, {
      duration: 2.0,
      ease: [0.16, 1, 0.3, 1],
      delay: 0.2,
    });
    return () => c.stop();
  }, [score]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        <defs>
          <filter id="ring-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Bg ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Animated ring */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={1}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            filter: 'url(#ring-glow)',
            transformOrigin: `${cx}px ${cy}px`,
            transform: 'rotate(-90deg)',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <motion.div
          style={{
            fontFamily: TYPOGRAPHY.display,
            fontSize: 24,
            fontWeight: 900,
            color,
            textShadow: `0 0 16px ${color}40`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {Math.round(score)}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Premium Modal Component ────────────────────────────────────────────────

interface ComponentDetailModalPremiumProps {
  component: { key: string; icon: string; color: string; glow: string; label: string };
  data: ComponentHealth;
  onClose: () => void;
}

export default function ComponentDetailModalPremium({
  component,
  data,
  onClose,
}: ComponentDetailModalPremiumProps) {
  const { isDark } = useTheme();
  const PALETTE = mkPalette(isDark);
  const [activeTab, setActiveTab] = useState('overview');

  const statusColor =
    data.status === 0 ? PALETTE.success : data.status === 1 ? PALETTE.warning : PALETTE.critical;
  const statusLabel = ['EXCELLENT', 'NEEDS ATTENTION', 'CRITICAL'][data.status];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: `radial-gradient(circle at 40% 30%, rgba(96,165,250,0.08), ${PALETTE.backdrop})`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{
          duration: 0.32,
          type: 'spring',
          stiffness: 340,
          damping: 32,
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: '85vh',
          background: PALETTE.canvas,
          borderRadius: 20,
          overflow: 'hidden',
          border: `1px solid ${PALETTE.borderHeavy}`,
          boxShadow: `
            0 0 0 1px ${component.color}20,
            0 32px 96px rgba(0,0,0,0.6),
            inset 0 1px 1px ${PALETTE.border}
          `,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ─── Premium Header ─────────────────────────────────────────────── */}
        <div
          style={{
            padding: '24px',
            background: `linear-gradient(135deg, ${component.color}15, ${component.color}08)`,
            borderBottom: `1px solid ${PALETTE.border}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative gradient orb */}
          <div
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              background: `radial-gradient(circle, ${component.color}40, transparent)`,
              borderRadius: '50%',
              top: -50,
              right: -50,
              filter: 'blur(60px)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            {/* Component icon & name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <motion.div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${component.color}15`,
                  border: `1.5px solid ${component.color}35`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  color: component.color,
                }}
                whileHover={{ scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                {component.icon}
              </motion.div>
              <div>
                <div
                  style={{
                    fontFamily: TYPOGRAPHY.display,
                    fontSize: 18,
                    fontWeight: 800,
                    color: PALETTE.textPrimary,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {component.label}
                </div>
                <div
                  style={{
                    fontFamily: TYPOGRAPHY.mono,
                    fontSize: 9,
                    color: PALETTE.textTertiary,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}
                >
                  Component Details
                </div>
              </div>
            </div>

            {/* Close button */}
            <motion.button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${PALETTE.border}`,
                background: 'rgba(255,255,255,0.04)',
                color: PALETTE.textTertiary,
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'sans-serif',
              }}
              whileHover={{
                background: 'rgba(255,255,255,0.08)',
                borderColor: PALETTE.borderHeavy,
              }}
              whileTap={{ scale: 0.95 }}
            >
              ×
            </motion.button>
          </div>
        </div>

        {/* ─── Score & Status Section ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            padding: '24px',
            display: 'flex',
            gap: 20,
            borderBottom: `1px solid ${PALETTE.border}`,
            alignItems: 'center',
          }}
        >
          {/* Health ring */}
          <HealthRing score={data.health_score} color={component.color} size={100} />

          {/* Status info */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: statusColor,
                  boxShadow: `0 0 8px ${statusColor}`,
                  animation: 'pulse 2s infinite',
                }}
              />
              <span
                style={{
                  fontFamily: TYPOGRAPHY.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  color: statusColor,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {statusLabel}
              </span>
            </div>

            {/* Key metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.specs.slice(0, 2).map((spec, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: TYPOGRAPHY.body,
                    fontSize: 12,
                    color: PALETTE.textSecondary,
                    lineHeight: 1.4,
                  }}
                >
                  {toTitleCase(spec)}
                </div>
              ))}
            </div>

            {/* Warranty info */}
            {data.warranty && (
              <div
                style={{
                  fontFamily: TYPOGRAPHY.mono,
                  fontSize: 9,
                  color: PALETTE.textTertiary,
                  marginTop: 10,
                  letterSpacing: '0.06em',
                }}
              >
                WARRANTY: {toTitleCase(data.warranty)}
              </div>
            )}
          </div>
        </motion.div>

        {/* ─── Tab Navigation ─────────────────────────────────────────────── */}
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* ─── Content Sections ───────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <AnimatePresence mode="wait">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                style={{ padding: '24px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <SpecCard label="Health Score" value={data.health_score} unit="Pts" highlight />
                  <SpecCard label="Efficiency" value={data.efficiency} unit="%" />
                  <SpecCard label="Age" value={data.age || 'N/A'} />
                  <SpecCard label="Status" value={toTitleCase(statusLabel)} />
                </div>

                {/* Alert section */}
                {data.alert && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                      marginTop: 16,
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'rgba(251, 191, 36, 0.08)',
                      border: '1px solid rgba(251, 191, 36, 0.25)',
                      borderLeft: `3px solid ${PALETTE.warning}`,
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                    <span
                      style={{
                        fontFamily: TYPOGRAPHY.body,
                        fontSize: 12,
                        color: '#fcd34d',
                        lineHeight: 1.5,
                      }}
                    >
                      {data.alert}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* SPECIFICATIONS TAB */}
            {activeTab === 'specs' && (
              <motion.div
                key="specs"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                style={{ padding: '24px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {data.catalog_specs &&
                    Object.entries(data.catalog_specs)
                      .slice(0, 12)
                      .map(([key, value], i) => {
                        const displayValue =
                          typeof value === 'string'
                            ? toTitleCase(value)
                            : typeof value === 'number'
                              ? value.toString()
                              : Array.isArray(value)
                                ? value.map(v => typeof v === 'string' ? toTitleCase(v) : v).join(', ')
                                : JSON.stringify(value);

                        return (
                          <SpecCard
                            key={key}
                            label={toTitleCase(key)}
                            value={displayValue}
                            delay={i * 0.04}
                          />
                        );
                      })}
                </div>
              </motion.div>
            )}

            {/* DIAGNOSTICS TAB */}
            {activeTab === 'diagnostics' && (
              <motion.div
                key="diagnostics"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                style={{ padding: '24px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {Object.entries(data.details)
                    .slice(0, 10)
                    .map(([key, value], i) => (
                      <SpecCard
                        key={key}
                        label={toTitleCase(key)}
                        value={toTitleCase(value)}
                        delay={i * 0.04}
                        highlight={i === 0}
                      />
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </motion.div>
  );
}
