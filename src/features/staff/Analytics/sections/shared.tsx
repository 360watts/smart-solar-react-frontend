import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Tooltip as CJTooltip, Legend as CJLegend, Filler,
  type ChartOptions,
} from 'chart.js';
import ZoomPlugin from 'chartjs-plugin-zoom';
import { useTheme } from '../../../../contexts/ThemeContext';
import { getDesignTokens } from '../../../../shared/theme';
import { resolveCssVar } from '../../../../shared/lib/resolveCssVar';
import { createDragZoomPlugins, useChartZoomState, ZoomResetButton } from '../../../../shared/components/SiteDataPanel/chartUtils';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  CJTooltip, CJLegend, Filler, ZoomPlugin,
);

export { useChartZoomState, ZoomResetButton };

// ─── Section shell ────────────────────────────────────────────────────────────

export function SectionCard({
  title, subtitle, action, children,
}: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  return (
    <div style={{
      background: tokens.surface, border: `1px solid ${tokens.border}`,
      borderRadius: 16, padding: '18px 20px', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: tokens.text, letterSpacing: '-0.01em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '0.78rem', color: tokens.textMuted, marginTop: 3 }}>{subtitle}</div>}
        </div>
        {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  const { isDark } = useTheme();
  const tokens = getDesignTokens(isDark);
  return (
    <div style={{
      background: tokens.surfaceMuted, border: `1px solid ${tokens.border}`,
      borderRadius: 12, padding: '12px 14px', minWidth: 120, flex: 1,
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.textDim }}>{label}</div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: accent ?? tokens.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: tokens.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>{children}</div>;
}

// ─── Chart option builders ────────────────────────────────────────────────────
// Memoized on theme + accent only — never rebuilt on a poll tick, or
// chartjs-plugin-zoom's scale-min/max mutation gets wiped on the next render
// (the bug fixed in NodeDetailModal.tsx this session).

export function useLineChartOptions(accentColor: string, onZoomComplete: () => void, yLabel?: string): ChartOptions<'line'> {
  const { isDark } = useTheme();
  const tickColor = resolveCssVar('--muted-foreground');
  const ttBg = resolveCssVar('--popover');
  const ttTitle = resolveCssVar('--foreground');
  const ttBody = resolveCssVar('--muted-foreground');

  return useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, labels: { color: tickColor, font: { size: 11 }, boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: { backgroundColor: ttBg, titleColor: ttTitle, bodyColor: ttBody, borderColor: `${accentColor}40`, borderWidth: 1, padding: 8 },
      zoom: createDragZoomPlugins(onZoomComplete),
    } as any,
    scales: {
      x: { ticks: { color: tickColor, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      y: { ticks: { color: tickColor, font: { size: 10 } }, grid: { display: false }, title: yLabel ? { display: true, text: yLabel, color: tickColor, font: { size: 9 } } : undefined },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark, accentColor]);
}

export function useBarChartOptions(accentColor: string, onZoomComplete: () => void, yLabel?: string): ChartOptions<'bar'> {
  const { isDark } = useTheme();
  const tickColor = resolveCssVar('--muted-foreground');
  const ttBg = resolveCssVar('--popover');
  const ttTitle = resolveCssVar('--foreground');
  const ttBody = resolveCssVar('--muted-foreground');

  return useMemo(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: ttBg, titleColor: ttTitle, bodyColor: ttBody, borderColor: `${accentColor}40`, borderWidth: 1, padding: 8 },
      zoom: createDragZoomPlugins(onZoomComplete),
    } as any,
    scales: {
      x: { ticks: { color: tickColor, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } },
      y: { ticks: { color: tickColor, font: { size: 10 } }, grid: { display: false }, title: yLabel ? { display: true, text: yLabel, color: tickColor, font: { size: 9 } } : undefined },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark, accentColor]);
}

export function LoadingBlock({ height = 180 }: { height?: number }) {
  const { isDark } = useTheme();
  return <div style={{ height, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />;
}
