// Pure, side-effect-free derivations for the Real-Time Analytics page.
// Every formula here is documented in the plan doc alongside the verified field
// names/response shapes it depends on — don't rename inputs without re-checking that.

import type {
  TelemetryRow, ForecastRow, DataQualityGap, EnergySummaryWindow,
  FleetHealthReport, AnalyticsSite, FleetLeaderboardRow,
} from './types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function pvKwFromRow(r: TelemetryRow): number {
  const pv = (Number(r.pv1_power_w ?? 0) + Number(r.pv2_power_w ?? 0)
    + Number(r.pv3_power_w ?? 0) + Number(r.pv4_power_w ?? 0)) / 1000;
  if (pv > 0) return pv;
  // Fallback when PV strings are missing (standby-zeroed, night, etc.) — same
  // reasoning as NodeDetailModal.tsx's HISTORY_EXTRACT.solar: inv_total_power_w
  // is the real AC total; ac_output_power_w is phase-L1-only.
  const inv = Number(r.inv_total_power_w ?? 0);
  const ac = Number(r.ac_output_power_w ?? 0);
  return (inv > 0 ? inv : ac) / 1000;
}

function forecastTs(row: ForecastRow): string | null {
  const raw = row.forecast_for || row.timestamp?.replace('FORECAST#', '');
  return raw ?? null;
}

// ─── Self-Consumption Ratio ───────────────────────────────────────────────────

/** (pv_gen_kwh − grid_export_kwh) / pv_gen_kwh. Null when pv_gen_kwh is 0/absent (night / no data). */
export function computeSelfConsumptionRatio(today: EnergySummaryWindow | undefined | null): number | null {
  const pv = today?.pv_gen_kwh;
  const exported = today?.grid_export_kwh ?? 0;
  if (pv == null || pv <= 0) return null;
  return Math.max(0, Math.min(1, (pv - exported) / pv));
}

// ─── Specific Yield ───────────────────────────────────────────────────────────

/** periodEnergyKwh / capacityKw (kWh/kWp). Null when capacity is unknown/zero. */
export function computeSpecificYield(periodEnergyKwh: number | null | undefined, capacityKw: number | null | undefined): number | null {
  if (periodEnergyKwh == null || capacityKw == null || capacityKw <= 0) return null;
  return periodEnergyKwh / capacityKw;
}

// ─── EPI (Performance-Index proxy) + underperformance events ────────────────

export interface UnderperformanceEvent {
  tsStart: string;
  tsEnd: string;
  avgDeficitPct: number;
}

export interface EpiResult {
  epiPct: number | null;
  events: UnderperformanceEvent[];
}

/**
 * actualKwh(window) / forecastP50Kwh(window), plus interval-level underperformance
 * events (actual < thresholdPct of forecast P50, guarded by a daylight floor so
 * real nighttime zeros against a near-zero forecast aren't flagged).
 */
export function computeEpiAndEvents(
  actual: Array<{ ts: string; kw: number }>,
  forecast: Array<{ ts: string; p50Kw: number }>,
  opts?: { thresholdPct?: number; daylightFloorKw?: number },
): EpiResult {
  const thresholdPct = opts?.thresholdPct ?? 0.8;
  const daylightFloorKw = opts?.daylightFloorKw ?? 0.05;

  if (!actual.length || !forecast.length) return { epiPct: null, events: [] };

  const fSorted = forecast.slice().sort((a, b) => a.ts.localeCompare(b.ts));
  const fTsMs = fSorted.map(f => new Date(f.ts).getTime());

  const nearestForecast = (tsMs: number): number | null => {
    let lo = 0, hi = fTsMs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (fTsMs[mid] < tsMs) lo = mid + 1; else hi = mid; }
    const WINDOW_MS = 20 * 60 * 1000;
    let best: number | null = null, bestDiff = Infinity;
    for (const idx of [lo - 1, lo]) {
      if (idx < 0 || idx >= fSorted.length) continue;
      const diff = Math.abs(fTsMs[idx] - tsMs);
      if (diff < bestDiff && diff <= WINDOW_MS) { bestDiff = diff; best = fSorted[idx].p50Kw; }
    }
    return best;
  };

  let actualSum = 0;
  let forecastSum = 0;
  const events: UnderperformanceEvent[] = [];
  let openEvent: { tsStart: string; deficits: number[] } | null = null;

  const closeEvent = (tsEnd: string) => {
    if (!openEvent) return;
    const avgDeficitPct = openEvent.deficits.reduce((s, v) => s + v, 0) / openEvent.deficits.length;
    events.push({ tsStart: openEvent.tsStart, tsEnd, avgDeficitPct });
    openEvent = null;
  };

  const sortedActual = actual.slice().sort((a, b) => a.ts.localeCompare(b.ts));
  for (const row of sortedActual) {
    const tsMs = new Date(row.ts).getTime();
    const p50 = nearestForecast(tsMs);
    if (p50 == null) { closeEvent(row.ts); continue; }

    actualSum += row.kw;
    forecastSum += p50;

    if (p50 > daylightFloorKw && row.kw < thresholdPct * p50) {
      const deficitPct = (1 - row.kw / p50) * 100;
      if (!openEvent) openEvent = { tsStart: row.ts, deficits: [] };
      openEvent.deficits.push(deficitPct);
    } else {
      closeEvent(row.ts);
    }
  }
  if (openEvent) closeEvent(sortedActual[sortedActual.length - 1].ts);

  const epiPct = forecastSum > 0 ? (actualSum / forecastSum) * 100 : null;
  return { epiPct, events };
}

// ─── Grid Reliability: weekly-bucketed outage hours ──────────────────────────

export interface WeeklyOutage { weekStart: string; outageHours: number }

/** Sums grid-category incident spans into calendar weeks (Monday start, UTC). */
export function bucketOutageHoursByWeek(gaps: DataQualityGap[]): WeeklyOutage[] {
  const gridGaps = gaps.filter(g => g.category === 'grid');
  const buckets = new Map<string, number>();

  const weekStartOf = (d: Date): string => {
    const day = (d.getUTCDay() + 6) % 7; // Monday = 0
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    return monday.toISOString().slice(0, 10);
  };

  for (const g of gridGaps) {
    const start = new Date(g.tsStart).getTime();
    const end = new Date(g.tsEnd).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    // Split at week boundaries so a gap spanning two weeks attributes hours correctly.
    let cursor = start;
    while (cursor < end) {
      const cursorDate = new Date(cursor);
      const wk = weekStartOf(cursorDate);
      const nextMonday = new Date(wk);
      nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
      const segmentEnd = Math.min(end, nextMonday.getTime());
      const hours = (segmentEnd - cursor) / 3_600_000;
      buckets.set(wk, (buckets.get(wk) ?? 0) + hours);
      cursor = segmentEnd;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, outageHours]) => ({ weekStart, outageHours: +outageHours.toFixed(2) }));
}

// ─── Power Quality: voltage + frequency band % ───────────────────────────────

const VOLTAGE_BAND: [number, number] = [207, 253]; // ±10% of 230V nominal
const FREQUENCY_BAND: [number, number] = [49.5, 50.5]; // India grid nominal

export interface PowerQualityPoint { ts: string; v: number | null; hz: number | null; vInBand: boolean; hzInBand: boolean }

export interface PowerQualityResult {
  voltageOutOfBandPct: number;
  frequencyOutOfBandPct: number;
  series: PowerQualityPoint[];
}

export function computePowerQualityBands(rows: TelemetryRow[]): PowerQualityResult {
  let vSamples = 0, vOut = 0, hzSamples = 0, hzOut = 0;
  const series: PowerQualityPoint[] = rows.map(r => {
    const v = (r.grid_l1_voltage_v ?? r.grid_voltage_v) as number | null | undefined;
    const hz = r.grid_frequency_hz as number | null | undefined;
    const vInBand = v == null ? true : v >= VOLTAGE_BAND[0] && v <= VOLTAGE_BAND[1];
    const hzInBand = hz == null ? true : hz >= FREQUENCY_BAND[0] && hz <= FREQUENCY_BAND[1];
    if (v != null) { vSamples++; if (!vInBand) vOut++; }
    if (hz != null) { hzSamples++; if (!hzInBand) hzOut++; }
    return { ts: r.timestamp, v: v ?? null, hz: hz ?? null, vInBand, hzInBand };
  });
  return {
    voltageOutOfBandPct: vSamples > 0 ? (vOut / vSamples) * 100 : 0,
    frequencyOutOfBandPct: hzSamples > 0 ? (hzOut / hzSamples) * 100 : 0,
    series,
  };
}

// ─── Solar Resource: PSH proxy ────────────────────────────────────────────────

export interface PshResult {
  dailyPsh: Array<{ date: string; psh: number }>;
  hourlyAvgKw: Array<{ hour: number; avgKw: number }>;
}

/** PV-output-over-capacity proxy for peak sun hours — not true GHI-integrated PSH (see plan doc). */
export function computePshProxy(rows: TelemetryRow[], capacityKw: number | null | undefined): PshResult {
  if (!capacityKw || capacityKw <= 0 || !rows.length) return { dailyPsh: [], hourlyAvgKw: [] };

  const sorted = rows.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const bucketHours = inferBucketHours(sorted);

  const dailyEnergy = new Map<string, number>();
  const hourlySum = new Map<number, { sum: number; count: number }>();

  for (const r of sorted) {
    const d = new Date(r.timestamp);
    const dateKey = d.toISOString().slice(0, 10);
    const kw = pvKwFromRow(r);
    dailyEnergy.set(dateKey, (dailyEnergy.get(dateKey) ?? 0) + kw * bucketHours);
    const hour = d.getUTCHours();
    const h = hourlySum.get(hour) ?? { sum: 0, count: 0 };
    h.sum += kw; h.count += 1;
    hourlySum.set(hour, h);
  }

  const dailyPsh = Array.from(dailyEnergy.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, kwh]) => ({ date, psh: +(kwh / capacityKw).toFixed(2) }));

  const hourlyAvgKw = Array.from({ length: 24 }, (_, hour) => {
    const h = hourlySum.get(hour);
    return { hour, avgKw: h && h.count > 0 ? +(h.sum / h.count).toFixed(2) : 0 };
  });

  return { dailyPsh, hourlyAvgKw };
}

function inferBucketHours(rows: TelemetryRow[]): number {
  if (rows.length < 2) return 0.25;
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const diffH = (new Date(rows[i].timestamp).getTime() - new Date(rows[i - 1].timestamp).getTime()) / 3_600_000;
    if (Number.isFinite(diffH) && diffH > 0) gaps.push(diffH);
  }
  if (!gaps.length) return 0.25;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

// ─── System Utilization: % of readings ≥ threshold of nameplate, by hour ─────

export function computeUtilizationByHour(
  rows: TelemetryRow[], capacityKw: number | null | undefined, thresholdPct = 0.8,
): Array<{ hour: number; pctAboveThreshold: number }> {
  if (!capacityKw || capacityKw <= 0) return Array.from({ length: 24 }, (_, hour) => ({ hour, pctAboveThreshold: 0 }));

  const buckets = new Map<number, { above: number; total: number }>();
  for (const r of rows) {
    const hour = new Date(r.timestamp).getUTCHours();
    const kw = pvKwFromRow(r);
    const b = buckets.get(hour) ?? { above: 0, total: 0 };
    b.total += 1;
    if (kw >= thresholdPct * capacityKw) b.above += 1;
    buckets.set(hour, b);
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const b = buckets.get(hour);
    return { hour, pctAboveThreshold: b && b.total > 0 ? +((b.above / b.total) * 100).toFixed(1) : 0 };
  });
}

// ─── Forecast-energy integration (trapezoidal) ───────────────────────────────

/** Trapezoidal-integrates a P50 forecast series (kW, per-slot) into total kWh over its span. */
export function sumForecastEnergyKwh(rows: ForecastRow[]): number {
  const pts = rows
    .map(r => ({ ts: r.forecast_for || r.timestamp?.replace('FORECAST#', ''), p50: r.p50_kw }))
    .filter((r): r is { ts: string; p50: number } => !!r.ts && r.p50 != null)
    .map(r => ({ msTs: new Date(r.ts).getTime(), p50: r.p50 }))
    .sort((a, b) => a.msTs - b.msTs);

  let kwh = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const hours = (pts[i + 1].msTs - pts[i].msTs) / 3_600_000;
    if (hours > 0 && hours < 6) kwh += (pts[i].p50 + pts[i + 1].p50) / 2 * hours;
  }
  return kwh;
}

// ─── Energy Flow: live snapshot + window-cumulative energy ──────────────────

export interface LiveFlow {
  pvKw: number | null;
  loadKw: number | null;
  gridKw: number | null;
  battKw: number | null;
  battSoc: number | null;
  ts: string | null;
}

/**
 * Direct extraction from the single most-recent telemetry row — the flow
 * diagram shows an instantaneous power flow (kW), which only means
 * something as a live/point-in-time reading, not averaged or summed across
 * a multi-day window. Cumulative totals for the window belong in
 * computeCumulativeEnergy below instead.
 */
export function latestFlowFromRow(row: TelemetryRow | undefined): LiveFlow {
  if (!row) return { pvKw: null, loadKw: null, gridKw: null, battKw: null, battSoc: null, ts: null };
  return {
    pvKw: pvKwFromRow(row),
    loadKw: row.load_power_w != null ? Number(row.load_power_w) / 1000 : null,
    gridKw: row.grid_power_w != null ? Number(row.grid_power_w) / 1000 : null,
    battKw: row.battery_power_w != null ? Number(row.battery_power_w) / 1000 : null,
    battSoc: row.battery_soc_percent ?? null,
    ts: row.timestamp,
  };
}

export interface CumulativeEnergy {
  pvKwh: number;
  loadKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  battChargeKwh: number;
  battDischargeKwh: number;
  sampleCount: number;
}

/**
 * Trapezoidal(-ish, fixed-bucket) integration of power over the window into
 * total energy per flow leg — this is the "cumulative" figure a multi-day
 * window should show, as opposed to an instantaneous kW flow.
 * Sign convention (matches SiteDataPanel/EnergyFlow throughout this app):
 * grid < 0 = export, battery < 0 = charging.
 */
export function computeCumulativeEnergy(rows: TelemetryRow[]): CumulativeEnergy {
  const zero: CumulativeEnergy = { pvKwh: 0, loadKwh: 0, gridImportKwh: 0, gridExportKwh: 0, battChargeKwh: 0, battDischargeKwh: 0, sampleCount: rows.length };
  if (!rows.length) return zero;

  const bucketHours = inferBucketHours(rows.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
  const out = { ...zero };

  for (const r of rows) {
    out.pvKwh += pvKwFromRow(r) * bucketHours;
    if (r.load_power_w != null) out.loadKwh += (Number(r.load_power_w) / 1000) * bucketHours;
    if (r.grid_power_w != null) {
      const gridKw = Number(r.grid_power_w) / 1000;
      if (gridKw >= 0) out.gridImportKwh += gridKw * bucketHours;
      else out.gridExportKwh += -gridKw * bucketHours;
    }
    if (r.battery_power_w != null) {
      const battKw = Number(r.battery_power_w) / 1000;
      if (battKw < 0) out.battChargeKwh += -battKw * bucketHours;
      else out.battDischargeKwh += battKw * bucketHours;
    }
  }

  return out;
}

// ─── Fleet leaderboard ────────────────────────────────────────────────────────

export function buildFleetLeaderboard(
  sites: Array<{ site: AnalyticsSite; weeklyPvGenKwh: number | null; availabilityPct: number | null; epiPct: number | null }>,
  fleetHealth: FleetHealthReport | null,
): FleetLeaderboardRow[] {
  const alertsBySite = new Map<string, number>();
  const devices = fleetHealth?.data?.devices ?? {};
  for (const dev of Object.values(devices)) {
    const count = dev.alerts?.total ?? 0;
    alertsBySite.set(dev.site_id, (alertsBySite.get(dev.site_id) ?? 0) + count);
  }

  return sites.map(({ site, weeklyPvGenKwh, availabilityPct, epiPct }) => ({
    siteId: site.site_id,
    displayName: site.display_name,
    specificYieldKwhPerKwp: computeSpecificYield(weeklyPvGenKwh, site.capacity_kw),
    availabilityPct,
    alertCount: alertsBySite.get(site.site_id) ?? 0,
    epiPct,
  }));
}
