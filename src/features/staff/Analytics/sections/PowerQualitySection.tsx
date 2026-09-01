import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { computePowerQualityBands } from '../compute';
import { SectionCard, StatRow, StatTile, useLineChartOptions, useChartZoomState, ZoomResetButton } from './shared';
import type { TelemetryRow } from '../types';

const ACCENT = '#60a5fa';

interface Props { telemetry: TelemetryRow[] }

export default function PowerQualitySection({ telemetry }: Props) {
  const { chartRef, isZoomed, onZoomComplete, resetZoom } = useChartZoomState();

  const { voltageOutOfBandPct, frequencyOutOfBandPct, series } = useMemo(() => computePowerQualityBands(telemetry), [telemetry]);

  const voltageStats = useMemo(() => {
    const vs = series.map(p => p.v).filter((v): v is number => v != null);
    if (!vs.length) return null;
    return { min: Math.min(...vs), max: Math.max(...vs), avg: vs.reduce((s, v) => s + v, 0) / vs.length };
  }, [series]);
  const frequencyStats = useMemo(() => {
    const hzs = series.map(p => p.hz).filter((v): v is number => v != null);
    if (!hzs.length) return null;
    return { min: Math.min(...hzs), max: Math.max(...hzs) };
  }, [series]);

  const chartData = useMemo(() => ({
    labels: series.map(p => new Date(p.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })),
    datasets: [
      { label: 'Grid Voltage L1 (V)', data: series.map(p => p.v), borderColor: ACCENT, backgroundColor: `${ACCENT}1f`, fill: true, tension: 0.2, pointRadius: 0, borderWidth: 1.5, yAxisID: 'y' },
      { label: 'Frequency (Hz)', data: series.map(p => p.hz), borderColor: '#f59e0b', fill: false, tension: 0.2, pointRadius: 0, borderWidth: 1, yAxisID: 'y1' },
    ],
  }), [series]);

  const baseOptions = useLineChartOptions(ACCENT, () => onZoomComplete.current(), 'V');
  const options = useMemo(() => ({
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      y1: { type: 'linear' as const, position: 'right' as const, ticks: { color: '#f59e0b', font: { size: 9 } }, grid: { drawOnChartArea: false } },
    },
  }), [baseOptions]);

  return (
    <SectionCard
      title="Power Quality"
      subtitle="Grid voltage (±10% of 230V nominal, 207–253V) and frequency (49.5–50.5Hz) · drag to zoom, scroll to zoom, reset to restore"
      action={<ZoomResetButton visible={isZoomed} onClick={resetZoom} />}
    >
      <StatRow>
        <StatTile label="Voltage Out-of-Band" value={`${voltageOutOfBandPct.toFixed(1)}%`} accent={voltageOutOfBandPct > 10 ? '#f59e0b' : undefined} />
        <StatTile label="Frequency Out-of-Band" value={`${frequencyOutOfBandPct.toFixed(1)}%`} accent={frequencyOutOfBandPct > 5 ? '#f59e0b' : undefined} />
        <StatTile
          label="Voltage Range"
          value={voltageStats ? `${voltageStats.min.toFixed(0)}–${voltageStats.max.toFixed(0)}V` : '—'}
          sub={voltageStats ? `avg ${voltageStats.avg.toFixed(1)}V` : undefined}
        />
        <StatTile label="Frequency Range" value={frequencyStats ? `${frequencyStats.min.toFixed(2)}–${frequencyStats.max.toFixed(2)}Hz` : '—'} />
      </StatRow>
      <div style={{ height: 220 }}>
        {series.length > 0
          ? <Line ref={chartRef} data={chartData} options={options as any} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No telemetry for this window</div>}
      </div>
    </SectionCard>
  );
}
