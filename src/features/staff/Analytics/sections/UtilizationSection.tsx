import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { computeUtilizationByHour } from '../compute';
import { SectionCard, StatRow, StatTile, useBarChartOptions, useChartZoomState, ZoomResetButton } from './shared';
import type { TelemetryRow } from '../types';

const ACCENT = '#34d399';

interface Props { telemetry: TelemetryRow[]; capacityKw: number | null | undefined }

export default function UtilizationSection({ telemetry, capacityKw }: Props) {
  const { chartRef, isZoomed, onZoomComplete, resetZoom } = useChartZoomState();

  const byHour = useMemo(() => computeUtilizationByHour(telemetry, capacityKw, 0.8), [telemetry, capacityKw]);
  const peakHour = useMemo(() => byHour.reduce((best, h) => h.pctAboveThreshold > best.pctAboveThreshold ? h : best, byHour[0]), [byHour]);
  const overallPct = useMemo(() => byHour.reduce((s, h) => s + h.pctAboveThreshold, 0) / (byHour.length || 1), [byHour]);
  const productiveHours = useMemo(() => byHour.filter(h => h.pctAboveThreshold >= 50).length, [byHour]);
  const utilizationWindow = useMemo(() => {
    // Contiguous hour-of-day range where utilization is meaningfully above zero —
    // e.g. "9:00–16:00" instead of just a single peak hour.
    const active = byHour.filter(h => h.pctAboveThreshold > 0).map(h => h.hour);
    if (!active.length) return null;
    return { first: Math.min(...active), last: Math.max(...active) };
  }, [byHour]);

  const chartData = useMemo(() => ({
    labels: byHour.map(h => `${h.hour}:00`),
    datasets: [{ label: '% readings ≥80% nameplate', data: byHour.map(h => h.pctAboveThreshold), backgroundColor: ACCENT, borderRadius: 4 }],
  }), [byHour]);

  const options = useBarChartOptions(ACCENT, () => onZoomComplete.current(), '%');

  return (
    <SectionCard
      title="System Utilization"
      subtitle="Share of readings hitting ≥80% of nameplate (DC) capacity, by clock hour (UTC) · drag to zoom, scroll to zoom, reset to restore"
      action={<ZoomResetButton visible={isZoomed} onClick={resetZoom} />}
    >
      <StatRow>
        <StatTile label="Peak Hour" value={peakHour ? `${peakHour.hour}:00` : '—'} sub={peakHour ? `${peakHour.pctAboveThreshold.toFixed(0)}% of readings` : undefined} />
        <StatTile label="Avg Across Hours" value={`${overallPct.toFixed(1)}%`} />
        <StatTile label="Productive Hours" value={`${productiveHours} / 24`} sub="hours ≥50% of readings at nameplate" />
        <StatTile
          label="Active Window"
          value={utilizationWindow ? `${utilizationWindow.first}:00–${utilizationWindow.last}:00` : '—'}
          sub="UTC, any nameplate-level output"
        />
      </StatRow>
      <div style={{ height: 200 }}>
        {telemetry.length > 0
          ? <Bar ref={chartRef} data={chartData} options={options as any} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No data for this window</div>}
      </div>
    </SectionCard>
  );
}
