/**
 * DeviceTypeSelector — Interactive Device Type Selection
 *
 * Distinctively designed with dark OLED + safety orange aesthetic.
 * Features:
 * - Bold interactive states with spring animations
 * - Pulsing glow and scale effects on hover (enabled state)
 * - Clear affordances: cursor pointer, brightness changes, border highlights
 * - Glassmorphic selected state with gradient accent border
 * - Disabled state: grayed out with locked visual treatment
 * - Responsive grid layout
 */

import React, { useState } from 'react';
import { Server, Zap, Lock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface DeviceTypeSelectorProps {
  value: 'gateway' | 'energy_meter';
  onChange: (type: 'gateway' | 'energy_meter') => void;
  disabled?: boolean;
  disabledReason?: string;
}

export const DeviceTypeSelector: React.FC<DeviceTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  disabledReason,
}) => {
  const { isDark } = useTheme();
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Design palette: Dark OLED + Safety Orange
  const COLORS = {
    accentOrange: '#F97316',
    primarySlate: '#64748B',
    successGreen: '#10B981',
    errorRed: '#EF4444',
    dark: {
      bg: '#0F172A',
      surface: '#1E293B',
      border: 'rgba(148, 163, 184, 0.15)',
      text: '#F1F5F9',
      textMuted: '#94A3B8',
    },
    light: {
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      border: 'rgba(100, 116, 139, 0.15)',
      text: '#0F172A',
      textMuted: '#475569',
    },
  };

  const C = isDark ? COLORS.dark : COLORS.light;

  const DEVICE_TYPES = [
    {
      id: 'gateway',
      label: 'Solar Inverter / Gateway',
      description: 'Main device that sends telemetry and handles configuration',
      icon: Server,
    },
    {
      id: 'energy_meter',
      label: 'Energy Meter',
      description: 'Measures power consumption and energy usage',
      icon: Zap,
    },
  ];

  const selectedType = DEVICE_TYPES.find(t => t.id === value);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Label with Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <label style={{
          fontSize: '12px',
          fontWeight: 700,
          color: C.text,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontFamily: '"Fira Code", monospace',
        }}>
          Device Type
        </label>

        {!disabled ? (
          // Editable State Indicator
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: COLORS.accentOrange,
            background: `rgba(249, 115, 22, ${isDark ? '0.1' : '0.08'})`,
            padding: '3px 8px',
            borderRadius: '4px',
            border: `1px solid rgba(249, 115, 22, 0.3)`,
            animation: 'pulse-border 2s ease-in-out infinite',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: COLORS.accentOrange,
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
            Editable
          </span>
        ) : (
          // Locked State Indicator
          <div
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            style={{ position: 'relative' }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: isDark ? 'rgba(239, 68, 68, 0.7)' : 'rgba(220, 38, 38, 0.7)',
                fontWeight: 600,
                cursor: 'help',
              }}
            >
              <Lock size={12} />
              Locked
            </span>
            {showTooltip && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  fontSize: '11px',
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                  border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.2)'}`,
                  color: isDark ? 'rgba(239, 68, 68, 0.9)' : 'rgba(220, 38, 38, 0.9)',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
              >
                {disabledReason || 'Cannot be changed'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Options Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
      }}>
        {DEVICE_TYPES.map(type => {
          const Icon = type.icon;
          const isSelected = value === type.id;
          const isHovered = hoveredOption === type.id && !disabled;

          return (
            <button
              key={type.id}
              onClick={() => !disabled && onChange(type.id as 'gateway' | 'energy_meter')}
              disabled={disabled}
              onMouseEnter={() => !disabled && setHoveredOption(type.id)}
              onMouseLeave={() => setHoveredOption(null)}
              style={{
                position: 'relative',
                padding: 14,
                borderRadius: 12,
                border: isSelected
                  ? `2px solid ${COLORS.accentOrange}`
                  : isHovered
                  ? `2px solid ${COLORS.primarySlate}`
                  : `1.5px solid ${C.border}`,
                background: isSelected
                  ? `linear-gradient(135deg, rgba(249, 115, 22, ${isDark ? '0.08' : '0.06'}), rgba(249, 115, 22, ${isDark ? '0.04' : '0.02'}))`
                  : isDark
                  ? 'rgba(30, 41, 59, 0.5)'
                  : 'rgba(248, 250, 252, 0.8)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
                transform: isHovered && !disabled ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 10,
                backdropFilter: isSelected ? 'blur(12px)' : 'blur(8px)',
                boxShadow: isSelected
                  ? isDark
                    ? `0 0 20px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(249, 115, 22, 0.2)`
                    : `0 0 15px rgba(249, 115, 22, 0.15), inset 0 1px 0 rgba(249, 115, 22, 0.1)`
                  : isHovered && !disabled
                  ? isDark
                    ? '0 8px 24px rgba(0, 0, 0, 0.3)'
                    : '0 8px 24px rgba(0, 0, 0, 0.1)'
                  : 'none',
              }}
            >
              {/* Icon + Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}>
                <Icon
                  size={22}
                  style={{
                    color: isSelected ? COLORS.accentOrange : C.textMuted,
                    flexShrink: 0,
                    transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isHovered && !disabled ? 'scale(1.15) rotate(8deg)' : 'scale(1)',
                  }}
                />
                {isSelected && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: COLORS.accentOrange,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#000',
                      fontWeight: 700,
                      animation: 'scale-bounce 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: isSelected ? COLORS.accentOrange : C.text,
                  textAlign: 'left',
                  lineHeight: 1.3,
                  fontFamily: '"Fira Code", monospace',
                  letterSpacing: '-0.01em',
                  transition: 'color 200ms',
                }}
              >
                {type.label}
              </span>

              {/* Description */}
              <span
                style={{
                  fontSize: '11px',
                  color: C.textMuted,
                  textAlign: 'left',
                  lineHeight: 1.4,
                  fontWeight: 400,
                  fontFamily: '"Fira Sans", sans-serif',
                  opacity: isHovered && !disabled ? 1 : 0.8,
                  transition: 'opacity 200ms',
                }}
              >
                {type.description}
              </span>

              {/* Interactive Border Glow (Enabled + Hovered) */}
              {!disabled && isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 12,
                    border: `2px solid ${COLORS.accentOrange}`,
                    opacity: 0.5,
                    pointerEvents: 'none',
                    animation: 'border-pulse 1.5s ease-in-out infinite',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.3); }
          50% { box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1); }
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }

        @keyframes scale-bounce {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          50% { transform: scale(1.15); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }

        @keyframes border-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.5), inset 0 0 10px rgba(249, 115, 22, 0.1); }
          50% { box-shadow: 0 0 0 8px rgba(249, 115, 22, 0), inset 0 0 20px rgba(249, 115, 22, 0.2); }
        }
      `}</style>
    </div>
  );
};

export default DeviceTypeSelector;
