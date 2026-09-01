import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { computeEpiAndEvents } from '../compute';
import { SectionCard, StatRow, StatTile, useLineChartOptions, useChartZoomState, ZoomResetButton } from './shared';
import type { TelemetryRow, ForecastRow } from '../types';

const ACCENT = '#f59e0b';

interface Props {
  telemetry: TelemetryRow[];
  forecast: ForecastRow[];
  forecastAccuracy?: any;
}

function pvKwFromRow(r: TelemetryRow): number {
  const pv = (Number(r.pv1_power_w ?? 0) + Number(r.pv2_power_w ?? 0)) / 1000;
  if (pv > 0) return pv;
  const inv = Number(r.inv_total_power_w ?? 0);
  const ac = Number(r.ac_output_power_w ?? 0);
  return (inv > 0 ? inv : ac) / 1000;
}

export default function PerformanceSection({ telemetry, forecast, forecastAccuracy }: Props) {
  const { chartRef, isZoomed, onZoomComplete, resetZoom } = useChartZoomState();

  const actual = useMemo(() => telemetry.map(r => ({ ts: r.timestamp, kw: pvKwFromRow(r) })), [telemetry]);
  const forecastPts = useMemo(() => forecast
    .filter(f => f.p50_kw != null)
    .map(f => ({ ts: (f.forecast_for || f.timestamp?.replace('FORECAST#', '') || ''), p50Kw: f.p50_kw as number }))
    .filter(f => f.ts), [forecast]);

  const { epiPct, events } = useMemo(
    () => computeEpiAndEvents(actual, forecastPts, { thresholdPct: 0.8, daylightFloorKw: 0.05 }),
    [actual, forecastPts],
  );

  const worstEvent = useMemo(
    () => events.reduce<typeof events[number] | null>((worst, e) => (!worst || e.avgDeficitPct > worst.avgDeficitPct ? e : worst), null),
    [events],
  );
  const longestEvent = useMemo(() => {
    let longest: { hours: number; tsStart: string } | null = null;
    for (const e of events) {
      const hours = (new Date(e.tsEnd).getTime() - new Date(e.tsStart).getTime()) / 3_600_000;
      if (Number.isFinite(hours) && hours > 0 && (!longest || hours > longest.hours)) longest = { hours, tsStart: e.tsStart };
    }
    return longest;
  }, [events]);

  const chartData = useMemo(() => {
    const labels = actual.map(a => new Date(a.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    const fMap = new Map(forecastPts.map(f => [f.ts, f.p50Kw]));
    return {
      labels,
      datasets: [
        { label: 'Actual PV (kW)', data: actual.map(a => a.kw), borderColor: ACCENT, backgroundColor: `${ACCENT}26`, fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
        { label: 'Forecast P50 (kW)', data: actual.map(a => fMap.get(a.ts) ?? null), borderColor: '#60a5fa', borderDash: [4, 3], fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5, spanGaps: true },
      ],
    };
  }, [actual, forecastPts]);

  const options = useLineChartOptions(ACCENT, () => onZoomComplete.current(), 'kW');

  return (
    <SectionCard
      title="Performance (EPI)"
      subtitle="Actual vs. weather-adjusted forecast (P50) — a live proxy for IEC 61724-1 Performance Ratio until GHI history is queryable · drag to zoom, scroll to zoom, reset to restore"
      action={<ZoomResetButton visible={isZoomed} onClick={resetZoom} />}
    >
      <StatRow>
        <StatTile label="EPI (Actual/Forecast)" value={epiPct != null ? `${epiPct.toFixed(0)}%` : '—'} accent={epiPct != null && epiPct < 80 ? '#f59e0b' : undefined} />
        <StatTile label="Underperformance Events" value={String(events.length)} sub={`< 80% of forecast P50, this window`} />
        {forecastAccuracy?.mae_kw != null && <StatTile label="Forecast MAE (30d)" value={`${Number(forecastAccuracy.mae_kw).toFixed(2)} kW`} />}
      </StatRow>
      {events.length > 0 && (
        <StatRow>
          <StatTile
            label="Worst Event"
            value={worstEvent ? `-${worstEvent.avgDeficitPct.toFixed(0)}%` : '—'}
            sub={worstEvent ? `started ${new Date(worstEvent.tsStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : undefined}
            accent="#ef4444"
          />
          <StatTile
            label="Longest Event"
            value={longestEvent ? (longestEvent.hours < 1 ? `${Math.round(longestEvent.hours * 60)}m` : `${longestEvent.hours.toFixed(1)}h`) : '—'}
            sub={longestEvent ? `started ${new Date(longestEvent.tsStart).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : undefined}
          />
        </StatRow>
      )}
      <div style={{ height: 220 }}>
        {actual.length > 0
          ? <Line ref={chartRef} data={chartData} options={options as any} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No data for this window</div>}
      </div>
    </SectionCard>
  );
}
