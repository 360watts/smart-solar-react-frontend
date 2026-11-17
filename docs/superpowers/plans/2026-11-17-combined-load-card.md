# Combined Load Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Phase Load tab's "Load Profile" and "Load Forecast vs Actual" cards into one Load card (Line × Window × Forecast lead) and add a grid-direct forecast (7-day same-slot median).

**Architecture:** Backend: `?line=grid` on the existing `load-forecast-accuracy` endpoint returns meter actuals plus a median forecast computed on request (`api/services/load_line_grid.py`); the inverter path is untouched. Frontend: pure slot model (`loadCardModel.ts`) merges actuals, inverter runs, the 7-day forward forecast and the grid median into one 15-min grid; `LoadCard.tsx` draws it with Chart.js; `PhaseLoadTab.tsx` keeps its data aggregation and hands it to the card.

**Tech Stack:** Django REST + TimescaleDB (pytest/Django TestCase), React 18 + TypeScript + Chart.js (react-chartjs-2), Jest + Testing Library.

Spec: `docs/superpowers/specs/2026-11-17-combined-load-card-design.md` (approved 2026-11-17).
Repos: `C:\360watts\smart-solar-django-backend` (BE), `C:\360watts\smart-solar-react-frontend` (FE). Work on `main`, locally. **No commit, push or deploy without the owner's OK** (replaces every "Commit" step).

## File map

| File | Change |
|---|---|
| BE `docs/test-scenarios/load-line-grid-forecast.md` | new: scenarios G1–G5, E1–E3, live L1–L3 |
| BE `api/services/load_line_grid.py` | new: `floor_slot`, `median7`, `grid_line` |
| BE `tests/test_load_line_grid.py` | new |
| BE `api/views/forecasting.py` | `?line=grid` branch in `site_load_forecast_accuracy` |
| BE `localapi/settings.py` | `LOAD_LINE_NOTES` |
| BE `docs/claude/AI_AND_FORECASTING.md` | one paragraph |
| FE `docs/test-scenarios/combined-load-card.md` | new |
| FE `src/services/api.ts` | `getLoadForecastAccuracy(..., line)` |
| FE `src/shared/components/SiteDataPanel/tabs/loadCardModel.ts` | new: pure helpers + `PHASE_COLORS` |
| FE `.../tabs/loadCardModel.test.ts` | new |
| FE `.../tabs/LoadCard.tsx` | new: the card |
| FE `.../tabs/LoadCard.test.tsx` | new |
| FE `.../tabs/PhaseLoadTab.tsx` | drop the two cards, header selects and dead state; EV gaps stay null; render `LoadCard` |

---

### Task 1: Backend scenarios doc

**Files:** Create BE `docs/test-scenarios/load-line-grid-forecast.md`

- [ ] **Step 1:** Write the doc with rows G1–G5 (median7), E1–E3 (endpoint), L1–L3 (live), all `planned`. Content is in the file itself (Task 1 output); rows map 1:1 to the tests in Task 2.

### Task 2: `median7` + `grid_line` (TDD)

**Files:** Create BE `api/services/load_line_grid.py`, `tests/test_load_line_grid.py`

- [ ] **Step 1: failing tests** — `tests/test_load_line_grid.py`:

```python
"""Grid-direct line forecast (docs/test-scenarios/load-line-grid-forecast.md)."""
from datetime import datetime, timezone
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import DatabaseError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import SolarSite
from api.services.load_line_grid import DAY, floor_slot, median7

T = datetime(2026, 11, 17, 16, 30, tzinfo=timezone.utc)
ISO = '%Y-%m-%dT%H:%M:%SZ'


class Median7Tests(TestCase):
    def test_g1_fewer_than_four_days_no_forecast(self):
        self.assertEqual(median7({T - k * DAY: 1.0 for k in (1, 2, 3)}, [T]), {})

    def test_g2_median_and_band_of_seven_days(self):
        p50, p10, p90 = median7({T - k * DAY: float(k) for k in range(1, 8)}, [T])[T]
        self.assertEqual(p50, 4.0)
        self.assertAlmostEqual(p10, 1.6)
        self.assertAlmostEqual(p90, 6.4)

    def test_g3_only_the_seven_most_recent_days(self):
        actual = {T - k * DAY: (10.0 if k > 7 else 1.0) for k in range(1, 15)}
        self.assertEqual(median7(actual, [T])[T][0], 1.0)

    def test_g4_future_slot_skips_days_without_readings(self):
        future = T + 5 * DAY
        self.assertEqual(median7({T - k * DAY: 2.0 for k in range(7)}, [future])[future][0], 2.0)

    def test_g5_floor_slot(self):
        self.assertEqual(floor_slot(datetime(2026, 11, 17, 9, 44, 59, 9, tzinfo=timezone.utc)),
                         datetime(2026, 11, 17, 9, 30, tzinfo=timezone.utc))


@override_settings(LOAD_LINE_NOTES={'s1': 'Meter reads ~25% low'})
class GridLineEndpointTests(TestCase):
    def setUp(self):
        SolarSite.objects.create(site_id='s1', display_name='s1', latitude=11.0, longitude=77.0)
        self.user = get_user_model().objects.create_superuser('boss', 'b@example.com', 'pw')

    def get(self, rows, error=None):
        cur = mock.MagicMock()
        cur.fetchall.return_value = rows
        if error:
            cur.execute.side_effect = error
        c = APIClient()
        c.force_login(self.user)
        with mock.patch('api.services.load_line_grid.connection') as conn, \
                mock.patch('api.views.forecasting.load_miss_reasons') as reasons, \
                mock.patch('api.views._shared._check_site_auth', return_value=True):
            conn.cursor.return_value.__enter__.return_value = cur
            resp = c.get('/api/sites/s1/load-forecast-accuracy/?line=grid&days=7')
        self.assertEqual(resp.status_code, 200, resp.content)
        reasons.assert_not_called()
        return resp.json()

    def test_e1_grid_line_shape(self):
        now = floor_slot(datetime.now(timezone.utc))
        body = self.get([(now - k * DAY, 1.0 + k / 10) for k in range(8)])
        self.assertEqual((body['lead'], body['line'], body['note']), ('median', 'grid', 'Meter reads ~25% low'))
        rows = {r['ts']: r for r in body['timeseries']}
        self.assertEqual(rows[now.strftime(ISO)]['actual_kw'], 1.0)
        self.assertEqual(rows[now.strftime(ISO)]['predicted_kw'], 1.4)
        self.assertEqual(rows[now.strftime(ISO)]['method'], 'median7')
        self.assertIsNone(rows[(now + DAY).strftime(ISO)]['actual_kw'])
        self.assertIsNotNone(rows[(now + DAY).strftime(ISO)]['predicted_kw'])

    def test_e2_no_meter_data_empty(self):
        body = self.get([])
        self.assertEqual((body['timeseries'], body['overall']), ([], None))

    def test_e3_db_error_keeps_200(self):
        self.assertEqual(self.get([], error=DatabaseError('down'))['timeseries'], [])
```

- [ ] **Step 2:** Run `python -m pytest tests/test_load_line_grid.py -q` → FAIL (`ModuleNotFoundError: api.services.load_line_grid`).

- [ ] **Step 3: implementation** — `api/services/load_line_grid.py`:

```python
"""Grid-direct load line for the combined Load card: meter actual + 7-day same-slot median forecast.

Scenarios: docs/test-scenarios/load-line-grid-forecast.md. No model and no storage: the median is
worked out on request (frontend spec docs/superpowers/specs/2026-11-17-combined-load-card-design.md).
"""
import statistics
from datetime import datetime, timedelta

from django.db import connection

SLOT = timedelta(minutes=15)
DAY = timedelta(days=1)
MIN_DAYS = 4


def floor_slot(t: datetime) -> datetime:
    return t.replace(minute=t.minute - t.minute % 15, second=0, microsecond=0)


def median7(actual: dict, slots: list) -> dict:
    """{slot: (p50, p10, p90)} from the 7 most recent same-slot readings, looking back up to 14 days.

    Fewer than 4 readings: no forecast. Days with no reading (outages, or the future for a slot
    ahead of now) are skipped, so the next 7 days still get a forecast."""
    out = {}
    for t in slots:
        vals = []
        for k in range(1, 15):
            v = actual.get(t - k * DAY)
            if v is not None:
                vals.append(v)
                if len(vals) == 7:
                    break
        if len(vals) >= MIN_DAYS:
            q = statistics.quantiles(vals, n=10, method='inclusive')
            out[t] = (statistics.median(vals), q[0], q[-1])
    return out


def grid_line(site_id: str, days: int, now: datetime) -> list:
    """15-min slots from `days` ago to 7 days ahead: meter actual (past) and the median forecast."""
    start = floor_slot(now - timedelta(days=days))
    with connection.cursor() as cur:
        # Phase sum of |W|: the same rule as the card's actual grid line (F-051: negative stretches are load)
        cur.execute("""
            SELECT time_bucket('15 minutes', bucket) AS t,
                   CASE WHEN count(active_power_l1) + count(active_power_l2) + count(active_power_l3) = 0 THEN NULL
                        ELSE (coalesce(avg(abs(active_power_l1)), 0) + coalesce(avg(abs(active_power_l2)), 0)
                              + coalesce(avg(abs(active_power_l3)), 0)) / 1000.0 END AS kw
            FROM energymeter_5min
            WHERE site_id = %s AND bucket >= %s AND bucket < %s
            GROUP BY 1
        """, [site_id, start - 14 * DAY, now])
        actual = {t: float(kw) for t, kw in cur.fetchall() if kw is not None}
    if not actual:
        return []
    slots, t, end = [], start, floor_slot(now) + 7 * DAY
    while t < end:
        slots.append(t)
        t += SLOT
    fc = median7(actual, slots)
    out = []
    for t in slots:
        a, f = actual.get(t), fc.get(t)
        if a is None and f is None:
            continue
        out.append({'ts': t.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'actual_kw': round(a, 3) if a is not None else None,
                    'predicted_kw': round(f[0], 3) if f else None,
                    'p10_kw': round(f[1], 3) if f else None,
                    'p90_kw': round(f[2], 3) if f else None,
                    'method': 'median7'})
    return out
```

- [ ] **Step 4: endpoint branch** — in `api/views/forecasting.py` add imports `from django.conf import settings` and `from api.services.load_line_grid import grid_line`; in `site_load_forecast_accuracy` right after the `lead` parsing:

```python
    if request.GET.get('line') == 'grid':
        try:
            series = grid_line(site_id, min(days, 31), datetime.now(dt_timezone.utc))
        except DatabaseError as exc:
            logger.warning('site_load_forecast_accuracy grid line DB unavailable site=%s: %s', site_id, exc)
            series = []
        return Response({'daily': [], 'hourly': [], 'overall': None, 'timeseries': series, 'lead': 'median',
                         'line': 'grid', 'note': getattr(settings, 'LOAD_LINE_NOTES', {}).get(site_id)})
```

Docstring: add `line — inverter (default) or grid (meter actual + 7-day median, lead ignored)`.

- [ ] **Step 5: setting** — `localapi/settings.py` below `LOAD_UNMEASURED_SITE_IDS`:

```python
# Caveats shown on the staff Load card's grid-direct line (frontend combined-load-card spec 2026-11-17)
LOAD_LINE_NOTES = {'coim_002': 'Meter reads ~25% low (CT gain, unresolved)'}
```

- [ ] **Step 6:** `python -m pytest tests/test_load_line_grid.py tests/test_load_miss_reasons.py tests/test_load_forecast_snapshots.py -q` → PASS. Set doc rows to `passing`.

### Task 3: FE scenarios doc

- [ ] Create FE `docs/test-scenarios/combined-load-card.md`: rows W1–W3, B1–B6, G1–G3, T1–T2, S1–S2 (model), C1–C7 (card), live L1–L6; `planned`.

### Task 4: API service `line` param

**Files:** Modify FE `src/services/api.ts:1305`

```ts
  async getLoadForecastAccuracy(siteId: string, days: number = 30, lead: string = 'latest', line: 'inverter' | 'grid' = 'inverter'): Promise<any> {
    const enc = encodeURIComponent(siteId);
    const extra = line === 'grid' ? '&line=grid' : '';
    return cacheService.dedup(`load_forecast_accuracy_${siteId}_${days}_${lead}${line === 'grid' ? '_grid' : ''}`, () => this.request(`/sites/${enc}/load-forecast-accuracy/?days=${days}&lead=${encodeURIComponent(lead)}${extra}`), 30 * 60 * 1000);
  }
```
(The inverter cache key is unchanged, so `refreshVsActualData`'s `cacheService.clear` keeps working.)

### Task 5: `loadCardModel.ts` (TDD)

**Files:** Create `tabs/loadCardModel.ts`, `tabs/loadCardModel.test.ts` — code exactly as written in those files (Task 5 output): `windowRange`, `buildSlots`, `gapSlots`, `kwh`, `cumulative`, `stackTops`, `PHASE_COLORS`. Tests W1–W3, B1–B6, G1–G3, T1–T2, S1–S2.

- [ ] Step 1 write tests → Step 2 `npx jest loadCardModel` FAIL → Step 3 implement → Step 4 PASS.

Rules the model encodes:
- Windows: today = solar day; last7 = 6 days before + today; next7 = the 7 solar days after today.
- Forward 7-day rows are written first; the accuracy series (lead-chosen runs) overrides them.
- Gap = past slot (ending ≥30 min before now) where a line that has any reading in the window has none.
- `stackTops`: actual up to now, forecast after (if on), EV stops at now.

### Task 6: `LoadCard.tsx` (TDD)

**Files:** Create `tabs/LoadCard.tsx`, `tabs/LoadCard.test.tsx` (react-chartjs-2 and chartUtils mocked; the test reads the `data` prop handed to `Line`).

Behaviour (each row is a test or a live check):
- C1 All: summed forecast dataset = invP50 + gridP50, never EV.
- C2 EV line: no forecast datasets.
- C3 one available line: no Line picker.
- C4 Window "Last 7 days" calls `onHoursChange(168)`; "Today" → 24.
- C5 Forecast Off: no forecast datasets, `onLeadChange` not called; Day-ahead → `onLeadChange('day')`.
- C6 a gap shows "incomplete" in All.
- C7 the grid note chip shows.

- [ ] Step 1 tests → Step 2 FAIL → Step 3 implement → Step 4 PASS.

### Task 7: Wire into `PhaseLoadTab.tsx`

- [ ] Move `PHASE_COLORS` to the model; `export { PHASE_COLORS } from './loadCardModel'` keeps `UsageTab`'s import.
- [ ] Delete `LOAD_SOURCE_META`, `VS_LEADS`/`VsLead`, every profile/vs-actual state, memo, option object and both cards; delete the date picker and hours select; delete `selectedLoadDate` from `chartData`/`resolvedLoadChartData`.
- [ ] EV per bucket: `null` when the bucket has no EV reading (was 0) so the card can show EV gaps.
- [ ] Fetch the grid line once per site (`getLoadForecastAccuracy(siteId, 7, 'latest', 'grid')`).
- [ ] Render: header (title + Load/Accuracy sub-tabs) → `LoadCard` → Accuracy sub-tab.
- [ ] `npx tsc --noEmit -p .`, `npx jest SiteDataPanel`, `npm run build` → clean.

### Task 8: Docs + status

- [ ] BE `docs/claude/AI_AND_FORECASTING.md`: `?line=grid` paragraph. FE `CLAUDE.md`: one line under Notable components.
- [ ] Scenario doc statuses → `passing`. Memory note. Report to owner; ask before commit/deploy.

## Self-review

- Spec coverage: Line/Window/Forecast (T6), stacked + hatched + summed (T5 stackTops, T6), chips/score/note (T6), Why off (T6 tooltip footer), grid median + note (T2), anti-goals: EV excluded (C1/C2), gaps (G1–G3/C6), R3.2 untouched (T2 E-tests assert miss-reason loader not called on grid; inverter tests rerun), median-only (T2).
- Known ceiling: the inverter "score" chip shows the existing day-ahead KPIs (MAE, band coverage), not a vs-median %: the API has no median baseline. Noted to the owner.
