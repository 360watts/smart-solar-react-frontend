import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Battery, Zap, Home, Car, Droplets, Wind, Waves, Plug, Activity } from 'lucide-react';
import { SmartDeviceNode, ApplianceLabel } from './types';

export type NodeType = 'solar' | 'battery' | 'grid' | 'load' | 'device';

export interface NodeData {
  type: NodeType;
  id: string;
  title: string;
  subtitle?: string;
  power_kw: number;
  status?: 'active' | 'inactive' | 'online' | 'offline';
  color: string;
  icon: React.ReactNode;
  details?: Record<string, string | number>;
  device?: SmartDeviceNode;
  // Additional device metrics
  current_a?: number;
  voltage_v?: number;
  energy_kwh?: number;
  timestamp?: string;
  deviceType?: string;
  circuit?: string;
}

interface NodeDetailPanelProps {
  node: NodeData | null;
  onClose: () => void;
  isDark: boolean;
}

const applIcon = (label: ApplianceLabel, color: string) => {
  const p = { size: 18, color };
  switch (label) {
    case 'ev_charger': return <Car {...p} />;
    case 'geyser': return <Droplets {...p} />;
    case 'ac_unit': return <Wind {...p} />;
    case 'water_pump': return <Droplets {...p} />;
    case 'washing_machine': return <Waves {...p} />;
    default: return <Plug {...p} />;
  }
};

const getNodeIcon = (type: NodeType, color: string) => {
  const p = { size: 24, color };
  switch (type) {
    case 'solar': return <Sun {...p} />;
    case 'battery': return <Battery {...p} />;
    case 'grid': return <Zap {...p} />;
    case 'load': return <Home {...p} />;
    case 'device': return <Activity {...p} />;
  }
};

const getRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay >= 1) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffHr >= 1) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  if (diffMin >= 1) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  return `${diffSec} second${diffSec > 1 ? 's' : ''} ago`;
};

export default function NodeDetailPanel({ node, onClose, isDark }: NodeDetailPanelProps) {
  if (!node) return null;

  const bgColor = 'var(--card)';
  const surfaceColor = 'var(--card)';
  const borderColor = isDark ? `${node.color}20` : `${node.color}18`;
  const textPrimary = 'var(--foreground)';
  const textSecondary = 'var(--muted-foreground)';

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 48,
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(100%, 420px)',
              background: bgColor,
              borderLeft: `1px solid ${borderColor}`,
              boxShadow: isDark
                ? '0 20px 60px rgba(0,0,0,0.4)'
                : '0 10px 40px rgba(0,0,0,0.08)',
              zIndex: 50,
              overflow: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                position: 'sticky',
                top: 0,
                padding: '20px 20px 16px',
                background: `linear-gradient(180deg, ${surfaceColor} 0%, ${bgColor} 100%)`,
                borderBottom: `1px solid ${borderColor}`,
                zIndex: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <motion.div
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                  style={{ color: node.color }}
                >
                  {getNodeIcon(node.type, node.color)}
                </motion.div>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    transition: 'all 0.2s',
                    color: textSecondary,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                    (e.currentTarget as HTMLElement).style.color = textPrimary;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'none';
                    (e.currentTarget as HTMLElement).style.color = textSecondary;
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div>
                <h2 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: textPrimary,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}>
                  {node.title}
                </h2>
                {node.subtitle && (
                  <p style={{
                    fontSize: 12,
                    color: textSecondary,
                    margin: '4px 0 0',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {node.subtitle}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Power Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                padding: '20px',
                background: `linear-gradient(135deg, ${node.color}12 0%, ${node.color}08 100%)`,
                borderBottom: `1px solid ${borderColor}`,
                margin: 0,
              }}
            >
              <div style={{ fontSize: 12, color: textSecondary, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Current Power
              </div>
              <div style={{
                fontSize: 32,
                fontWeight: 800,
                color: node.color,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}>
                {Math.abs(node.power_kw).toFixed(2)}<span style={{ fontSize: 18, marginLeft: 4 }}>kW</span>
              </div>
            </motion.div>

            {/* Status */}
            {node.status && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 12, color: textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Status
                </span>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 12,
                  background: node.status === 'active' || node.status === 'online'
                    ? isDark ? '#10b98122' : '#d1fae522'
                    : isDark ? '#ef444422' : '#fee222',
                  color: node.status === 'active' || node.status === 'online' ? '#10b981' : '#ef4444',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  letterSpacing: '0.02em',
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: node.status === 'active' || node.status === 'online' ? '#10b981' : '#ef4444',
                    display: 'inline-block',
                  }} />
                  {node.status}
                </div>
              </motion.div>
            )}

            {/* Details Grid */}
            {node.details && Object.entries(node.details).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                style={{ padding: 20 }}
              >
                <div style={{ fontSize: 12, color: textSecondary, marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {Object.entries(node.details).map(([key, value], i) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.04 }}
                      style={{
                        padding: 12,
                        background: surfaceColor,
                        borderRadius: 10,
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <div style={{ fontSize: 10, color: textSecondary, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {key}
                      </div>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: textPrimary,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.01em',
                      }}>
                        {value}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Electrical Metrics */}
            {(node.current_a || node.voltage_v) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${borderColor}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                {node.current_a !== undefined && (
                  <div>
                    <div style={{ fontSize: 10, color: textSecondary, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Current
                    </div>
                    <div style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {node.current_a.toFixed(2)}<span style={{ fontSize: 11, marginLeft: 4 }}>A</span>
                    </div>
                  </div>
                )}
                {node.voltage_v !== undefined && (
                  <div>
                    <div style={{ fontSize: 10, color: textSecondary, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Voltage
                    </div>
                    <div style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {node.voltage_v.toFixed(1)}<span style={{ fontSize: 11, marginLeft: 4 }}>V</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Energy Consumption */}
            {node.energy_kwh !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Energy Consumed
                </div>
                <div style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: node.color,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {node.energy_kwh.toFixed(2)}<span style={{ fontSize: 12, marginLeft: 6 }}>kWh</span>
                </div>
              </motion.div>
            )}

            {/* Device Information */}
            {(node.device || node.deviceType || node.circuit) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ padding: '16px 20px', borderBottom: `1px solid ${borderColor}` }}
              >
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Device Information
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {node.device && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: textSecondary }}>Appliance Type</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary, textTransform: 'capitalize' }}>
                        {node.device.appliance_label.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  {node.device && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: textSecondary }}>Device Type</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary, textTransform: 'capitalize' }}>
                        {node.device.device_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}
                  {(node.circuit || node.device?.circuit) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: textSecondary }}>Circuit</span>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: (node.circuit || node.device?.circuit) === 'solar' ? '#f59e0b' : '#60a5fa',
                        textTransform: 'uppercase',
                      }}>
                        {(node.circuit || node.device?.circuit)?.toUpperCase() || 'Auto'}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Timestamp */}
            {node.timestamp && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                style={{ padding: '16px 20px', borderTop: `1px solid ${borderColor}` }}
              >
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Last Update
                </div>
                <div style={{ fontSize: 13, color: textPrimary, fontFamily: 'JetBrains Mono, monospace' }}>
                  {new Date(node.timestamp).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: textSecondary, marginTop: 4 }}>
                  {getRelativeTime(node.timestamp)}
                </div>
              </motion.div>
            )}

            {/* Footer breathing room */}
            <div style={{ height: 20 }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
