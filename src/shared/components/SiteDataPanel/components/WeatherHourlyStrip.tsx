// src/shared/components/SiteDataPanel/components/WeatherHourlyStrip.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, CloudRain, Cloud, CloudSun } from 'lucide-react';
import { useTheme } from '../../../../contexts/ThemeContext';
import { IST_TIMEZONE } from '../../../../app/constants';

const IST = IST_TIMEZONE;

const weatherIconSize = 24;

const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.7, 1, 0.7],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

const WeatherHourlyStrip = ({ hourly }: { hourly: any[] }) => {
  const { isDark } = useTheme();
  if (!hourly || hourly.length === 0) return null;

  const getWeatherIcon = (cloud: number, ghi: number, precip: number | null) => {
    if (ghi < 10) return <Moon size={weatherIconSize} />;
    if (precip != null && precip > 60) return <CloudRain size={weatherIconSize} />;
    if (precip != null && precip > 30) return cloud > 40 ? <CloudRain size={weatherIconSize} /> : <CloudSun size={weatherIconSize} />;
    if (cloud > 75) return <Cloud size={weatherIconSize} />;
    if (cloud > 40) return <CloudSun size={weatherIconSize} />;
    return <Sun size={weatherIconSize} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      style={{
        padding: '18px 20px',
        marginBottom: 16,
        borderRadius: 16,
        background: isDark
          ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.75))'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(249, 250, 251, 0.9))',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 166, 62, 0.25)'}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      }}
    >
      <p style={{ margin: '0 0 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CloudSun size={16} color="#00a63e" />
        24 h Weather Outlook
      </p>
      <div style={{ overflowX: 'auto', paddingTop: 8, paddingBottom: 4, WebkitOverflowScrolling: 'touch' as const }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
          {hourly.map((h, i) => {
            const time = (() => { try { return new Date(h.forecast_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: IST }); } catch { return ''; } })();
            const cloud = h.cloud_cover_pct ?? 0;
            const ghi = h.ghi_wm2 ?? 0;
            const temp = Number(h.temperature_c ?? 0);
            const wind = Number(h.wind_speed_ms ?? 0);
            const humidity = h.humidity_pct != null ? Number(h.humidity_pct) : null;
            const precip = h.precip_prob_pct != null ? Number(h.precip_prob_pct) : null;
            const ghiPct = Math.min(100, (ghi / 900) * 100);
            const humPct = humidity != null ? Math.min(100, humidity) : null;
            const isNow = i === 0;
            const wi = getWeatherIcon(cloud, ghi, precip);
            const ghiColor = ghi > 600 ? '#F07522' : ghi > 200 ? '#f59e0b' : '#d1d5db';
            const humColor = humidity == null ? '#d1d5db'
              : humidity > 80 ? '#3b82f6'
              : humidity > 50 ? '#60a5fa'
              : '#93c5fd';
            const precipColor = precip == null ? '#d1d5db'
              : precip > 60 ? '#1d4ed8'
              : precip > 30 ? '#3b82f6'
              : '#93c5fd';

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
                whileHover={{ scale: 1.08, y: -4 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: isNow
                    ? 'linear-gradient(135deg, rgba(0, 166, 62, 0.25), rgba(0, 166, 62, 0.08))'
                    : isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
                  border: `1px solid ${isNow ? 'rgba(0, 166, 62, 0.4)' : isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  minWidth: 72,
                  gap: 3,
                  position: 'relative',
                  boxShadow: isNow ? '0 4px 12px rgba(0, 166, 62, 0.25)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {isNow && (
                  <motion.span
                    animate={pulseAnimation}
                    style={{
                      position: 'absolute',
                      top: -10,
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      background: '#2FBF71',
                      color: '#0A0E1A',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontFamily: 'Poppins, sans-serif',
                      boxShadow: '0 2px 8px rgba(0, 166, 62, 0.4)',
                    }}
                  >
                    NOW
                  </motion.span>
                )}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{time}</span>
                <motion.span
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.6 }}
                  style={{ fontSize: '1.2rem', lineHeight: 1.4 }}
                >
                  {wi}
                </motion.span>
                <span style={{ fontSize: '0.875rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {temp.toFixed(1)}°
                </span>
                {/* GHI mini-bar with animation */}
                <div title={`GHI ${Math.round(ghi)} W/m²`} style={{ width: '100%', height: 4, background: 'rgba(0, 0, 0, 0.08)', borderRadius: 2, overflow: 'hidden', margin: '3px 0' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ghiPct}%` }}
                    transition={{ delay: i * 0.05 + 0.2, duration: 0.6 }}
                    style={{ height: '100%', background: ghiColor, borderRadius: 2 }}
                  />
                </div>
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>{Math.round(ghi)} W/m²</span>
                {/* Humidity bar */}
                {humPct != null && (
                  <>
                    <div title={`Humidity ${Math.round(humPct)}%`} style={{ width: '100%', height: 4, background: 'rgba(0, 0, 0, 0.06)', borderRadius: 2, overflow: 'hidden', margin: '3px 0' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${humPct}%` }}
                        transition={{ delay: i * 0.05 + 0.3, duration: 0.6 }}
                        style={{ height: '100%', background: humColor, borderRadius: 2 }}
                      />
                    </div>
                    <span style={{ fontSize: '0.625rem', color: humColor, fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
                      💧{Math.round(humPct)}%
                    </span>
                  </>
                )}
                {/* Precipitation probability bar */}
                {precip != null && (
                  <>
                    <div title={`Rain ${Math.round(precip)}%`} style={{ width: '100%', height: 4, background: 'rgba(0, 0, 0, 0.06)', borderRadius: 2, overflow: 'hidden', margin: '3px 0' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${precip}%` }}
                        transition={{ delay: i * 0.05 + 0.4, duration: 0.6 }}
                        style={{ height: '100%', background: precipColor, borderRadius: 2 }}
                      />
                    </div>
                    <span style={{ fontSize: '0.625rem', color: precipColor, fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
                      🌧{Math.round(precip)}%
                    </span>
                  </>
                )}
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'Poppins, sans-serif' }}>
                  {wind.toFixed(1)} m/s
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherHourlyStrip;
