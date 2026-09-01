import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { bucketOutageHoursByWeek } from '../compute';
import { SectionCard, StatRow, StatTile, useBarChartOptions, useChartZoomState, ZoomResetButton } from './shared';
import type { DataQualityGap } from '../types';

const ACCENT = '#ef4444';

interface Props {
  gaps: DataQualityGap[];
  availabilityPct: number | null;
  latestTelemetryTs: string | null;
}

function formatAge(ts: string | null): string {
  if (!ts) return '—';
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 0) return 'just now';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export default function GridReliabilitySection({ gaps, availabilityPct, latestTelemetryTs }: Props) {
  const { chartRef, isZoomed, onZoomComplete, resetZoom } = useChartZoomState();

  const weekly = useMemo(() => bucketOutageHoursByWeek(gaps), [gaps]);
  const totalOutageHours = useMemo(() => weekly.reduce((s, w) => s + w.outageHours, 0), [weekly]);

  const worstWeek = useMemo(
    () => weekly.reduce<typeof weekly[number] | null>((best, w) => (!best || w.outageHours > best.outageHours ? w : best), null),
    [weekly],
  );

  const longestOutage = useMemo(() => {
    const gridGaps = gaps.filter(g => g.category === 'grid');
    let longest: { hours: number; start: string } | null = null;
    for (const g of gridGaps) {
      const hours = (new Date(g.tsEnd).getTime() - new Date(g.tsStart).getTime()) / 3_600_000;
      if (Number.isFinite(hours) && hours > 0 && (!longest || hours > longest.hours)) {
        longest = { hours, start: g.tsStart };
      }
    }
    return longest;
  }, [gaps]);

  const chartData = useMemo(() => ({
    labels: weekly.map(w => new Date(w.weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Outage hours',
      data: weekly.map(w => w.outageHours),
      backgroundColor: weekly.map(w => w.outageHours > 10 ? '#b91c1c' : ACCENT),
      borderRadius: 4,
    }],
  }), [weekly]);

  const options = useBarChartOptions(ACCENT, () => onZoomComplete.current(), 'hours');
  const freshnessMs = latestTelemetryTs ? Date.now() - new Date(latestTelemetryTs).getTime() : null;
  const isStale = freshnessMs != null && freshnessMs > 15 * 60 * 1000;

  return (
    <SectionCard
      title="Grid Reliability"
      subtitle="Confirmed grid-outage hours, weekly-bucketed · drag to zoom, scroll to zoom, reset to restore"
      action={<ZoomResetButton visible={isZoomed} onClick={resetZoom} />}
    >
      <StatRow>
        <StatTile
          label="Gateway Uptime (RS-485)"
          value={availabilityPct != null ? `${availabilityPct.toFixed(1)}%` : '—'}
          sub="heartbeat connectivity only — doesn't count Deye Cloud / smart-device fallback"
          accent={availabilityPct != null && availabilityPct < 50 ? '#f59e0b' : undefined}
        />
        <StatTile
          label="Data Freshness"
          value={formatAge(latestTelemetryTs)}
          sub={isStale ? 'no recent telemetry — device may be offline' : 'last telemetry received'}
          accent={isStale ? '#f59e0b' : '#34d399'}
        />
        <StatTile label="Total Outage" value={`${totalOutageHours.toFixed(1)} hrs`} sub="this window" />
        <StatTile label="Weeks with an outage" value={`${weekly.filter(w => w.outageHours > 0).length} / ${weekly.length || 0}`} />
      </StatRow>
      <StatRow>
        <StatTile
          label="Worst Week"
          value={worstWeek ? formatDuration(worstWeek.outageHours) : '—'}
          sub={worstWeek ? `week of ${new Date(worstWeek.weekStart).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : undefined}
        />
        <StatTile
          label="Longest Single Outage"
          value={longestOutage ? formatDuration(longestOutage.hours) : '—'}
          sub={longestOutage ? `started ${new Date(longestOutage.start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : undefined}
        />
      </StatRow>
      <div style={{ height: 200 }}>
        {weekly.length > 0
          ? <Bar ref={chartRef} data={chartData} options={options as any} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No grid-outage incidents in this window</div>}
      </div>
    </SectionCard>
  );
}
