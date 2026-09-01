import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { getDesignTokens } from '../../../shared/theme';
import { apiService } from '../../../services/api';
import { buildFleetLeaderboard, sumForecastEnergyKwh } from './compute';
import type { AnalyticsSite, FleetHealthReport, FleetLeaderboardRow } from './types';

interface Props {
  sites: AnalyticsSite[];
  onSelectSite: (siteId: string) => void;
}

interface FleetState {
  rows: FleetLeaderboardRow[];
  loading: boolean;
  error: string | null;
}

async function loadSiteRow(site: AnalyticsSite) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [energySummary, uptime, forecast] = await Promise.all([
    apiService.getEnergySummaryCombined(site.site_id).catch(() => null),
    apiService.getSiteUptime(site.site_id, 7).catch(() => null),
    apiService.getSiteForecast(site.site_id, { start_date: weekAgo.toISOString(), end_date: now.toISOString() }).catch(() => []),
  ]);
  const weeklyPvGenKwh = energySummary?.summary?.weekly?.pv_gen_kwh ?? null;
  const forecastKwh = Array.isArray(forecast) ? sumForecastEnergyKwh(forecast) : 0;
  const epiPct = weeklyPvGenKwh != null && forecastKwh > 0 ? (weeklyPvGenKwh / forecastKwh) * 100 : null;
  return { site, weeklyPvGenKwh, availabilityPct: uptime?.rollingAvgUptimePct ?? null, epiPct };
}

export default function FleetOverview({ sites, onSelectSite }: Props) {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  const [state, setState] = useState<FleetState>({ rows: [], loading: true, error: null });
  const [sortKey, setSortKey] = useState<keyof FleetLeaderboardRow>('specificYieldKwhPerKwp');

  const load = useCallback(async (showSpinner: boolean) => {
    if (!sites.length) { setState({ rows: [], loading: false, error: null }); return; }
    if (showSpinner) setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [perSite, fleetHealth]: [Array<Awaited<ReturnType<typeof loadSiteRow>>>, FleetHealthReport | null] = await Promise.all([
        Promise.all(sites.map(loadSiteRow)),
        apiService.getFleetHealthReport().catch(() => null),
      ]);
      const rows = buildFleetLeaderboard(perSite, fleetHealth);
      setState({ rows, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Failed to load fleet analytics' }));
    }
  }, [sites]);

  useEffect(() => {
    load(true);
    const iv = setInterval(() => { if (!document.hidden) load(false); }, 3 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const fleetKpis = useMemo(() => {
    const withYield = state.rows.filter(r => r.specificYieldKwhPerKwp != null);
    const withAvail = state.rows.filter(r => r.availabilityPct != null);
    const avgYield = withYield.length ? withYield.reduce((s, r) => s + r.specificYieldKwhPerKwp!, 0) / withYield.length : null;
    const avgAvail = withAvail.length ? withAvail.reduce((s, r) => s + r.availabilityPct!, 0) / withAvail.length : null;
    const totalAlerts = state.rows.reduce((s, r) => s + r.alertCount, 0);
    return { avgYield, avgAvail, totalAlerts, siteCount: state.rows.length };
  }, [state.rows]);

  const sortedRows = useMemo(() => {
    return state.rows.slice().sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv; // ascending — worst-first for ranking attention
      return String(av).localeCompare(String(bv));
    });
  }, [state.rows, sortKey]);

  const col = (key: keyof FleetLeaderboardRow, label: string) => (
    <th
      onClick={() => setSortKey(key)}
      style={{
        padding: '10px 14px', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.04em', textTransform: 'uppercase', color: sortKey === key ? tokens.primary : tokens.textDim,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </th>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Sites', value: String(fleetKpis.siteCount) },
          { label: 'Avg Specific Yield (7d)', value: fleetKpis.avgYield != null ? `${fleetKpis.avgYield.toFixed(2)} kWh/kWp` : '—' },
          { label: 'Avg Gateway Uptime (7d)', value: fleetKpis.avgAvail != null ? `${fleetKpis.avgAvail.toFixed(1)}%` : '—' },
          { label: 'Total Alerts', value: String(fleetKpis.totalAlerts), accent: fleetKpis.totalAlerts > 0 ? tokens.warning : undefined },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, minWidth: 160, background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.textDim }}>{k.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.accent ?? tokens.text, marginTop: 6 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {state.error && (
        <div style={{ padding: 14, borderRadius: 10, background: tokens.dangerSoft, color: tokens.danger, marginBottom: 16, fontSize: '0.85rem' }}>
          {state.error}
        </div>
      )}

      <div style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${tokens.border}`, fontWeight: 800, color: tokens.text }}>
          Site Leaderboard <span style={{ fontWeight: 500, fontSize: '0.78rem', color: tokens.textMuted }}>· click a row to open its deep-dive · click a column to sort</span>
          <div style={{ fontWeight: 500, fontSize: '0.74rem', color: tokens.textDim, marginTop: 4 }}>
            "Gateway Uptime" is RS-485 heartbeat connectivity only — a site can still be actively reporting via Deye Cloud / smart-device fallback while this reads low.
          </div>
        </div>
        {state.loading ? (
          <div style={{ padding: 24, color: tokens.textMuted, fontSize: '0.85rem' }}>Loading fleet analytics…</div>
        ) : sortedRows.length === 0 ? (
          <div style={{ padding: 24, color: tokens.textMuted, fontSize: '0.85rem' }}>No sites found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: tokens.textDim }}>Site</th>
                  {col('specificYieldKwhPerKwp', 'Specific Yield (7d)')}
                  {col('availabilityPct', 'Gateway Uptime')}
                  {col('epiPct', 'EPI (7d)')}
                  {col('alertCount', 'Alerts')}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr
                    key={row.siteId}
                    onClick={() => onSelectSite(row.siteId)}
                    style={{ borderTop: `1px solid ${tokens.border}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = tokens.surfaceMuted)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: tokens.text, fontSize: '0.85rem' }}>
                      {row.displayName} <span style={{ color: tokens.textDim, fontSize: '0.72rem' }}>· {row.siteId}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tokens.text }}>
                      {row.specificYieldKwhPerKwp != null ? row.specificYieldKwhPerKwp.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: tokens.text }}>
                      {row.availabilityPct != null ? `${row.availabilityPct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.epiPct != null && row.epiPct < 80 ? tokens.warning : tokens.text }}>
                      {row.epiPct != null ? `${row.epiPct.toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.alertCount > 0 ? tokens.warning : tokens.text }}>
                      {row.alertCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
