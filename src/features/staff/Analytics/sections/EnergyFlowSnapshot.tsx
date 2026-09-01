import React, { useMemo } from 'react';
import EnergyFlowBlock from '../../../../shared/components/EnergyFlow';
import { computeCumulativeEnergy, latestFlowFromRow } from '../compute';
import { SectionCard, StatRow, StatTile } from './shared';
import type { TelemetryRow, AnalyticsWindow } from '../types';

const WINDOW_LABEL: Record<AnalyticsWindow, string> = {
  '24h': 'last 24 hours', '7d': 'last 7 days', '30d': 'last 30 days', custom: 'the selected range',
};

interface Props {
  siteId: string;
  telemetry: TelemetryRow[];
  win: AnalyticsWindow;
  smartDevices?: any[];
  ctReading?: any | null;
}

function formatAge(ts: string | null): string {
  if (!ts) return '—';
  const min = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return hr < 48 ? `${hr}h ago` : `${Math.floor(hr / 24)}d ago`;
}

export default function EnergyFlowSnapshot({ siteId, telemetry, win, smartDevices = [], ctReading }: Props) {
  const live = useMemo(() => latestFlowFromRow(telemetry[telemetry.length - 1]), [telemetry]);
  const cumulative = useMemo(() => computeCumulativeEnergy(telemetry), [telemetry]);
  const selfConsumption = cumulative.pvKwh > 0
    ? Math.max(0, Math.min(1, (cumulative.pvKwh - cumulative.gridExportKwh) / cumulative.pvKwh))
    : null;

  return (
    <SectionCard
      title="Energy Flow"
      subtitle={`Live power flow (as of ${formatAge(live.ts)}) · cumulative totals below are for ${WINDOW_LABEL[win]} (${cumulative.sampleCount} samples)`}
    >
      {telemetry.length > 0 ? (
        <EnergyFlowBlock
          pvKw={live.pvKw} loadKw={live.loadKw} gridKw={live.gridKw}
          battKw={live.battKw} battSoc={live.battSoc}
          siteId={siteId} smartDevices={smartDevices} ctReading={ctReading}
        />
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>
          No telemetry for this window
        </div>
      )}

      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted-foreground)', margin: '18px 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Cumulative · {WINDOW_LABEL[win]}
      </div>
      <StatRow>
        <StatTile label="Self-Consumption" value={selfConsumption != null ? `${(selfConsumption * 100).toFixed(0)}%` : '—'} sub="of PV generated, consumed on-site" />
        <StatTile label="PV Generated" value={`${cumulative.pvKwh.toFixed(1)} kWh`} />
        <StatTile label="Load Consumed" value={`${cumulative.loadKwh.toFixed(1)} kWh`} />
      </StatRow>
      <StatRow>
        <StatTile label="Grid Imported" value={`${cumulative.gridImportKwh.toFixed(1)} kWh`} />
        <StatTile label="Grid Exported" value={`${cumulative.gridExportKwh.toFixed(1)} kWh`} />
        <StatTile label="Battery Charged" value={`${cumulative.battChargeKwh.toFixed(1)} kWh`} />
        <StatTile label="Battery Discharged" value={`${cumulative.battDischargeKwh.toFixed(1)} kWh`} />
      </StatRow>
    </SectionCard>
  );
}
