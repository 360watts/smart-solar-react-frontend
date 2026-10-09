export const fmtPower = (kw: number) =>
  Math.abs(kw) >= 1
    ? { valueStr: Math.abs(kw).toFixed(2), unit: 'kW' }
    : { valueStr: (Math.abs(kw) * 1000).toFixed(0), unit: 'W' };

/** Whole-home live power: inverter backup load + grid-direct circuit + EV charger. Never negative.
 *  Caveat (possible double count): if the "grid-direct" CT sits on the grid MAIN, it also sees the
 *  backup bus, so backup would be counted twice. coim_002's CT is a separate submeter, so we add. */
export const wholeHomeKw = (load: number, gridDirectKw: number, evKw: number, ctReversed = false) =>
  Math.max(0, load) + (ctReversed ? 0 : Math.max(0, gridDirectKw)) + Math.max(0, evKw);

/** "Backup 237 W · EV 2.68 kW": only the parts above zero; '' when all are zero. */
export function homePartsText(load: number, gridDirectKw: number, evKw: number, ctReversed = false) {
  const p = (n: string, kw: number) => { const f = fmtPower(kw); return `${n} ${f.valueStr} ${f.unit}`; };
  return [['Backup', load], ['Grid direct', ctReversed ? 0 : gridDirectKw], ['EV', evKw]]
    .filter(([, kw]) => (kw as number) > 0).map(([n, kw]) => p(n as string, kw as number)).join(' · ');
}

export interface MixShares { solar: number; battery: number; grid: number }

// What is powering things right now. Sign convention matches EnergyFlowBlock:
// battKw > 0 discharging, gridKw > 0 importing. Charging / exporting are not supply.
export function mixShares(pvKw: number | null, battKw: number | null, gridKw: number | null): MixShares | null {
  const solar = Math.max(0, pvKw ?? 0);
  const battery = Math.max(0, battKw ?? 0);
  const grid = Math.max(0, gridKw ?? 0);
  const total = solar + battery + grid;
  if (!(total > 0)) return null;
  return { solar: solar / total, battery: battery / total, grid: grid / total };
}

const kwh = (v: unknown): number | null => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** GET /sites/<id>/staff-overview/ `home_today`: whole-home kWh for the site's local day. */
export interface HomeToday {
  date: string;
  backup_kwh: number | null; grid_direct_kwh: number | null; ev_kwh: number | null;
  total_kwh: number | null; // sum of the known parts only
  covers: string[];         // which parts are in total_kwh: 'backup' | 'grid_direct' | 'ev'
  partial: boolean;         // an applicable part has no data
}

const PART_WORDS: Record<string, string> = { backup: 'Backup', grid_direct: 'Grid direct', ev: 'EV' };
export const coversWords = (covers: string[]) => covers.map(c => PART_WORDS[c] ?? c).join(' + ');

// Left-rail "today" figures. "Home used" is the backend's whole-home figure (home_today:
// inverter backup bus + grid-direct meter + EV plugs, local day). home_today null = backend
// has no figure ("—"); home_today absent (undefined, older backend) = fall back to the
// inverter's own daily load counter (latest.load_today_kwh, midnight IST reset), which is the
// Overview Load tile's number and misses grid-direct / EV. Never energy_summary_today.load_kwh
// (solar day, from 06:00). Own-power = 1 - grid_buy_today_kwh / used, only when used is known.
// A reading from an earlier IST day gives nulls ("—") rather than yesterday's totals.
export function railToday(solarDay: Record<string, number> | null | undefined, latest: any, isLatestToday: boolean, home?: HomeToday | null) {
  const used = home !== undefined ? kwh(home?.total_kwh) : isLatestToday ? kwh(latest?.load_today_kwh) : null;
  const gridIn = isLatestToday ? kwh(latest?.grid_buy_today_kwh) : null;
  return {
    solarKwh: kwh(solarDay?.pv_gen_kwh),
    usedKwh: used,
    ownPct: used != null && used > 0 && gridIn != null
      ? Math.max(0, Math.min(100, (1 - gridIn / used) * 100))
      : null,
    // Shown under "Home used" when an applicable part is missing: what the figure includes.
    usedPartial: used != null && home?.partial ? coversWords(home.covers ?? []) : null,
  };
}

// Line weight carries magnitude (replaces widthForKw, 2..12 -> 2..8 for the thinner house look).
export const lineWidth = (kw: number) => Math.min(8, Math.max(2, Math.abs(kw) * 1.6));

export interface Pt { x: number; y: number }
export interface Ring { cx: number; cy: number; r: number } // r = OUTER radius
export interface Anchors {
  solar: Pt; batt: Pt; grid: Pt;      // bottom-centre of each source card
  ring: Ring;
  loads: Pt[];                        // top-centre of Backup, [EV,] Grid direct cards (2 when the site has no EV plug)
}

const onRing = (ring: Ring, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return { x: ring.cx + ring.r * Math.cos(a), y: ring.cy + ring.r * Math.sin(a) };
};
const S = (from: Pt, to: Pt) => {
  const my = from.y + (to.y - from.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${my} ${to.x} ${my} ${to.x} ${to.y}`;
};
const rev = (from: Pt, to: Pt) => S(to, from);

export function flowPaths(a: Anchors) {
  const nw = onRing(a.ring, 225), n = onRing(a.ring, 270), ne = onRing(a.ring, 315);
  const sw = onRing(a.ring, 135), s = onRing(a.ring, 90), se = onRing(a.ring, 45);
  return {
    solar: S(a.solar, nw),
    gridIn: S(a.grid, ne),
    gridOut: rev(a.grid, ne),
    battIn: S(a.batt, n),   // battery -> ring (discharging)
    battOut: rev(a.batt, n), // ring -> battery (charging)
    // 3 loads: SW / S / SE of the ring; 2 loads (no EV): SW and SE only.
    loads: a.loads.length === 2 ? [S(sw, a.loads[0]), S(se, a.loads[1])] : [S(sw, a.loads[0]), S(s, a.loads[1]), S(se, a.loads[2])],
  };
}
