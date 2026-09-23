// Maps DiagnosticReport.likely_component -> which existing Analytics section to embed in the
// report card. A proposed default, not final - revisit once real Reporter outputs are seen in
// practice (per the plan). "grid" gets GridReliabilitySection; everything else (inverter/
// pv_string/battery/null) gets PowerQualitySection, since a full telemetry line chart is lighter
// than pulling in a whole section for a report-card-sized embed.

import type { LikelyComponent } from './types';

export type EmbeddedChartKind = 'grid' | 'power_quality';

export function selectEmbeddedChart(component: LikelyComponent): EmbeddedChartKind {
  return component === 'grid' ? 'grid' : 'power_quality';
}
