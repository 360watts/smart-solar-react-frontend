import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { computePshProxy } from '../compute';
import { SectionCard, StatRow, StatTile, useBarChartOptions, useChartZoomState, ZoomResetButton } from './shared';
import type { TelemetryRow } from '../types';

const ACCENT = '#fbbf24';

interface Props { telemetry: TelemetryRow[]; capacityKw: number | null | undefined }

export default function SolarResourceSection({ telemetry, capacityKw }: Props) {
  const daily = useChartZoomState();
  const hourly = useChartZoomState();

  const { dailyPsh, hourlyAvgKw } = useMemo(() => computePshProxy(telemetry, capacityKw), [telemetry, capacityKw]);
  const avgPsh = useMemo(() => dailyPsh.length ? dailyPsh.reduce((s, d) => s + d.psh, 0) / dailyPsh.length : null, [dailyPsh]);
  const bestDay = useMemo(
    () => dailyPsh.reduce<typeof dailyPsh[number] | null>((best, d) => (!best || d.psh > best.psh ? d : best), null),
    [dailyPsh],
  );
  const worstDay = useMemo(
    () => dailyPsh.reduce<typeof dailyPsh[number] | null>((worst, d) => (!worst || d.psh < worst.psh ? d : worst), null),
    [dailyPsh],
  );
  const totalKwh = useMemo(
    () => capacityKw ? dailyPsh.reduce((s, d) => s + d.psh * capacityKw, 0) : null,
    [dailyPsh, capacityKw],
  );
  const bestHour = useMemo(
    () => hourlyAvgKw.reduce<typeof hourlyAvgKw[number] | null>((best, h) => (!best || h.avgKw > best.avgKw ? h : best), null),
    [hourlyAvgKw],
  );

  const dailyChartData = useMemo(() => ({
    labels: dailyPsh.map(d => new Date(d.date).toLocaleDateString([], { month: 'short', day: 'numeric' })),
    datasets: [{ label: 'PSH (proxy)', data: dailyPsh.map(d => d.psh), backgroundColor: ACCENT, borderRadius: 4 }],
  }), [dailyPsh]);

  const hourlyChartData = useMemo(() => ({
    labels: hourlyAvgKw.map(h => `${h.hour}:00`),
    datasets: [{ label: 'Avg PV (kW)', data: hourlyAvgKw.map(h => h.avgKw), backgroundColor: '#f59e0b', borderRadius: 4 }],
  }), [hourlyAvgKw]);

  const dailyOptions = useBarChartOptions(ACCENT, () => daily.onZoomComplete.current(), 'psh');
  const hourlyOptions = useBarChartOptions('#f59e0b', () => hourly.onZoomComplete.current(), 'kW');

  return (
    <SectionCard
      title="Solar Resource"
      subtitle="PV output ÷ rated capacity — a peak-sun-hours proxy, not true GHI-integrated PSH (needs a backend weather-history endpoint)"
    >
      <StatRow>
        <StatTile label="Avg PSH / day (proxy)" value={avgPsh != null ? avgPsh.toFixed(2) : '—'} />
        <StatTile label="Total Energy (window)" value={totalKwh != null ? `${totalKwh.toFixed(1)} kWh` : '—'} />
        <StatTile label="Capacity (DC)" value={capacityKw != null ? `${capacityKw} kWp` : '—'} />
      </StatRow>
      <StatRow>
        <StatTile
          label="Best Day"
          value={bestDay ? bestDay.psh.toFixed(2) : '—'}
          sub={bestDay ? new Date(bestDay.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : undefined}
          accent="#34d399"
        />
        <StatTile
          label="Worst Day"
          value={worstDay ? worstDay.psh.toFixed(2) : '—'}
          sub={worstDay ? new Date(worstDay.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : undefined}
          accent="#f59e0b"
        />
        <StatTile label="Best Hour" value={bestHour ? `${bestHour.hour}:00 UTC` : '—'} sub={bestHour ? `${bestHour.avgKw.toFixed(2)} kW avg` : undefined} />
      </StatRow>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
        <ZoomResetButton visible={daily.isZoomed} onClick={daily.resetZoom} />
      </div>
      <div style={{ height: 180, marginBottom: 16 }}>
        {dailyPsh.length > 0
          ? <Bar ref={daily.chartRef} data={dailyChartData} options={dailyOptions as any} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>No data for this window</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>By clock hour (UTC), same window</div>
        <ZoomResetButton visible={hourly.isZoomed} onClick={hourly.resetZoom} />
      </div>
      <div style={{ height: 160 }}>
        <Bar ref={hourly.chartRef} data={hourlyChartData} options={hourlyOptions as any} />
      </div>
    </SectionCard>
  );
}
