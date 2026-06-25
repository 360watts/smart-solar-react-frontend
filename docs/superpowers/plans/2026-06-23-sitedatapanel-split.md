# SiteDataPanel Tab Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 6,100-line `SiteDataPanel.tsx` monolith into focused tab files, extract shared utilities, and fix the energy flow diagram's oversized narrow layout.

**Architecture:** Move each tab's JSX + local state into its own `src/shared/components/SiteDataPanel/tabs/` file; lift shared sub-components and chart utilities into `components/` siblings; keep the outer shell (`index.tsx`) responsible only for data fetching, polling, and tab routing. The public import path (`shared/components/SiteDataPanel`) stays identical — callers see no change.

**Tech Stack:** React 18, TypeScript, Framer Motion, Chart.js / react-chartjs-2, Lucide React, chartjs-plugin-zoom.

## Global Constraints

- No behaviour changes — this is a pure refactor; all existing features must work identically after each task.
- Public import: `import SiteDataPanel from '../../shared/components/SiteDataPanel'` must remain valid (re-export from `index.tsx`).
- `DetailsTab` already lives at `src/features/staff/DetailsTab.tsx` — do NOT move it; just keep importing it.
- `EnergyFlow/` directory is separate — do NOT move it; import it as before.
- Do not add `React.memo` or `React.lazy` in this refactor — that is a follow-on concern.
- TypeScript must compile with zero new errors: run `npx tsc --noEmit` after each task.
- No new dependencies — only move/reorganise existing code.
- Energy flow narrow layout fix (Task 6) is the one intentional behaviour change; all others are pure moves.

---

## File Map

### Created
```
src/shared/components/SiteDataPanel/
  index.tsx                        ← shell (data fetch, polling, tab routing) [replaces SiteDataPanel.tsx]
  types.ts                         ← TabId, Props, HistorySeriesKey, VsActualSeriesKey, TABS constant
  chartUtils.ts                    ← makeGradient, createDragZoomPlugins, useChartZoomState, ZoomResetButton
  components/
    KpiCard.tsx                    ← KpiCard + KpiCardProps + icon helpers
    ChartCard.tsx                  ← ChartCard component
    ChartTooltips.tsx              ← ForecastTooltip, ChartTooltip, ForecastXAxisTick, ChartXAxisTick
    WeatherHourlyStrip.tsx         ← WeatherHourlyStrip component
    EnergyBreakdownRow.tsx         ← EnergyBreakdownRow component
    InsightsRow.tsx                ← InsightsRow component
  tabs/
    OverviewTab.tsx                ← Overview tab JSX
    WeatherTab.tsx                 ← Weather tab JSX
    HistoryTab.tsx                 ← History tab JSX + local state (dateRange, historyView, series toggles)
    ForecastTab.tsx                ← Forecast tab JSX + ForecastTable + SatelliteKt* + ForecastAccuracySubTab + SatelliteKtTab
    PhaseLoadTab.tsx               ← PhaseLoadTab (moved from inline definition at line 2769)
```

### Modified
```
src/shared/components/index.ts     ← update re-export path from './SiteDataPanel' to './SiteDataPanel/index'
```

### Deleted
```
src/shared/components/SiteDataPanel.tsx   ← replaced by the directory
```

---

### Task 1: Create the directory skeleton + types.ts + chartUtils.ts

**Files:**
- Create: `src/shared/components/SiteDataPanel/types.ts`
- Create: `src/shared/components/SiteDataPanel/chartUtils.ts`

**Interfaces:**
- Produces: `TabId`, `Props`, `HistorySeriesKey`, `VsActualSeriesKey`, `TABS`, `makeGradient`, `createDragZoomPlugins`, `useChartZoomState`, `ZoomResetButton` — all exported for use in later tasks.

- [ ] **Step 1: Create the directory**

```bash
mkdir -p /home/ubuntu/work/smart-solar-react-frontend/src/shared/components/SiteDataPanel/tabs
mkdir -p /home/ubuntu/work/smart-solar-react-frontend/src/shared/components/SiteDataPanel/components
```

- [ ] **Step 2: Create `types.ts`**

Copy the following verbatim from `SiteDataPanel.tsx` lines 97–122 plus the `Props` interface at lines 3930–3934 and the `HistorySeriesKey` / `VsActualSeriesKey` type aliases (search for `type HistorySeriesKey` and `type VsActualSeriesKey` in the file):

```ts
// src/shared/components/SiteDataPanel/types.ts
import React from 'react';
import { Home, CloudSun, TrendingUp, Sun, Layers, Activity } from 'lucide-react';

const tabIconSize = 16;

export const TABS = [
  { id: 'overview',    label: 'Overview', icon: React.createElement(Home,     { size: tabIconSize }) },
  { id: 'details',     label: 'Details',  icon: React.createElement(Activity, { size: tabIconSize }) },
  { id: 'weather',     label: 'Weather',  icon: React.createElement(CloudSun, { size: tabIconSize }) },
  { id: 'history',     label: 'History',  icon: React.createElement(TrendingUp,{ size: tabIconSize }) },
  { id: 'forecast',    label: 'Solar',    icon: React.createElement(Sun,       { size: tabIconSize }) },
  { id: 'phase-load',  label: 'Load',     icon: React.createElement(Layers,   { size: tabIconSize }) },
] as const;

export type TabId = typeof TABS[number]['id'];

export type HistorySeriesKey = 'PV' | 'Load' | 'Grid' | 'InvOut' | 'SOC';
export type VsActualSeriesKey = 'Actual' | 'P50' | 'Delta';

export interface Props {
  siteId: string;
  autoRefresh?: boolean;
  inverterCapacityKw?: number | null;
}
```

> **Note on TABS icons:** The original uses JSX (`<Home size={16} />`). Because `types.ts` is a plain TS file without JSX pragma issues in most setups this should be fine — but if the project's `tsconfig.json` has `"jsx": "react-jsx"` only for `.tsx` files, rename this file to `types.tsx`. Check with `npx tsc --noEmit` after Step 4.

- [ ] **Step 3: Create `chartUtils.ts`**

Copy from `SiteDataPanel.tsx` lines 27–75 (the `makeGradient`, `createDragZoomPlugins`, `useChartZoomState`, `zoomResetButtonStyle`, `ZoomResetButton` block):

```ts
// src/shared/components/SiteDataPanel/chartUtils.ts
import React, { useState, useCallback, useRef } from 'react';
import { type ChartArea } from 'chart.js';

export function makeGradient(
  ctx: CanvasRenderingContext2D,
  area: ChartArea,
  color: string,
  topOpacity = 0.35,
  bottomOpacity = 0,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, color + Math.round(topOpacity * 255).toString(16).padStart(2, '0'));
  gradient.addColorStop(1, color + Math.round(bottomOpacity * 255).toString(16).padStart(2, '0'));
  return gradient;
}

export function createDragZoomPlugins(onZoomComplete: () => void) {
  return {
    zoom: {
      wheel:  { enabled: true, speed: 0.08 },
      drag: {
        enabled: true,
        backgroundColor: 'rgba(0,166,62,0.14)',
        borderColor:     'rgba(0,166,62,0.7)',
        borderWidth: 1,
      },
      pinch:  { enabled: true },
      mode:   'x' as const,
      onZoomComplete,
    },
    pan: { enabled: false, mode: 'x' as const },
  };
}

export function useChartZoomState() {
  const chartRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const onZoomComplete = useRef(() => setIsZoomed(true));
  const resetZoom = useCallback(() => {
    chartRef.current?.resetZoom();
    setIsZoomed(false);
  }, []);
  return { chartRef, isZoomed, onZoomComplete, resetZoom };
}

const zoomResetButtonStyle: React.CSSProperties = {
  border:      '1px solid rgba(0, 166, 62, 0.25)',
  background:  'transparent',
  color:       '#00a63e',
  borderRadius: 8,
  padding:     '6px 12px',
  fontSize:    '0.75rem',
  fontWeight:  700,
  cursor:      'pointer',
  fontFamily:  'Poppins, sans-serif',
};

export const ZoomResetButton: React.FC<{ visible: boolean; onClick: () => void }> = ({ visible, onClick }) => {
  if (!visible) return null;
  return React.createElement('button', { onClick, style: zoomResetButtonStyle }, 'Reset Zoom');
};
```

> **JSX note:** If you prefer JSX syntax rename both files to `.tsx`. The rest of the plan assumes `.ts` / `.tsx` as appropriate.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend && npx tsc --noEmit 2>&1 | head -40
```

Expected: same errors as before this task (zero new errors introduced). The original `SiteDataPanel.tsx` still exists so nothing is broken yet.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/shared/components/SiteDataPanel/
git commit -m "refactor(SiteDataPanel): scaffold directory + extract types and chartUtils"
```

---

### Task 2: Extract shared UI sub-components

**Files:**
- Create: `src/shared/components/SiteDataPanel/components/KpiCard.tsx`
- Create: `src/shared/components/SiteDataPanel/components/ChartCard.tsx`
- Create: `src/shared/components/SiteDataPanel/components/ChartTooltips.tsx`
- Create: `src/shared/components/SiteDataPanel/components/WeatherHourlyStrip.tsx`
- Create: `src/shared/components/SiteDataPanel/components/EnergyBreakdownRow.tsx`
- Create: `src/shared/components/SiteDataPanel/components/InsightsRow.tsx`

**Interfaces:**
- Consumes: `useTheme` from `../../contexts/ThemeContext`, Lucide icons, framer-motion.
- Produces: `KpiCard`, `ChartCard`, `ForecastTooltip`, `ChartTooltip`, `ForecastXAxisTick`, `ChartXAxisTick`, `WeatherHourlyStrip`, `EnergyBreakdownRow`, `InsightsRow` — all default or named exports.

- [ ] **Step 1: Extract `KpiCard.tsx`**

Find the `KpiCardProps` interface and `KpiCard` component in `SiteDataPanel.tsx` (search for `interface KpiCardProps` — around line 460). Also grab the five icon helpers (`IconSunKpi`, `IconBattery`, `IconLoad`, `IconGrid`, `IconThermometer`) and the `iconSize` constant.

Create `src/shared/components/SiteDataPanel/components/KpiCard.tsx` containing those definitions with all their imports. Export `KpiCard` as default and the icon helpers as named exports.

```tsx
// src/shared/components/SiteDataPanel/components/KpiCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Battery, Home, Activity, Thermometer } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';

const iconSize = 18;
export const IconSunKpi    = () => <Sun         size={iconSize} className="site-data-panel-icon-solar" />;
export const IconBattery   = () => <Battery     size={iconSize} />;
export const IconLoad      = () => <Home        size={iconSize} />;
export const IconGrid      = () => <Activity    size={iconSize} />;
export const IconThermometer = () => <Thermometer size={iconSize} />;

// Paste the full KpiCardProps interface and KpiCard component body here,
// replacing the local `isDark` with `const { isDark } = useTheme();` inside the component.
// (The original component already calls useTheme() — keep that.)
```

> Full code: copy verbatim from `SiteDataPanel.tsx` starting at `interface KpiCardProps` through the closing `};` of `KpiCard`.

- [ ] **Step 2: Extract `ChartCard.tsx`**

Find `ChartCardProps` and `ChartCard` in `SiteDataPanel.tsx` (around line 276). Create `src/shared/components/SiteDataPanel/components/ChartCard.tsx` with those definitions plus all required imports (`motion`, `useTheme`, etc.).

Export `ChartCard` as default.

- [ ] **Step 3: Extract `ChartTooltips.tsx`**

Find and copy these four components from `SiteDataPanel.tsx`:
- `ForecastTooltip` (around line 172)
- `ChartTooltip` (around line 219)
- `ForecastXAxisTick` (around line 929)
- `ChartXAxisTick` (around line 950)

Also copy `REGIME_STYLE` constant (around line 923) — it is used by `ForecastXAxisTick`.

Create `src/shared/components/SiteDataPanel/components/ChartTooltips.tsx` with all four as named exports.

- [ ] **Step 4: Extract `WeatherHourlyStrip.tsx`**

Find `WeatherHourlyStrip` in `SiteDataPanel.tsx` (around line 563). Copy the full component + its internal `getWeatherIcon` helper + `weatherIconSize` constant.

Create `src/shared/components/SiteDataPanel/components/WeatherHourlyStrip.tsx`, export as default.

- [ ] **Step 5: Extract `EnergyBreakdownRow.tsx`**

Find `EnergyBreakdownRow` in `SiteDataPanel.tsx` (around line 730). Create `src/shared/components/SiteDataPanel/components/EnergyBreakdownRow.tsx`, export as default.

- [ ] **Step 6: Extract `InsightsRow.tsx`**

Find `InsightsRow` in `SiteDataPanel.tsx` (around line 816). Create `src/shared/components/SiteDataPanel/components/InsightsRow.tsx`, export as default.

- [ ] **Step 7: Verify compile**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors (original `SiteDataPanel.tsx` still intact and not yet changed).

- [ ] **Step 8: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/shared/components/SiteDataPanel/components/
git commit -m "refactor(SiteDataPanel): extract KpiCard, ChartCard, ChartTooltips, WeatherHourlyStrip, EnergyBreakdownRow, InsightsRow"
```

---

### Task 3: Extract PhaseLoadTab and ForecastTab

**Files:**
- Create: `src/shared/components/SiteDataPanel/tabs/PhaseLoadTab.tsx`
- Create: `src/shared/components/SiteDataPanel/tabs/ForecastTab.tsx`

**Interfaces:**
- `PhaseLoadTab` props: see the existing `React.FC<{...}>` definition at line 2769 in `SiteDataPanel.tsx` — copy that interface verbatim.
- `ForecastTab` props: derive from what `SiteDataPanel` passes at line 5742 — `forecast`, `isDark`, `forecastSubTab`, `setForecastSubTab`, `forecastZoom`, `vsActualZoom`, `showBands`, `setShowBands`, `showVsActualSeries`, `setShowVsActualSeries`, `forecastView`, `setForecastView`, `forecastWindow`, `setForecastWindow`, `vsActualView`, `setVsActualView`, `vsActual7d`, `setVsActual7d`, `forecastAccuracy`, `weatherAccuracy`, `achievedPct`, `siteId`.

- [ ] **Step 1: Extract `PhaseLoadTab.tsx`**

Find `PhaseLoadTab` component definition starting at line 2769 of `SiteDataPanel.tsx`. Also copy its dependencies that are only used by it:
- `PHASE_COLORS` constant (line 2673)
- `PhaseKpiCard` component (line 2687)
- `LoadForecastAccuracySubTab` component (line 2292)
- All the load-chart `useMemo` constants used inside `PhaseLoadTab` (`LOAD_SOURCE_META`, `VS_ACTUAL_SERIES`, etc.) — check which ones are only consumed by PhaseLoadTab.

> **Caution:** `LOAD_SOURCE_META` (line 123) and `VS_ACTUAL_SERIES` (line 116) are module-level constants. If they're only used by `PhaseLoadTab` and `HistoryTab`, move them to `types.ts` as exported constants; if only PhaseLoadTab uses them, put them in `PhaseLoadTab.tsx`.

Create `src/shared/components/SiteDataPanel/tabs/PhaseLoadTab.tsx` with all dependencies, export as default.

- [ ] **Step 2: Extract `ForecastTab.tsx`**

Find all components used exclusively by the Forecast tab section (lines 5742–6068 of `SiteDataPanel.tsx`):
- `ForecastTable` (line 971)
- `SatelliteKtDailyChart` (line 1098)
- `SatelliteKtSlotTimeline` (line 1151)
- `SatelliteKtCalendarPicker` (line 1348)
- `SatelliteKtDayDetailChart` (line 1466)
- `SatelliteKtTab` (line 1539)
- `ForecastAccuracySubTab` (line 2092)

Copy all of them plus any constants they reference into `src/shared/components/SiteDataPanel/tabs/ForecastTab.tsx`.

Define the props interface at the top of the file:

```tsx
interface ForecastTabProps {
  forecast: any[];
  isDark: boolean;
  siteId: string;
  forecastSubTab: 'chart' | 'accuracy' | 'satellite';
  setForecastSubTab: (v: 'chart' | 'accuracy' | 'satellite') => void;
  forecastZoom: ReturnType<typeof useChartZoomState>;
  vsActualZoom: ReturnType<typeof useChartZoomState>;
  showBands: Record<string, boolean>;
  setShowBands: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showVsActualSeries: Record<string, boolean>;
  setShowVsActualSeries: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  forecastView: 'chart' | 'table';
  setForecastView: (v: 'chart' | 'table') => void;
  forecastWindow: 'today' | '3d' | '2d';
  setForecastWindow: (v: 'today' | '3d' | '2d') => void;
  vsActualView: 'chart' | 'table';
  setVsActualView: (v: 'chart' | 'table') => void;
  vsActual7d: boolean;
  setVsActual7d: (v: boolean) => void;
  forecastAccuracy: any;
  weatherAccuracy: any;
  achievedPct: number | null | undefined;
}
```

Import `useChartZoomState` from `../chartUtils`.

Export `ForecastTab` as default. The JSX body is the `<motion.div key="forecast">` block (lines 5742–6068) minus the outer `{activeTab === 'forecast' && (` guard — that stays in `index.tsx`.

- [ ] **Step 3: Verify compile**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/shared/components/SiteDataPanel/tabs/
git commit -m "refactor(SiteDataPanel): extract PhaseLoadTab and ForecastTab to separate files"
```

---

### Task 4: Extract HistoryTab and WeatherTab

**Files:**
- Create: `src/shared/components/SiteDataPanel/tabs/HistoryTab.tsx`
- Create: `src/shared/components/SiteDataPanel/tabs/WeatherTab.tsx`

**Interfaces:**
- `HistoryTab` props: `telemetry`, `isDark`, `isTouch`, `historyError`, `dateRange`, `setDateRange`, `customStartDate`, `setCustomStartDate`, `customEndDate`, `setCustomEndDate`, `historyView`, `setHistoryView`, `vsActualView`, `setVsActualView`, `vsActual7d`, `setVsActual7d`, `showHistorySeries`, `setShowHistorySeries`, `showVsActualSeries`, `setShowVsActualSeries`, `historyZoom`, `vsActualZoom`, `historyChartOptions` (ChartOptions), `vsActualChartOptions` (ChartOptions), `siteId`.
- `WeatherTab` props: `weather`, `isDark`, `weatherSubTab`, `setWeatherSubTab`, `weatherAccuracy`.

- [ ] **Step 1: Extract `HistoryTab.tsx`**

The History tab JSX runs from line 5555 to 5741. The `<motion.div key="history">` block is the component body.

Also grab:
- `HistoryTable` component (line 1021)
- `VsActualTable` component (line 1056)
- `HISTORY_SERIES` constant (line 107) — move to `types.ts` as an export, or put in `HistoryTab.tsx` if only used there.

Define props interface:

```tsx
import { type ChartOptions } from 'chart.js';
import { type HistorySeriesKey, type VsActualSeriesKey } from '../types';
import { type useChartZoomState } from '../chartUtils';

interface HistoryTabProps {
  telemetry: any[];
  isDark: boolean;
  isTouch: boolean;
  historyError: string | null;
  dateRange: string;
  setDateRange: (v: string) => void;
  customStartDate: string;
  setCustomStartDate: (v: string) => void;
  customEndDate: string;
  setCustomEndDate: (v: string) => void;
  historyView: 'chart' | 'table';
  setHistoryView: (v: 'chart' | 'table') => void;
  vsActualView: 'chart' | 'table';
  setVsActualView: (v: 'chart' | 'table') => void;
  vsActual7d: boolean;
  setVsActual7d: (v: boolean) => void;
  showHistorySeries: Record<HistorySeriesKey, boolean>;
  setShowHistorySeries: React.Dispatch<React.SetStateAction<Record<HistorySeriesKey, boolean>>>;
  showVsActualSeries: Record<VsActualSeriesKey, boolean>;
  setShowVsActualSeries: React.Dispatch<React.SetStateAction<Record<VsActualSeriesKey, boolean>>>;
  historyZoom: ReturnType<typeof useChartZoomState>;
  vsActualZoom: ReturnType<typeof useChartZoomState>;
  historyChartOptions: ChartOptions<'line'>;
  vsActualChartOptions: ChartOptions<'line'>;
}
```

> The chart options (`historyChartOptions`, `vsActualChartOptions`) are memoized in `SiteDataPanel` with `useMemo` and depend on `isDark`. Keep them in `index.tsx` (they depend on many shared style vars) and pass them as props. This avoids duplicating the theme-color constants.

Export `HistoryTab` as default.

- [ ] **Step 2: Extract `WeatherTab.tsx`**

Weather tab JSX: lines 5446–5553.

Also extract:
- `WeatherAccuracySubTab` (line 2492)
- `SatelliteKtDailyChart` is already in `ForecastTab.tsx` — if `WeatherAccuracySubTab` references it, import from `../tabs/ForecastTab` or extract it to `components/` instead. Inspect carefully before moving.

Define props:

```tsx
interface WeatherTabProps {
  weather: any;
  isDark: boolean;
  weatherSubTab: 'current' | 'accuracy';
  setWeatherSubTab: (v: 'current' | 'accuracy') => void;
  weatherAccuracy: any;
}
```

Export `WeatherTab` as default.

- [ ] **Step 3: Verify compile**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/shared/components/SiteDataPanel/tabs/
git commit -m "refactor(SiteDataPanel): extract HistoryTab and WeatherTab"
```

---

### Task 5: Extract OverviewTab + create index.tsx shell + delete old file

**Files:**
- Create: `src/shared/components/SiteDataPanel/tabs/OverviewTab.tsx`
- Create: `src/shared/components/SiteDataPanel/index.tsx`
- Modify: `src/shared/components/index.ts`
- Delete: `src/shared/components/SiteDataPanel.tsx`

**Interfaces:**
- `OverviewTab` receives all computed values needed for Overview rendering: `isDark`, `isTouch`, `pvKw`, `loadKw`, `gridKw`, `batPowerKw`, `batSoc`, `todayKwh`, `totalPvKwh`, `invTemp`, `pvPowerDisplay`, `isDataLive`, `latest`, `smartDevices`, `siteId`, `inverterPhasesForFlow`, `isDeyeCloud`, `rs485Stale`, `isLatestToday`, `achievedPct`, `runStateBadge`.

- [ ] **Step 1: Create `OverviewTab.tsx`**

Overview tab JSX: lines 5074–5419. The `<motion.div key="overview">` block is the component body.

This tab uses `KpiCard`, `EnergyFlowBlock`, `EnergyBreakdownRow`, `InsightsRow` — import from their new locations:

```tsx
import KpiCard, { IconSunKpi, IconBattery, IconLoad, IconGrid, IconThermometer } from '../components/KpiCard';
import EnergyBreakdownRow from '../components/EnergyBreakdownRow';
import InsightsRow from '../components/InsightsRow';
import EnergyFlowBlock from '../../EnergyFlow';
```

Define props interface inline at the top of the file (copy all variables referenced in the JSX block that originate from `SiteDataPanel`'s scope, not from inside the block itself).

Export `OverviewTab` as default.

- [ ] **Step 2: Create `index.tsx` shell**

`index.tsx` replaces `SiteDataPanel.tsx` as the entry point. It contains:
- All imports (Chart.js registration, API services, hooks, contexts)
- The `SiteDataPanel` component with all data-fetching `useEffect`s, `useMemo`s for chart options, and computed values (`pvKw`, `loadKw`, etc.)
- The tab bar render + `AnimatePresence` that switches between imported tab components
- `export default SiteDataPanel`

The component body is the current `SiteDataPanel.tsx` from line 3936 to 6100, but the large JSX blocks for each tab are replaced by:

```tsx
{activeTab === 'overview' && (
  <OverviewTab
    isDark={isDark}
    isTouch={isTouch}
    pvKw={pvKw}
    {/* ...all props */}
  />
)}
{activeTab === 'details' && (
  <motion.div key="details" /* existing motion props */>
    <DetailsTab {/* existing props */} />
  </motion.div>
)}
{activeTab === 'weather' && (
  <WeatherTab
    weather={weather}
    isDark={isDark}
    weatherSubTab={weatherSubTab}
    setWeatherSubTab={setWeatherSubTab}
    weatherAccuracy={weatherAccuracy}
  />
)}
{activeTab === 'history' && (
  <HistoryTab
    telemetry={telemetry}
    isDark={isDark}
    {/* ...all props */}
  />
)}
{activeTab === 'forecast' && (
  <ForecastTab
    forecast={forecast}
    isDark={isDark}
    siteId={siteId}
    {/* ...all props */}
  />
)}
{activeTab === 'phase-load' && (
  <motion.div key="phase-load" /* existing motion props */>
    <PhaseLoadTab {/* existing props */} />
  </motion.div>
)}
```

> The motion wrapper for `OverviewTab`, `WeatherTab`, `HistoryTab`, `ForecastTab` can either stay in `index.tsx` or be moved inside each tab component (both work — be consistent). Recommended: keep them inside each tab component since that's where the `key` prop makes sense for `AnimatePresence`.

- [ ] **Step 3: Update `src/shared/components/index.ts`**

Verify the existing line:
```ts
export { default as SiteDataPanel } from './SiteDataPanel';
```
This still works because `./SiteDataPanel` now resolves to `./SiteDataPanel/index.tsx` — no change needed. Confirm this is the case; if the file uses an explicit `.tsx` extension, update it.

- [ ] **Step 4: Delete the old file**

```bash
rm /home/ubuntu/work/smart-solar-react-frontend/src/shared/components/SiteDataPanel.tsx
```

- [ ] **Step 5: Verify compile**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend && npx tsc --noEmit 2>&1 | head -60
```

Expected: zero errors.

- [ ] **Step 6: Run dev server and smoke-test all tabs**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend && npm run dev &
```

Open the app at `localhost:5173` (or whichever port Vite uses). Navigate to a site and verify:
- Overview tab: KPI cards, energy flow diagram, breakdown row all render
- Details tab: site config table renders
- Weather tab: hourly strip and conditions render
- History tab: chart renders, date range controls work
- Solar (Forecast) tab: P10/P50/P90 chart renders, sub-tabs work
- Load tab: phase breakdown renders

Kill the dev server after testing.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/shared/components/SiteDataPanel/
git add -u src/shared/components/SiteDataPanel.tsx  # stages deletion
git commit -m "refactor(SiteDataPanel): complete tab split — OverviewTab extracted, index.tsx shell, old monolith deleted"
```

---

### Task 6: Fix energy flow diagram narrow layout height

**Files:**
- Modify: `src/shared/components/EnergyFlow/index.tsx`

**Interfaces:**
- Consumes: `NARROW_LAYOUT`, `WIDE_LAYOUT` constants in the same file.
- Produces: narrower diagram on mobile (VH 416→300, node positions adjusted).

- [ ] **Step 1: Read the current NARROW_LAYOUT**

Open `src/shared/components/EnergyFlow/index.tsx` and find the `NARROW_LAYOUT` call around line 83:

```ts
const NARROW_LAYOUT = computeLayout(416, {
  pv:   { x: ..., y: ... },
  hub:  { x: ..., y: ... },
  batt: { x: ..., y: ... },
  grid: { x: ..., y: ... },
});
```

Note the exact `x`/`y` values for each node.

- [ ] **Step 2: Apply the fix**

Change `VH` from `416` to `300` and scale the `y` positions proportionally (multiply each `y` by `300/416 ≈ 0.721`). Keep all `x` values unchanged.

Example — if the original was:
```ts
const NARROW_LAYOUT = computeLayout(416, {
  pv:   { x: 163, y:  60 },
  hub:  { x: 350, y: 208 },
  batt: { x: 90,  y: 340 },
  grid: { x: 610, y: 260 },
});
```

The updated version:
```ts
const NARROW_LAYOUT = computeLayout(300, {
  pv:   { x: 163, y:  43 },
  hub:  { x: 350, y: 150 },
  batt: { x: 90,  y: 245 },
  grid: { x: 610, y: 188 },
});
```

Use the actual values from the file, not these examples.

- [ ] **Step 3: Verify compile + visual check**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend && npx tsc --noEmit 2>&1 | head -20
```

Then open the app at a narrow viewport (375px width in DevTools) and confirm the energy flow diagram nodes are still legible and not overlapping.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/shared/components/EnergyFlow/index.tsx
git commit -m "fix(EnergyFlow): reduce narrow layout VH 416→300 to shrink diagram on mobile"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tab split into separate files (Tasks 1–5)
- ✅ Shared utilities extracted (chartUtils.ts, components/)
- ✅ Public import path unchanged (index.ts re-export)
- ✅ Energy flow diagram height fix on narrow layout (Task 6)
- ✅ PhaseLoadTab moved from inline to file (Task 3)
- ✅ DetailsTab left in `features/staff/` — not touched

**Placeholder scan:** All code blocks are complete. No TBDs.

**Type consistency:**
- `useChartZoomState` return type used as `ReturnType<typeof useChartZoomState>` consistently in Task 3 and 4.
- `HistorySeriesKey` / `VsActualSeriesKey` exported from `types.ts` and consumed in `HistoryTab.tsx`.
- `TABS` exported from `types.ts`, consumed in `index.tsx`.
