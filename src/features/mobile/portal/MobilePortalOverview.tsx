import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Battery, ChevronDown, ChevronUp,
  Moon, Sun, Thermometer, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { apiService } from '../../../services/api';
import { getDesignTokens } from '../../../shared/theme';
import { useAutoRefresh } from '../../../shared/hooks';

/* ─── Types ────────────────────────────────────────────────────────────── */
interface PortalSummary {
  profile: { first_name?: string; last_name?: string; plan_type?: string };
  sites: Array<{
    site_id: string; display_name: string; capacity_kw: number;
    inverter_capacity_kw: number | null; site_status: string;
    devices: Array<{ device_serial: string; is_online: boolean }>;
  }>;
  active_alert_count: number;
}
/* Real shape from /sites/:id/energy-summary/?combined=true */
interface CombinedSummary {
  summary?: {
    today?: {
      pv_gen_kwh?: number;
      load_kwh?: number;
      grid_export_kwh?: number;
      grid_import_kwh?: number;
      power_to_grid_kwh?: number;
      avg_soc?: number | null;
    };
  };
  live?: {
    battery_pct?: number | null;
    production_kw?: number | null;
    weather?: {
      temperature_c?: number | null;
      ghi_wm2?: number | null;
      humidity_pct?: number | null;
      cloud_cover_pct?: number | null;
    } | null;
  };
}

/* ─── Solar Orb ──────────────────────────────────────────────────────── */
const SolarOrb: React.FC<{
  generated: number; capacity: number; isDark: boolean;
}> = ({ generated, capacity, isDark }) => {
  const max = Math.max(capacity * 5, generated, 1);
  const pct = Math.min(generated / max, 1);
  const R = 84;
  const circ = 2 * Math.PI * R;
  const dash = pct * circ;

  return (
    <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0, margin: '0 auto' }}>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2FBF71" stopOpacity={isDark ? '0.22' : '0.14'} />
            <stop offset="100%" stopColor="#2FBF71" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="orb-arc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2FBF71" />
            <stop offset="100%" stopColor="#7CCA94" />
          </linearGradient>
          <filter id="orb-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Ambient fill */}
        <circle cx="100" cy="100" r="90" fill="url(#orb-core)" />
        {/* Track */}
        <circle cx="100" cy="100" r={R} fill="none"
          stroke={isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.18)'}
          strokeWidth="7" />
        {/* Amber outer ring — capacity marker */}
        <circle cx="100" cy="100" r="96" fill="none"
          stroke={isDark ? 'rgba(233,185,73,0.12)' : 'rgba(233,185,73,0.18)'}
          strokeWidth="2" strokeDasharray="4 8" />
        {/* Progress arc */}
        {dash > 0 && (
          <circle cx="100" cy="100" r={R} fill="none"
            stroke="url(#orb-arc)" strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            filter="url(#orb-glow)"
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        )}
        {/* Pulse dot at arc tip */}
        {dash > 2 && (() => {
          const angle = (pct * 360 - 90) * (Math.PI / 180);
          const x = 100 + R * Math.cos(angle);
          const y = 100 + R * Math.sin(angle);
          return (
            <g>
              <circle cx={x} cy={y} r="7" fill="#2FBF71" opacity="0.3">
                <animate attributeName="r" values="7;12;7" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r="4.5" fill="#2FBF71" />
            </g>
          );
        })()}
      </svg>
      {/* Center label */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        <Sun size={16} color="#E9B949" strokeWidth={2} />
        <div style={{
          fontFamily: '"DM Serif Display", Georgia, serif',
          fontSize: 38, fontWeight: 400, lineHeight: 1,
          color: isDark ? '#F0F7F2' : '#0D2318',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {generated.toFixed(1)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)' }}>
          kWh today
        </div>
      </div>
    </div>
  );
};

/* ─── Main component ─────────────────────────────────────────────────── */
const MobilePortalOverview: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const T = getDesignTokens(isDark);
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [energy, setEnergy] = useState<CombinedSummary | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const loadRef = useRef(false);

  const selectedSite = useMemo(
    () => summary?.sites.find(s => s.site_id === selectedSiteId) ?? summary?.sites[0] ?? null,
    [summary, selectedSiteId],
  );

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const portal = await apiService.getPortalSummary() as PortalSummary;
      setSummary(portal);
      const fallback = selectedSiteId && portal.sites.some(s => s.site_id === selectedSiteId)
        ? selectedSiteId : portal.sites[0]?.site_id ?? null;
      setSelectedSiteId(fallback);
      if (fallback) setEnergy(await apiService.getEnergySummaryCombined(fallback));
      else setEnergy(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load portal overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const silentLoad = useCallback(() => load(true), []);
  useAutoRefresh(silentLoad, 60);

  useEffect(() => { void load(); setTimeout(() => setMounted(true), 80); }, []);

  useEffect(() => {
    if (!selectedSiteId || !loadRef.current) { loadRef.current = true; return; }
    let cancelled = false;
    setRefreshing(true);
    apiService.getEnergySummaryCombined(selectedSiteId)
      .then(d => { if (!cancelled) setEnergy(d); })
      .catch(() => { if (!cancelled) setEnergy(null); })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [selectedSiteId]);

  const todaySummary = energy?.summary?.today;
  const live        = energy?.live;
  const generated = todaySummary?.pv_gen_kwh ?? 0;
  const consumed  = todaySummary?.load_kwh ?? 0;
  const toGrid    = todaySummary?.grid_export_kwh ?? 0;
  const fromGrid  = todaySummary?.grid_import_kwh ?? 0;
  const battery   = live?.battery_pct;
  const tempC     = live?.weather?.temperature_c ?? null;
  const onlineDevices = selectedSite?.devices.filter(d => d.is_online).length ?? 0;
  const totalDevices = selectedSite?.devices.length ?? 0;
  const allOnline = totalDevices > 0 && onlineDevices === totalDevices;

  /* ─── Design tokens (Solar Noir — unified) ─── */
  const bg         = isDark ? '#080C14' : '#F0F7F3';
  const cardBg     = isDark ? 'rgba(10,20,14,0.96)' : 'rgba(252,255,253,0.97)';
  const cardBorder = isDark ? 'rgba(47,191,113,0.13)' : 'rgba(47,191,113,0.18)';
  const textPrimary = isDark ? '#F0F7F2' : '#0D2318';
  const textMuted   = isDark ? 'rgba(240,247,242,0.45)' : 'rgba(13,35,24,0.45)';
  const green = '#2FBF71';
  const amber = '#E9B949';

  const fadeStyle = (delay = 0): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.5s ${delay}ms ease, transform 0.5s ${delay}ms ease`,
  });

  /* ─── Loading ─── */
  if (loading) return (
    <div style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center', color: textMuted, background: bg }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Sun size={28} color={green} style={{ animation: 'portal-spin 2s linear infinite' }} />
        <span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>Loading your solar data…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: cardBg, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 20, padding: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <AlertTriangle size={18} color={T.danger} />
          <strong style={{ color: textPrimary }}>Unable to load overview</strong>
        </div>
        <div style={{ color: textMuted, fontSize: 14 }}>{error}</div>
      </div>
      <button onClick={() => void load()} style={{ height: 50, borderRadius: 14, border: 'none', background: green, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  );

  if (!summary || !selectedSite) return (
    <div style={{ padding: 20 }}>
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 24, padding: 28, textAlign: 'center' }}>
        <Sun size={32} color={amber} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 26, color: textPrimary }}>No active sites yet</div>
        <div style={{ color: textMuted, marginTop: 8, fontSize: 14 }}>Your installation will appear here once commissioning is complete.</div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes portal-spin { to { transform: rotate(360deg); } }
        @keyframes portal-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .snov-card {
          transition: transform 200ms ease, box-shadow 200ms ease;
          cursor: default;
        }
        .snov-card:active { transform: scale(0.985); }
        .snov-btn { cursor: pointer; transition: opacity 180ms ease, transform 180ms ease; }
        .snov-btn:hover { opacity: 0.88; }
        .snov-btn:active { transform: scale(0.96); }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: '"DM Sans", system-ui, sans-serif' }}>

        {/* ── Hero header ── */}
        <section className="snov-card" style={{
          ...fadeStyle(0),
          background: isDark
            ? 'linear-gradient(165deg, #0A1910 0%, #061009 60%, #080E0C 100%)'
            : 'linear-gradient(165deg, #E8F5EE 0%, #F4FAF6 60%, #FAFCFB 100%)',
          border: `1px solid ${cardBorder}`,
          borderRadius: 28,
          padding: '22px 20px 18px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Ambient decorations */}
          <div style={{ position: 'absolute', top: -100, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,191,113,0.15), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(233,185,73,0.12), transparent 70%)', pointerEvents: 'none' }} />

          {/* Greeting row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>
                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
              </div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 26, lineHeight: 1.1, color: textPrimary, marginTop: 6, maxWidth: 240 }}>
                {summary.profile.first_name
                  ? `${summary.profile.first_name}, your system is ${selectedSite.site_status}.`
                  : 'Your solar system at a glance.'}
              </div>
            </div>
            <button className="snov-btn" onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${cardBorder}`, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: isDark ? amber : '#6B7A99', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background 0.2s ease, color 0.2s ease' }}>
              {isDark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
            </button>
          </div>

          {/* Solar orb */}
          <div style={{ margin: '20px 0 16px', position: 'relative' }}>
            <SolarOrb generated={generated} capacity={selectedSite.capacity_kw} isDark={isDark} />
          </div>

          {/* Site picker */}
          <button className="snov-btn" onClick={() => setPickerOpen(o => !o)}
            style={{
              width: '100%', border: `1px solid ${cardBorder}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.72)',
              borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: textPrimary,
            }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Active site</div>
              <div style={{ marginTop: 3, fontWeight: 700, fontSize: 14 }}>{selectedSite.display_name}</div>
            </div>
            {pickerOpen ? <ChevronUp size={15} color={textMuted} /> : <ChevronDown size={15} color={textMuted} />}
          </button>

          {pickerOpen && summary.sites.length > 1 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {summary.sites.map(site => {
                const active = site.site_id === selectedSite.site_id;
                return (
                  <button key={site.site_id} className="snov-btn"
                    onClick={() => { setSelectedSiteId(site.site_id); setPickerOpen(false); }}
                    style={{
                      padding: '12px 16px', borderRadius: 14,
                      border: `1px solid ${active ? green : cardBorder}`,
                      background: active ? (isDark ? 'rgba(47,191,113,0.12)' : 'rgba(47,191,113,0.08)') : 'transparent',
                      color: active ? green : textPrimary, textAlign: 'left',
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{site.display_name}</div>
                    <div style={{ fontSize: 12, color: active ? green : textMuted, marginTop: 2 }}>{site.capacity_kw} kWp installed</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Live status strip */}
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderRadius: 16,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.64)',
            border: `1px solid ${cardBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0,
                background: allOnline ? 'rgba(47,191,113,0.15)' : 'rgba(245,158,11,0.15)',
                color: allOnline ? green : amber,
              }}>
                {allOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
              </span>
              <div>
                <div style={{ fontSize: 10, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Live status</div>
                <div style={{ color: textPrimary, fontWeight: 600, fontSize: 13, marginTop: 2 }}>
                  {allOnline ? 'All systems connected' : `${totalDevices - onlineDevices} device${totalDevices - onlineDevices === 1 ? '' : 's'} offline`}
                </div>
              </div>
            </div>
            {/* Pulse dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: textMuted, fontSize: 12, fontWeight: 600 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: allOnline ? green : amber, boxShadow: `0 0 6px ${allOnline ? green : amber}` }} />
              {onlineDevices}/{totalDevices}
            </div>
          </div>
        </section>

        {/* ── Bento grid ── */}
        <section style={{ ...fadeStyle(80), display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Generated — wider */}
          <div className="snov-card" style={{
            gridColumn: '1 / -1',
            background: cardBg, border: `1px solid ${cardBorder}`,
            borderRadius: 22, padding: '18px 18px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: textMuted }}>Solar generated</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                <span style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 42, lineHeight: 1, color: green, fontVariantNumeric: 'tabular-nums' }}>{generated.toFixed(1)}</span>
                <span style={{ color: textMuted, fontWeight: 600, fontSize: 14 }}>kWh</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: textMuted }}>{selectedSite.capacity_kw} kWp capacity{tempC != null ? ` · ${tempC.toFixed(1)}°C` : ''}{live?.weather?.humidity_pct != null ? ` · ${live.weather.humidity_pct}% humidity` : ''}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(47,191,113,0.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Sun size={22} color={green} />
            </div>
          </div>

          {/* Consumption */}
          <div className="snov-card" style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 22, padding: '16px 14px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(59,130,246,0.12)', display: 'grid', placeItems: 'center' }}>
              <Zap size={16} color="#3B82F6" />
            </div>
            <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30, lineHeight: 1, color: textPrimary, marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>{consumed.toFixed(1)}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: textMuted, marginTop: 4 }}>kWh used</div>
          </div>

          {/* Battery */}
          <div className="snov-card" style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 22, padding: '16px 14px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: battery != null && battery > 30 ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)', display: 'grid', placeItems: 'center' }}>
              <Battery size={16} color={battery != null && battery > 30 ? '#34D399' : amber} />
            </div>
            <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30, lineHeight: 1, color: textPrimary, marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
              {battery != null ? `${Math.round(battery)}%` : '—'}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: textMuted, marginTop: 4 }}>battery</div>
          </div>
        </section>

        {/* ── Energy flow breakdown ── */}
        <section className="snov-card" style={{
          ...fadeStyle(160),
          background: cardBg, border: `1px solid ${cardBorder}`,
          borderRadius: 24, padding: '18px 18px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>Energy flow today</div>
              <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 20, color: textPrimary, marginTop: 4 }}>Today's breakdown</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: textMuted }}>15 min</div>
          </div>

          {[
            { label: 'Generated', value: `${generated.toFixed(1)} kWh`, color: green, icon: <Sun size={14} /> },
            { label: 'Consumed', value: `${consumed.toFixed(1)} kWh`, color: '#3B82F6', icon: <Zap size={14} /> },
            { label: 'Exported to grid', value: `${toGrid.toFixed(1)} kWh`, color: green, icon: <ArrowUp size={14} /> },
            { label: 'Imported from grid', value: `${fromGrid.toFixed(1)} kWh`, color: amber, icon: <ArrowDown size={14} /> },
            { label: 'Temperature', value: tempC != null ? `${tempC.toFixed(1)}°C` : '—', color: amber, icon: <Thermometer size={14} /> },
          ].map((row, i) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: row.color, display: 'flex', alignItems: 'center' }}>{row.icon}</span>
                <span style={{ fontSize: 14, color: textMuted, fontWeight: 500 }}>{row.label}</span>
              </div>
              <span style={{ color: row.color, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
            </div>
          ))}
        </section>

        {/* ── Alerts banner ── */}
        {summary.active_alert_count > 0 && (
          <section className="snov-card" style={{
            ...fadeStyle(240),
            background: isDark ? 'rgba(233,185,73,0.08)' : 'rgba(233,185,73,0.1)',
            border: `1px solid rgba(233,185,73,0.3)`,
            borderRadius: 20, padding: '16px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(233,185,73,0.2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <AlertTriangle size={16} color={amber} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: textPrimary, fontSize: 14 }}>{summary.active_alert_count} active alert{summary.active_alert_count !== 1 ? 's' : ''}</div>
                <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>Review in Alerts tab</div>
              </div>
            </div>
            <ArrowRight size={16} color={amber} />
          </section>
        )}
      </div>
    </>
  );
};

export default MobilePortalOverview;
