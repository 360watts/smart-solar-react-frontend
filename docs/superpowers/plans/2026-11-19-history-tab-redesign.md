# History Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **House rules for this workspace:**
> - Do NOT commit, push, create branches, worktrees or stashes. The owner commits.
> - Each task ends with a checkpoint that lists changed files.
> - Work on the current branch (`main`) of each repo.
> - Use model `sonnet` (or `haiku`) for any subagent, never Opus.

**Goal:** Rebuild the site panel's History tab:
- chart first, then "Anything wrong?", then "Where energy went"
- whole-home figures everywhere
- Today / 7 days / 30 days (calendar) / ‹ › stepping

**Architecture:**
- **Backend:** a new service `api/services/household_history.py` turns the 5-minute TimescaleDB rollups into whole-home flows:
  - home use from solar / battery / grid
  - solar to battery and exported
  - grid-direct counted as absolute value per phase (F-051)

  Two new staff routes serve it: one day of 15-minute slots, and daily totals for a date range. Days older than 90 days fall back to `site_daily_energy`.
- **Frontend:** the History tab fetches its own data. Pure maths lives in `historyModel.ts` (period ranges, the mixed-days totals rule, comparisons, flags, the sentence, calendar cells). `HistoryTab.tsx` renders mockup A3 plus the calendar C, using the shared `cardParts.tsx`.

**Tech stack:**
- Backend: Django REST Framework, TimescaleDB CAGGs (`telemetry_5min`, `energymeter_5min`, `smartdevice_5min`)
- Frontend: React 18 + TypeScript, Chart.js via react-chartjs-2, Jest + React Testing Library

**Spec:** `smart-solar-react-frontend/docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md`.
**Mockups:** https://claude.ai/artifact/SuAi4BH4Egw26t4jdaHEVz (A3 and C).

---

## File map

| Repo | File | Responsibility |
|---|---|---|
| backend | `docs/test-scenarios/household-history.md` (new) | Scenario table for the two routes |
| backend | `api/services/household_history.py` (new) | `split()`, `day_slots()`, `daily_totals()`, the one parametrised SQL |
| backend | `api/views/household.py` (new) | `site_household_day`, `site_household_daily` |
| backend | `api/views/__init__.py`, `api/urls.py`, `api/staff_roles.py` | Wire the routes, tier `V_RO` |
| backend | `localapi/settings.py` | `HOUSE_WHOLE_FROM` (first whole-home day per site) |
| backend | `api/views/site_events.py` | Add `ended` to incident rows (multi-day rings) |
| backend | `tests/test_household_history.py` (new) | Unit and endpoint tests |
| frontend | `docs/test-scenarios/history-tab-redesign.md` (new) | Replaces `history-power-flow-card.md` |
| frontend | `src/services/api.ts` | Types and `getHouseholdDay`, `getHouseholdDaily` |
| frontend | `src/shared/components/SiteDataPanel/tabs/historyModel.ts` (+ `.test.ts`) (new) | Pure maths |
| frontend | `src/shared/components/SiteDataPanel/tabs/HistoryCalendar.tsx` (new) | The 30-day tile grid and side panel |
| frontend | `src/shared/components/SiteDataPanel/tabs/HistoryTab.tsx` (+ `.test.tsx`) (rewrite) | The tab |
| frontend | `src/shared/components/SiteDataPanel/index.tsx` | Drop the history date picker and the History-only props/state |

Sign conventions (checked in code):
- `battery_power_w > 0` means discharging (`api/faults/rules.py:231`).
- `grid_power_w > 0` means importing (the old History stats treated `> 0` as import).

---

## Backend (repo `C:\360watts\smart-solar-django-backend`)

Run tests with:

```bash
PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_household_history --settings=localapi.test_settings -v 2
```

### Task 1: Scenario document

**Files:**
- Create: `docs/test-scenarios/household-history.md`

- [ ] **Step 1: Write the scenario doc** (shared rule: before tests)

```markdown
# Household history routes (test scenarios)

The History tab's data (spec: smart-solar-react-frontend/docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md).
`GET /sites/<id>/household/day/?date=YYYY-MM-DD` gives one IST day of 15-min slots.
`GET /sites/<id>/household/daily/?start=&end=` gives daily totals. Whole home = inverter + grid board (|W| per phase, F-051) + EV.

| # | Area | Given | When | Then | Type | P | Status |
|---|---|---|---|---|---|---|---|
| S1 | split | inverter 2, grid board 1, battery out 0.5, inverter import 0.3, parts inverter+grid_board | split | home 3; from battery 0.5; from grid 1.3; from solar 1.2; whole | unit | P0 | planned |
| S2 | split | parts {inverter} only | split | home = inverter; whole false (label "inverter circuits only") | unit | P0 | planned |
| S3 | split | grid board unknown on a grid_board site | split | falls back to inverter side, whole false; never a partial "home" | unit | P0 | planned |
| S4 | split | meter-only site (house_meter) | split | home = meter; all from grid; whole true | unit | P1 | planned |
| S5 | split | EV part present | split | EV counted in home and in from-grid | unit | P1 | planned |
| S6 | split | battery + grid exceed home | split | from solar floored at 0 | unit | P1 | planned |
| D1 | day | rows for 2 slots | day_slots | kW = 5-min W sums × 5/60/1000 × 4; slot part null when < 3 buckets | unit | P0 | planned |
| D2 | day | date older than 90 days | day_slots | empty slots, reason older_than_90_days | unit | P1 | planned |
| D3 | day | date before HOUSE_WHOLE_FROM | day_slots | every slot whole false | unit | P0 | planned |
| T1 | daily | recent days in the CAGG | daily_totals | kWh per IST day; a part under 90% coverage is unknown (whole false) | unit | P0 | planned |
| T2 | daily | range reaches past 90 days | daily_totals | older days read site_daily_energy, source daily_table | unit | P1 | planned |
| T3 | daily | today | daily_totals | coverage measured against elapsed buckets, not 288 | unit | P1 | planned |
| E1 | endpoint | staff user | GET day | 200, body {date, parts, whole_home, note, slots} | integration | P0 | planned |
| E2 | endpoint | bad date / range over 400 days | GET | 400 with code | integration | P1 | planned |
| E3 | endpoint | unknown site | GET | 404 | integration | P2 | planned |
| E4 | events | incident with ts_end | GET events | row has `ended` | integration | P2 | planned |
| L1 | live | coim_002 today | compare | home total within 2% of the Load card's All view | live | P0 | planned |
| L2 | live | coim_002 30 days | check | days before Oct 23 whole false | live | P0 | planned |
```

- [ ] **Step 2: Checkpoint.** Changed: `docs/test-scenarios/household-history.md`.

### Task 2: `split()` (the energy split)

**Files:**
- Create: `api/services/household_history.py`
- Test: `tests/test_household_history.py`

- [ ] **Step 1: Write the failing tests**

```python
"""Household history routes (docs/test-scenarios/household-history.md)."""
from datetime import date, datetime, timedelta, timezone
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from api.models import SolarSite
from api.services.household_history import split

GB = {'inverter', 'grid_board'}


def flows(parts=GB, **kw):
    base = dict(pv=3.0, inverter=2.0, grid_board=1.0, ev=None, bdis=0.5, bchg=0.4, imp=0.3, exp=0.2)
    base.update(kw)
    return split(parts, **base)


class SplitTests(SimpleTestCase):
    def test_s1_whole_home(self):
        f = flows()
        self.assertEqual((f['home'], f['from_battery'], f['from_grid'], f['from_solar'], f['whole']),
                         (3.0, 0.5, 1.3, 1.2, True))
        self.assertEqual((f['solar_to_battery'], f['exported'], f['pv']), (0.4, 0.2, 3.0))

    def test_s2_inverter_only_site(self):
        f = flows(parts={'inverter'})
        self.assertEqual((f['home'], f['from_grid'], f['whole']), (2.0, 0.3, False))

    def test_s3_missing_grid_board_falls_back(self):
        f = flows(grid_board=None)
        self.assertEqual((f['home'], f['whole']), (2.0, False))

    def test_s4_meter_only(self):
        f = flows(parts={'house_meter'}, inverter=None, pv=None, bdis=None, bchg=None, imp=None, exp=None)
        self.assertEqual((f['home'], f['from_grid'], f['from_solar'], f['whole']), (1.0, 1.0, 0.0, True))

    def test_s5_ev_counts_as_grid(self):
        f = flows(parts=GB | {'ev'}, ev=0.7)
        self.assertEqual((f['home'], f['from_grid']), (3.7, 2.0))

    def test_s6_from_solar_floored(self):
        f = flows(bdis=2.0, imp=1.5)
        self.assertEqual(f['from_solar'], 0.0)

    def test_nothing_known(self):
        f = flows(inverter=None, grid_board=None)
        self.assertIsNone(f['home'])
        self.assertFalse(f['whole'])
```

- [ ] **Step 2: Run them and see them fail**

Run: the test command above.
Expected: `ImportError: cannot import name 'split'`.

- [ ] **Step 3: Write `split()`**

```python
"""Whole-home history for the History tab: home use by source and where solar went.

Spec: smart-solar-react-frontend/docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md
Scenarios: docs/test-scenarios/household-history.md
Grid board = the energy meter's |W| per phase (F-051, the Load card's grid-line rule), never the net total.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from django.conf import settings
from django.db import connection

from api.services.circuit_map import ev_plugs, house_kwh, site_parts

IST = timezone(timedelta(hours=5, minutes=30))
FIVE_MIN_KWH = 5.0 / 60.0 / 1000.0   # one 5-minute bucket at W -> kWh
RECENT_DAYS = 90                      # CAGG retention (migration 0221)
FULL_DAY = 288                        # 5-minute buckets in a day
MIN_COVERAGE = 0.9                    # a part counts for a day only with >= 90% of its buckets
MIN_SLOT_BUCKETS = 3                  # a 15-min slot part counts only with all three buckets


def _r(v):
    return None if v is None else round(v, 3)


def split(parts: set, *, pv, inverter, grid_board, ev, bdis, bchg, imp, exp) -> dict:
    """One slot or one day (kW or kWh, the same maths). Whole home when the site has a meter and every needed
    part is known; otherwise the inverter side only (whole False), never a partial total called "home"."""
    if 'house_meter' in parts:
        home = grid_board
        return {'pv': None, 'home': _r(home), 'from_solar': 0.0 if home is not None else None,
                'from_battery': 0.0 if home is not None else None, 'from_grid': _r(home),
                'solar_to_battery': None, 'exported': None, 'whole': home is not None}
    whole_home = house_kwh(parts, inverter, grid_board, ev)
    whole = whole_home is not None and 'grid_board' in parts
    home = whole_home if whole else inverter
    if home is None:
        return {'pv': _r(pv), 'home': None, 'from_solar': None, 'from_battery': None, 'from_grid': None,
                'solar_to_battery': _r(bchg), 'exported': _r(exp), 'whole': False}
    extra = (grid_board or 0.0) + ((ev or 0.0) if 'ev' in parts else 0.0) if whole else 0.0
    b = bdis or 0.0
    g = (imp or 0.0) + extra
    return {'pv': _r(pv), 'home': _r(home), 'from_solar': _r(max(0.0, home - b - g)), 'from_battery': _r(b),
            'from_grid': _r(g), 'solar_to_battery': _r(bchg), 'exported': _r(exp), 'whole': whole}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: the test command above.
Expected: 7 tests OK.

- [ ] **Step 5: Checkpoint.**
  - Changed: `api/services/household_history.py`, `tests/test_household_history.py`.
  - Update S1–S6 to `passing` in the scenario doc.

### Task 3: The SQL and `day_slots()`

**Files:**
- Modify: `api/services/household_history.py`
- Modify: `localapi/settings.py` (next to `LOAD_LINE_NOTES`, line ~75)
- Test: `tests/test_household_history.py`

- [ ] **Step 1: Add the setting**

```python
# First IST day each site's whole-home figures are valid (meter 115 grid line valid from Oct 22 06:00 UTC, so
# Oct 22 is partial). History shows "inverter circuits only" before it. Spec 2026-11-19 history tab.
HOUSE_WHOLE_FROM = {'coim_002': '2026-10-23'}
```

- [ ] **Step 2: Write the failing tests** (append to the test file)

```python
from api.services.household_history import day_slots  # noqa: E402

DAY0 = date(2026, 11, 18)
SLOT0 = datetime(2026, 11, 17, 18, 30, tzinfo=timezone.utc)  # 00:00 IST Nov 18
NOW = datetime(2026, 11, 19, 6, 0, tzinfo=timezone.utc)


def row(k, n_inv=3, n_em=3, w=1000.0):
    # k, inv n, pv, inv_load, bdis, bchg, imp, exp, inv_out, soc_min, soc_max, soc, em n, em w, ev n, ev w
    return (k, n_inv, 3 * w, 3 * w, 0.0, 0.0, 0.0, 0.0, 3 * w, 50.0, 52.0, 51.0, n_em, 3 * w, None, None)


class FakeSite:
    site_id = 's1'


@override_settings(HOUSE_WHOLE_FROM={'s1': '2026-10-23'}, LOAD_LINE_NOTES={})
class DaySlotsTests(SimpleTestCase):
    def run_day(self, rows, day=DAY0, parts=GB):
        cur = mock.MagicMock()
        cur.fetchall.return_value = rows
        with mock.patch('api.services.household_history.connection') as conn, \
                mock.patch('api.services.household_history.site_parts', return_value=parts), \
                mock.patch('api.services.household_history.ev_plugs') as evp:
            evp.return_value.values_list.return_value = []
            conn.cursor.return_value.__enter__.return_value = cur
            return day_slots(FakeSite(), day, NOW), cur

    def test_d1_slot_kw(self):
        body, cur = self.run_day([row(SLOT0), row(SLOT0 + timedelta(minutes=15), n_em=2)])
        s0, s1 = body['slots']
        # 3 buckets of 1000 W -> 0.25 kWh -> 1.0 kW per part
        self.assertEqual((s0['inverter_kw'], s0['grid_board_kw'], s0['home_kw'], s0['whole_home']), (1.0, 1.0, 2.0, True))
        self.assertEqual((s1['grid_board_kw'], s1['home_kw'], s1['whole_home']), (None, 1.0, False))
        sql, params = cur.execute.call_args[0]
        self.assertIn("time_bucket('15 minutes', bucket)", sql)
        self.assertEqual(params['start'], SLOT0)

    def test_d2_too_old(self):
        body, cur = self.run_day([], day=DAY0 - timedelta(days=120))
        self.assertEqual((body['slots'], body['reason']), ([], 'older_than_90_days'))
        cur.execute.assert_not_called()

    def test_d3_before_whole_from(self):
        body, _ = self.run_day([row(datetime(2026, 10, 20, 18, 30, tzinfo=timezone.utc))], day=date(2026, 10, 21))
        self.assertFalse(body['whole_home'])
        self.assertFalse(body['slots'][0]['whole_home'])
```

- [ ] **Step 3: Run them and see them fail**

Expected: `ImportError: cannot import name 'day_slots'`.

- [ ] **Step 4: Write the SQL, helpers and `day_slots()`** (append to the service)

```python
# {g} = the grouping key: a 15-minute bucket (slots) or the IST date (days). Sums are of 5-minute average W.
_SQL = """
WITH inv AS (
    SELECT {g} AS k, count(*) AS n,
           sum(coalesce(pv1_power_w, 0) + coalesce(pv2_power_w, 0) + coalesce(pv3_power_w, 0) + coalesce(pv4_power_w, 0)) AS pv,
           sum(load_power_w) AS inv_load,
           sum(greatest(battery_power_w, 0)) AS bdis, sum(greatest(-battery_power_w, 0)) AS bchg,
           sum(greatest(grid_power_w, 0)) AS imp, sum(greatest(-grid_power_w, 0)) AS exp,
           sum(coalesce(inv_total_power_w, ac_output_power_w)) AS inv_out,
           min(battery_soc_percent) AS soc_min, max(battery_soc_percent) AS soc_max,
           last(battery_soc_percent, bucket) AS soc
    FROM telemetry_5min WHERE site_id = %(site)s AND bucket >= %(start)s AND bucket < %(end)s
    GROUP BY 1
), em AS (
    SELECT {g} AS k, count(*) AS n, sum(w) AS w FROM (
        SELECT bucket, sum(coalesce(abs(active_power_l1), 0) + coalesce(abs(active_power_l2), 0)
                           + coalesce(abs(active_power_l3), 0)) AS w
        FROM energymeter_5min WHERE site_id = %(site)s AND bucket >= %(start)s AND bucket < %(end)s
          AND (active_power_l1 IS NOT NULL OR active_power_l2 IS NOT NULL OR active_power_l3 IS NOT NULL)
        GROUP BY bucket) m
    GROUP BY 1
), ev AS (
    SELECT {g} AS k, count(*) AS n, sum(w) AS w FROM (
        SELECT bucket, sum(power_w) AS w FROM smartdevice_5min
        WHERE device_id = ANY(%(ev)s::int[]) AND bucket >= %(start)s AND bucket < %(end)s AND power_w IS NOT NULL
        GROUP BY bucket) p
    GROUP BY 1
)
SELECT k, inv.n, inv.pv, inv.inv_load, inv.bdis, inv.bchg, inv.imp, inv.exp, inv.inv_out,
       inv.soc_min, inv.soc_max, inv.soc, em.n, em.w, ev.n, ev.w
FROM (SELECT k FROM inv UNION SELECT k FROM em UNION SELECT k FROM ev) t
LEFT JOIN inv USING (k) LEFT JOIN em USING (k) LEFT JOIN ev USING (k)
ORDER BY k
"""
SLOT_KEY = "time_bucket('15 minutes', bucket)"
DAY_KEY = "(bucket AT TIME ZONE 'Asia/Kolkata')::date"


def ist_start(d: date) -> datetime:
    return datetime.combine(d, time(0), tzinfo=IST).astimezone(timezone.utc)


def _whole_from(site_id: str):
    raw = getattr(settings, 'HOUSE_WHOLE_FROM', {}).get(site_id)
    return date.fromisoformat(raw) if raw else None


def _parts_on(parts: set, site_id: str, d: date) -> set:
    """Before the site's first whole-home day only the inverter side counts."""
    wf = _whole_from(site_id)
    return {'inverter'} if wf and d < wf and 'house_meter' not in parts else parts


def _query(site, key: str, start: datetime, end: datetime) -> list:
    ev_ids = list(ev_plugs(site).values_list('id', flat=True))
    with connection.cursor() as cur:
        cur.execute(_SQL.format(g=key), {'site': site.site_id, 'start': start, 'end': end, 'ev': ev_ids})
        return cur.fetchall()


def _part(n, w, need):
    """kWh of one part, or None when fewer than `need` buckets arrived."""
    return None if n is None or w is None or n < need else float(w) * FIVE_MIN_KWH


def _flows(parts, r, need):
    (_, n_inv, pv, inv_load, bdis, bchg, imp, exp, inv_out, _smin, _smax, _soc, n_em, em_w, n_ev, ev_w) = r
    inv_ok = n_inv is not None and n_inv >= need
    k = (lambda w: float(w) * FIVE_MIN_KWH if inv_ok and w is not None else None)
    return split(parts, pv=k(pv), inverter=k(inv_load), grid_board=_part(n_em, em_w, need),
                 ev=_part(n_ev, ev_w, need), bdis=k(bdis), bchg=k(bchg), imp=k(imp), exp=k(exp)), k(inv_out)


def day_slots(site, d: date, now: datetime) -> dict:
    parts = _parts_on(site_parts(site), site.site_id, d)
    note = getattr(settings, 'LOAD_LINE_NOTES', {}).get(site.site_id)
    body = {'date': d.isoformat(), 'parts': sorted(parts), 'note': note, 'slots': [],
            'whole_home': 'grid_board' in parts or 'house_meter' in parts}
    if d < (now.astimezone(IST).date() - timedelta(days=RECENT_DAYS - 1)):
        return {**body, 'reason': 'older_than_90_days'}
    start = ist_start(d)
    end = min(start + timedelta(days=1), now)
    for r in _query(site, SLOT_KEY, start, end):
        f, inv_out = _flows(parts, r, MIN_SLOT_BUCKETS)
        kw = (lambda v: None if v is None else round(v * 4, 3))
        body['slots'].append({
            'ts': r[0].astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'whole_home': f['whole'],
            'pv_kw': kw(f['pv']), 'home_kw': kw(f['home']), 'from_solar_kw': kw(f['from_solar']),
            'from_battery_kw': kw(f['from_battery']), 'from_grid_kw': kw(f['from_grid']),
            'solar_to_battery_kw': kw(f['solar_to_battery']), 'exported_kw': kw(f['exported']),
            'inverter_kw': kw(_part(r[1], r[3], MIN_SLOT_BUCKETS)), 'grid_board_kw': kw(_part(r[12], r[13], MIN_SLOT_BUCKETS)),
            'inv_out_kw': kw(inv_out), 'soc': None if r[11] is None else round(float(r[11]), 1),
        })
    return body
```

- [ ] **Step 5: Run the tests and see them pass**

Expected: all tests in the file OK.
If `kw()` rounding gives 1.0 vs 0.9999, the test values (3 × 1000 W) are exact, so failures mean a real bug.

- [ ] **Step 6: Checkpoint.**
  - Changed: the service, the tests, `localapi/settings.py`.
  - Update D1–D3 to `passing`.

### Task 4: `daily_totals()`

**Files:**
- Modify: `api/services/household_history.py`
- Test: `tests/test_household_history.py`

- [ ] **Step 1: Write the failing tests** (append)

```python
from api.services.household_history import daily_totals  # noqa: E402

FIVE_MIN_KWH_T = 5.0 / 60.0 / 1000.0


def drow(k, n_inv=288, n_em=288, kwh=3.0):
    """A day row whose inverter, PV and grid-board sums each come to `kwh`."""
    w = kwh / FIVE_MIN_KWH_T
    return (k, n_inv, w, w, 0.0, 0.0, 0.0, 0.0, w, 40.0, 95.0, 60.0, n_em, w, None, None)


@override_settings(HOUSE_WHOLE_FROM={}, LOAD_LINE_NOTES={})
class DailyTotalsTests(SimpleTestCase):
    def run_range(self, cagg_rows, table_rows, start, end, now=NOW):
        cur = mock.MagicMock()
        cur.fetchall.side_effect = [table_rows, cagg_rows] if table_rows is not None else [cagg_rows]
        with mock.patch('api.services.household_history.connection') as conn, \
                mock.patch('api.services.household_history.site_parts', return_value=GB), \
                mock.patch('api.services.household_history.ev_plugs') as evp:
            evp.return_value.values_list.return_value = []
            conn.cursor.return_value.__enter__.return_value = cur
            return daily_totals(FakeSite(), start, end, now)

    def test_t1_full_day_and_low_coverage(self):
        full = drow(DAY0)                                    # inverter 3 + grid board 3
        thin = drow(DAY0 - timedelta(days=1), n_em=200)      # meter under 90% -> inverter side only
        body = self.run_range([thin, full], None, DAY0 - timedelta(days=1), DAY0)
        y, t = body['days']
        self.assertEqual((t['date'], t['home_kwh'], t['whole_home'], t['source']), ('2026-11-18', 6.0, True, '5min'))
        self.assertEqual((y['whole_home'], y['home_kwh']), (False, 3.0))  # grid board under 90% -> inverter side
        self.assertEqual(t['coverage'], 1.0)

    def test_t2_old_days_from_table(self):
        old = date(2026, 7, 1)
        table = [(old, 20.0, 15.0, 4.0, 3.0, 5.0, 4.5, 6.0, None, 40.0, 95.0)]
        body = self.run_range([], table, old, old)
        d = body['days'][0]
        self.assertEqual((d['source'], d['home_kwh'], d['whole_home']), ('daily_table', 21.0, True))

    def test_t3_today_coverage_vs_elapsed(self):
        today = NOW.astimezone(IST).date()                  # 11:30 IST -> 138 buckets elapsed
        body = self.run_range([drow(today, n_inv=130, n_em=130)], None, today, today)
        self.assertTrue(body['days'][0]['whole_home'])
        self.assertAlmostEqual(body['days'][0]['coverage'], round(130 / 138, 2))
```

The table-row tuple order is: day, pv_gen, load, grid_import, grid_export, batt_charge, batt_discharge, em_grid, ev, min_soc, max_soc.
In T2, home = load 15 + em 6 = 21.

- [ ] **Step 2: Run them and see them fail**

Expected: `ImportError: cannot import name 'daily_totals'`.

- [ ] **Step 3: Write `daily_totals()`** (append)

```python
_TABLE_SQL = """
SELECT day, pv_gen_kwh, load_kwh, grid_import_kwh, grid_export_kwh, batt_charge_kwh, batt_discharge_kwh,
       em_grid_kwh, ev_kwh, min_soc, max_soc
FROM site_daily_energy WHERE site_id = %s AND day >= %s AND day <= %s ORDER BY day
"""
IST_OFFSET = IST.utcoffset(None)


def _day_row(d: date, f: dict, source: str, coverage, soc_min, soc_max) -> dict:
    return {'date': d.isoformat(), 'source': source, 'whole_home': f['whole'], 'coverage': coverage,
            'pv_kwh': f['pv'], 'home_kwh': f['home'], 'from_solar_kwh': f['from_solar'],
            'from_battery_kwh': f['from_battery'], 'from_grid_kwh': f['from_grid'],
            'solar_to_battery_kwh': f['solar_to_battery'], 'exported_kwh': f['exported'],
            'soc_min': soc_min, 'soc_max': soc_max}


def daily_totals(site, start: date, end: date, now: datetime) -> dict:
    """One row per IST day. Recent days (CAGG retention) are summed from the 5-minute rollups with the |W| meter
    rule; older days come from site_daily_energy (its em_grid_kwh is the net total: source 'daily_table')."""
    parts_all = site_parts(site)
    today = now.astimezone(IST).date()
    first_recent = today - timedelta(days=RECENT_DAYS - 1)
    end = min(end, today)
    out = []
    if start < first_recent:
        with connection.cursor() as cur:
            cur.execute(_TABLE_SQL, [site.site_id, start, min(end, first_recent - timedelta(days=1))])
            for (d, pv, load, imp, exp, chg, dis, em, ev, smin, smax) in cur.fetchall():
                parts = _parts_on(parts_all, site.site_id, d)
                f = split(parts, pv=pv, inverter=load, grid_board=em, ev=ev, bdis=dis, bchg=chg, imp=imp, exp=exp)
                out.append(_day_row(d, f, 'daily_table', None, smin, smax))
    if end >= first_recent:
        lo = max(start, first_recent)
        elapsed = int((now - ist_start(today)).total_seconds() // 300)
        for r in _query(site, DAY_KEY, ist_start(lo), min(ist_start(end) + timedelta(days=1), now)):
            d = r[0]
            parts = _parts_on(parts_all, site.site_id, d)
            need_n = max(1, min(FULL_DAY, elapsed)) if d == today else FULL_DAY
            need = int(need_n * MIN_COVERAGE + 0.999)
            f, _ = _flows(parts, r, need)
            counts = [r[1]] + ([r[12]] if 'grid_board' in parts else []) + ([r[14]] if 'ev' in parts else [])
            coverage = round(min((c or 0) for c in counts) / need_n, 2)
            out.append(_day_row(d, f, '5min', min(coverage, 1.0),
                                None if r[9] is None else round(float(r[9]), 1),
                                None if r[10] is None else round(float(r[10]), 1)))
    note = getattr(settings, 'LOAD_LINE_NOTES', {}).get(site.site_id)
    return {'start': start.isoformat(), 'end': end.isoformat(), 'parts': sorted(parts_all), 'note': note, 'days': out}
```

Test arithmetic:
- T1: `need` for a full day is 260 (288 × 0.9, rounded up). `full` gives home 6.0 (inverter 3 + grid board 3). `thin` has only 200 meter buckets, so the grid board is unknown and home is the inverter's 3.0.
- T3: at 11:30 IST, 138 buckets have elapsed, so `need` is 125. With 130 buckets the day is whole, and coverage is 0.94.

- [ ] **Step 4: Run the tests and see them pass**

Expected: all OK.

- [ ] **Step 5: Checkpoint.**
  - Changed: the service and the tests.
  - Update T1–T3 to `passing`.

### Task 5: Routes, roles, events `ended`

**Files:**
- Create: `api/views/household.py`
- Modify: `api/views/__init__.py` (next to line 130 `from .site_events import site_events`)
- Modify: `api/urls.py` (next to line 230, the `events/` path)
- Modify: `api/staff_roles.py` (`V_RO` list, after `'site_events'`)
- Modify: `api/views/site_events.py:30` (incident dict)
- Test: `tests/test_household_history.py`

- [ ] **Step 1: Write the failing endpoint tests** (append)

```python
@override_settings(HOUSE_WHOLE_FROM={}, LOAD_LINE_NOTES={})
class EndpointTests(TestCase):
    def setUp(self):
        SolarSite.objects.create(site_id='s1', display_name='s1', latitude=11.0, longitude=77.0)
        self.user = get_user_model().objects.create_superuser('boss', 'b@example.com', 'pw')

    def get(self, url):
        c = APIClient()
        c.force_login(self.user)
        with mock.patch('api.views._shared._check_site_auth', return_value=True), \
                mock.patch('api.views.household.day_slots', return_value={'date': '2026-11-18', 'slots': []}) as ds, \
                mock.patch('api.views.household.daily_totals', return_value={'days': []}) as dt:
            return c.get(url), ds, dt

    def test_e1_day(self):
        resp, ds, _ = self.get('/api/sites/s1/household/day/?date=2026-11-18')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(ds.call_args[0][1], date(2026, 11, 18))

    def test_e1_daily(self):
        resp, _, dt = self.get('/api/sites/s1/household/daily/?start=2026-11-01&end=2026-11-18')
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(dt.call_args[0][1:3], (date(2026, 11, 1), date(2026, 11, 18)))

    def test_e2_bad_input(self):
        self.assertEqual(self.get('/api/sites/s1/household/day/?date=nope')[0].status_code, 400)
        self.assertEqual(self.get('/api/sites/s1/household/daily/?start=2025-01-01&end=2026-11-18')[0].status_code, 400)

    def test_e3_unknown_site(self):
        self.assertEqual(self.get('/api/sites/zz/household/day/?date=2026-11-18')[0].status_code, 404)
```

- [ ] **Step 2: Run them and see them fail**

Expected: 404s for every URL, because the routes don't exist yet.

- [ ] **Step 3: Write the views**

```python
"""History tab data: GET /sites/<id>/household/day/ and /household/daily/ (docs/test-scenarios/household-history.md)."""
from datetime import date, datetime, timedelta, timezone

from django.db import DatabaseError
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.response import Response

from api.permissions import IsStaffUser, require_site_access
from api.services.household_history import IST, daily_totals, day_slots
from api.throttles import AuthenticatedApiThrottle
from api.views._shared import error_response

MAX_DAYS = 400


def _site(site_id):
    from api.models import SolarSite
    return SolarSite.objects.filter(site_id=site_id).first()


def _day(raw, default):
    if not raw:
        return default
    return date.fromisoformat(raw)


@api_view(['GET'])
@permission_classes([IsStaffUser])
@throttle_classes([AuthenticatedApiThrottle])
@require_site_access
def site_household_day(request, site_id):
    """?date=YYYY-MM-DD (IST day, default today): 15-min whole-home slots."""
    site = _site(site_id)
    if site is None:
        return error_response('Site not found', 404, code='SITE_NOT_FOUND')
    now = datetime.now(timezone.utc)
    try:
        d = _day(request.query_params.get('date'), now.astimezone(IST).date())
    except ValueError:
        return error_response('date must be YYYY-MM-DD', 400, code='INVALID_DATE')
    try:
        return Response(day_slots(site, d, now))
    except DatabaseError:
        return error_response('History is unavailable right now', 503, code='HISTORY_UNAVAILABLE')


@api_view(['GET'])
@permission_classes([IsStaffUser])
@throttle_classes([AuthenticatedApiThrottle])
@require_site_access
def site_household_daily(request, site_id):
    """?start=&end= (IST days, default the last 30, at most 400 days): whole-home daily totals."""
    site = _site(site_id)
    if site is None:
        return error_response('Site not found', 404, code='SITE_NOT_FOUND')
    now = datetime.now(timezone.utc)
    today = now.astimezone(IST).date()
    try:
        end = _day(request.query_params.get('end'), today)
        start = _day(request.query_params.get('start'), end - timedelta(days=29))
    except ValueError:
        return error_response('start and end must be YYYY-MM-DD', 400, code='INVALID_DATE')
    if start > end or (end - start).days >= MAX_DAYS:
        return error_response(f'range must be 1..{MAX_DAYS} days', 400, code='INVALID_RANGE')
    try:
        return Response(daily_totals(site, start, end, now))
    except DatabaseError:
        return error_response('History is unavailable right now', 503, code='HISTORY_UNAVAILABLE')
```

- [ ] **Step 4: Wire them up**

`api/views/__init__.py`, after `from .site_events import site_events`:

```python
from .household import site_household_day, site_household_daily
```

`api/urls.py`, after the `sites/<str:site_id>/events/` line (keep the file's tab indentation):

```python
	path("sites/<str:site_id>/household/day/", views.site_household_day, name="site_household_day"),
	path("sites/<str:site_id>/household/daily/", views.site_household_daily, name="site_household_daily"),
```

`api/staff_roles.py`: in the `(V_RO, [...])` list, change `'site_data_quality_gaps', 'site_incidents', 'site_events',` to:

```python
        'site_data_quality_gaps', 'site_incidents', 'site_events', 'site_household_day', 'site_household_daily',
```

`api/views/site_events.py:30`: in the incident dict, add `'ended'` after `'status': i.status,`:

```python
    events = [{'at': i.ts_start, 'ended': i.ts_end.isoformat() if i.ts_end else None, 'kind': 'incident', 'title': i.title,
               'severity': i.severity, 'status': i.status,
               'actor': None, 'device_id': i.device_id, 'serial': i.device.device_serial if i.device else None}
```

- [ ] **Step 5: Run the file's tests plus the role and convention checks**

```bash
PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests.test_household_history tests.test_staff_roles --settings=localapi.test_settings -v 1
.venv/Scripts/python.exe scripts/check_api_conventions.py
```

Expected: all OK; the checker passes (both views use `error_response` and a throttle).

- [ ] **Step 6: Run the full backend suite**

```bash
PYTHONUTF8=1 .venv/Scripts/python.exe manage.py test tests --settings=localapi.test_settings -v 1
```

Expected: the same pass count as before plus the new tests; no new failures.

- [ ] **Step 7: Checkpoint.**
  - Changed: `api/views/household.py`, `api/views/__init__.py`, `api/urls.py`, `api/staff_roles.py`, `api/views/site_events.py`, `tests/test_household_history.py`.
  - Update E1–E4 to `passing`.
  - E4 has no dedicated test: the field is additive; mark it `written` and check it live.

---

## Frontend (repo `C:\360watts\smart-solar-react-frontend`)

Run tests with:

```bash
npx jest src/shared/components/SiteDataPanel
```

### Task 6: Scenario document

**Files:**
- Create: `docs/test-scenarios/history-tab-redesign.md`
- Delete: `docs/test-scenarios/history-power-flow-card.md` (superseded; its H-rows are covered below)

- [ ] **Step 1: Write the doc**

```markdown
# History tab redesign (test scenarios)

Spec: docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md. Mockups A3 + C: https://claude.ai/artifact/SuAi4BH4Egw26t4jdaHEVz.
Data: GET /sites/<id>/household/day/ and /household/daily/ (backend docs/test-scenarios/household-history.md), GET /sites/<id>/events/.

| # | Area | Given | When | Then | Type | P | Status |
|---|---|---|---|---|---|---|---|
| M1 | Model | now 11:30 IST Nov 19 | periodRange today/7d/30d, offset 0 and -1 | IST day strings; 7d = Nov 13–19; -1 = Nov 6–12 | unit | P0 | planned |
| M2 | Model | 3 whole days + 1 inverter-only day | totals | basis whole, counted 3 of 4, sums only whole days | unit | P0 | planned |
| M3 | Model | no whole days | totals | basis inverter, counted = days with a home figure | unit | P0 | planned |
| M4 | Model | slots for yesterday | slotsToFlows until the same clock time | kWh = kW × 0.25 for slots before the time | unit | P0 | planned |
| M5 | Model | incident Nov 15–17, range Nov 13–19 | buildFlags | one amber flag, dates 15,16,17 | unit | P0 | planned |
| M6 | Model | day coverage 0.6, battery 40–45% | buildFlags | gap flag (grey), battery flag (amber); checks 3 | unit | P1 | planned |
| M7 | Model | totals + previous | sentence | own % and "up from"/"down from"/"the same"; inverter basis says "inverter circuits" | unit | P1 | planned |
| M8 | Model | 30-day range starting Wednesday | calendarCells | 2 blank cells first (Monday start); levels 0–4; grid metric inverted | unit | P1 | planned |
| U1 | Tab | Today data | render | chart first; header line with own %, bought, exported; then Anything wrong?; then Where energy went with 4 tiles | unit | P0 | planned |
| U2 | Tab | 7 days | click "7 days" | daily stacked bars; solar made dots | unit | P0 | planned |
| U3 | Tab | 30 days | click "30 days" | calendar, 30 day buttons; click one shows its panel | unit | P0 | planned |
| U4 | Tab | inverter-only days in the period | render | note "Whole home on N of M days" | unit | P0 | planned |
| U5 | Tab | site without meter | render | "Inverter circuits only" label; tiles still show | unit | P1 | planned |
| U6 | Tab | ‹ pressed | click | requests move one period back; › disabled at offset 0 | unit | P1 | planned |
| U7 | Tab | Inverter detail on | toggle | Inv Out and inverter-side lines added to the Today chart | unit | P2 | planned |
| U8 | Tab | Table view | click Table | table with the same rows | unit | P2 | planned |
| M9 | Model | custom Aug 22–Nov 19 (90 days), offset -1 | customRange, weeks | len 90, steps back 90 days; 13 weekly rows summing their days; balance check flags a >5% gap | unit | P1 | planned |
| U9 | Tab | Pick dates, From set 90 days back | change | weekly bars ("Week of …"), 13 of them; ≤60 days stays daily | unit | P1 | planned |
| U10 | Tab | solar made ≠ home + battery + exported by >5% | render | "Figures don't fully balance" note with the gap | unit | P2 | planned |
| L1 | Live | coim_002 Today | compare | home within 2% of Load card All view | live | P0 | planned |
| L2 | Live | coim_002 30 days | look | days before Oct 23 greyed; note shows N of 30 | live | P0 | planned |
| L3 | Live | switching periods / ‹ › | use | instant after first load (5-min cache) | live | P1 | planned |
| L4 | Live | a meter-less site | look | inverter-only label everywhere | live | P1 | planned |
| L5 | Live | light/dark, 390 px wide | look | readable, calendar fits, no sideways page scroll | live | P1 | planned |
```

- [ ] **Step 2: Checkpoint.** Changed: the new doc, plus the removed `history-power-flow-card.md`.

### Task 7: API types and calls

**Files:**
- Modify: `src/services/api.ts`: methods next to `getSiteEvents` (line ~1186), types next to `SiteEvents` (line ~2498)

- [ ] **Step 1: Add the types** (after `export interface SiteEvents ...`)

```ts
// History tab (backend api/services/household_history.py). kW per 15-min slot, kWh per IST day.
export interface HouseSlot {
  ts: string; whole_home: boolean;
  pv_kw: number | null; home_kw: number | null; from_solar_kw: number | null; from_battery_kw: number | null;
  from_grid_kw: number | null; solar_to_battery_kw: number | null; exported_kw: number | null;
  inverter_kw: number | null; grid_board_kw: number | null; inv_out_kw: number | null; soc: number | null;
}
export interface HouseholdDay { date: string; parts: string[]; whole_home: boolean; note: string | null; reason?: string; slots: HouseSlot[] }
export interface HouseDay {
  date: string; source: '5min' | 'daily_table'; whole_home: boolean; coverage: number | null;
  pv_kwh: number | null; home_kwh: number | null; from_solar_kwh: number | null; from_battery_kwh: number | null;
  from_grid_kwh: number | null; solar_to_battery_kwh: number | null; exported_kwh: number | null;
  soc_min: number | null; soc_max: number | null;
}
export interface HouseholdDaily { start: string; end: string; parts: string[]; note: string | null; days: HouseDay[] }
```

Also add `ended?: string | null;` to the existing `SiteEvent` interface.

- [ ] **Step 2: Add the methods** (after `getSiteEvents`)

```ts
  // History tab: one IST day of whole-home 15-min slots / whole-home daily totals. 5-min cache: toggling is instant.
  async getHouseholdDay(siteId: string, date: string): Promise<HouseholdDay> {
    return cacheService.dedup(`household_day_${siteId}_${date}`,
      () => this.request(`/sites/${encodeURIComponent(siteId)}/household/day/?date=${date}`), 5 * 60 * 1000);
  }

  async getHouseholdDaily(siteId: string, start: string, end: string): Promise<HouseholdDaily> {
    return cacheService.dedup(`household_daily_${siteId}_${start}_${end}`,
      () => this.request(`/sites/${encodeURIComponent(siteId)}/household/daily/?start=${start}&end=${end}`), 5 * 60 * 1000);
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p . 2>&1 | grep services/api.ts`
Expected: no output.

- [ ] **Step 4: Checkpoint.** Changed: `src/services/api.ts`.

### Task 8: `historyModel.ts`

**Files:**
- Create: `src/shared/components/SiteDataPanel/tabs/historyModel.ts`
- Test: `src/shared/components/SiteDataPanel/tabs/historyModel.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  addDays, buildFlags, calendarCells, change, periodRange, prevRange, sentence, slotsToFlows, totals,
} from './historyModel';
import type { HouseDay, HouseSlot } from '../../../../services/api';

// scenarios: docs/test-scenarios/history-tab-redesign.md (M1-M8)
const NOW = Date.parse('2026-11-19T06:00:00Z'); // 11:30 IST
const day = (date: string, o: Partial<HouseDay> = {}): HouseDay => ({
  date, source: '5min', whole_home: true, coverage: 1, pv_kwh: 30, home_kwh: 30, from_solar_kwh: 12,
  from_battery_kwh: 6, from_grid_kwh: 12, solar_to_battery_kwh: 8, exported_kwh: 10, soc_min: 25, soc_max: 95, ...o,
});

describe('historyModel', () => {
  it('M1 period ranges in IST', () => {
    expect(periodRange('today', 0, NOW)).toEqual({ start: '2026-11-19', end: '2026-11-19', len: 1 });
    expect(periodRange('7d', 0, NOW)).toEqual({ start: '2026-11-13', end: '2026-11-19', len: 7 });
    expect(periodRange('7d', -1, NOW)).toEqual({ start: '2026-11-06', end: '2026-11-12', len: 7 });
    expect(prevRange(periodRange('30d', 0, NOW))).toEqual({ start: '2026-09-21', end: '2026-10-20', len: 30 });
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('M2 whole-home days only when there are any', () => {
    const t = totals([day('a'), day('b'), day('c'), day('d', { whole_home: false, home_kwh: 14 })]);
    expect([t.basis, t.counted, t.of, t.home, t.ownPct]).toEqual(['whole', 3, 4, 90, 60]);
  });

  it('M3 inverter basis when no whole day', () => {
    const t = totals([day('a', { whole_home: false }), day('b', { whole_home: false, home_kwh: null })]);
    expect([t.basis, t.counted, t.of]).toEqual(['inverter', 1, 2]);
  });

  it('M4 slots summed up to a clock time', () => {
    const s = (ts: string, home: number): HouseSlot => ({
      ts, whole_home: true, pv_kw: 0, home_kw: home, from_solar_kw: 0, from_battery_kw: 0, from_grid_kw: home,
      solar_to_battery_kw: 0, exported_kw: 0, inverter_kw: home, grid_board_kw: 0, inv_out_kw: 0, soc: 50,
    });
    const f = slotsToFlows([s('2026-11-18T00:00:00Z', 2), s('2026-11-18T00:15:00Z', 4), s('2026-11-18T06:00:00Z', 8)],
      Date.parse('2026-11-18T06:00:00Z'));
    expect([f.home_kwh, f.from_grid_kwh, f.whole_home]).toEqual([1.5, 1.5, true]);
  });

  it('M5 incident flag covers its days', () => {
    const r = periodRange('7d', 0, NOW);
    const { list } = buildFlags([], [{ at: '2026-11-15T04:00:00Z', ended: '2026-11-17T10:00:00Z', kind: 'incident', title: 'Inverter offline', severity: 'critical' } as any], r, true, '2026-11-19');
    expect(list).toHaveLength(1);
    expect([list[0].tone, list[0].dates]).toEqual(['amber', ['2026-11-15', '2026-11-16', '2026-11-17']]);
  });

  it('M6 gap and battery flags', () => {
    const r = periodRange('7d', 0, NOW);
    const { list, checks } = buildFlags([day('2026-11-14', { coverage: 0.6, soc_min: 40, soc_max: 45 })], [], r, true, '2026-11-19');
    expect(list.map(f => [f.kind, f.tone])).toEqual([['gap', 'grey'], ['battery', 'amber']]);
    expect(checks).toBe(3);
  });

  it('M7 sentence', () => {
    const cur = totals([day('a')]);
    expect(sentence(cur, totals([day('b', { from_solar_kwh: 9 })]), 'Today')).toBe(
      'Today the home ran 60% on its own power (solar + battery), up from 50%. It bought 12.0 kWh from the grid and sent 10.0 kWh back.');
    expect(sentence(totals([day('a', { whole_home: false })]), null, 'Today')).toMatch(/^Today the inverter circuits ran 60%/);
    expect(change(12, 10)).toBe(20);
    expect(change(5, 0)).toBeNull();
  });

  it('M8 calendar cells, Monday first, grid inverted', () => {
    const r = { start: '2026-10-21', end: '2026-11-19', len: 30 }; // Oct 21 2026 is a Wednesday
    const days = [day('2026-10-21', { from_grid_kwh: 5 }), day('2026-10-22', { from_grid_kwh: 15 })];
    const cells = calendarCells(days, r, 'grid', new Set(['2026-10-22']));
    expect(cells.slice(0, 2).every(c => c.date === null)).toBe(true);
    expect([cells[2].date, cells[2].level, cells[3].level, cells[3].flagged]).toEqual(['2026-10-21', 4, 0, true]);
    expect(cells).toHaveLength(32);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest src/shared/components/SiteDataPanel/tabs/historyModel.test.ts`
Expected: FAIL, "Cannot find module './historyModel'".

- [ ] **Step 3: Write the model**

```ts
/**
 * Pure maths for the History tab: periods, the mixed-days totals rule, comparisons, flags, the sentence and the
 * calendar. Spec docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md; scenarios
 * docs/test-scenarios/history-tab-redesign.md (M1-M8).
 */
import type { HouseDay, HouseSlot, SiteEvent } from '../../../../services/api';

export type Period = 'today' | '7d' | '30d';
export type Metric = 'own' | 'pv' | 'grid';
export const DAY_MS = 86_400_000;
const IST_MS = 19_800_000;
export const LEN: Record<Period, number> = { today: 1, '7d': 7, '30d': 30 };

export const istDay = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);
export const dayStartMs = (d: string) => Date.parse(`${d}T00:00:00+05:30`);
export const addDays = (d: string, n: number) => istDay(dayStartMs(d) + n * DAY_MS);
export const fmtDay = (d: string) =>
  new Date(dayStartMs(d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export interface Range { start: string; end: string; len: number }
export function periodRange(p: Period, offset: number, nowMs: number): Range {
  const len = LEN[p];
  const end = addDays(istDay(nowMs), offset * len);
  return { start: addDays(end, -(len - 1)), end, len };
}
export const prevRange = (r: Range): Range => ({ start: addDays(r.start, -r.len), end: addDays(r.start, -1), len: r.len });
export const daysOf = (r: Range) => Array.from({ length: r.len }, (_, i) => addDays(r.start, i));

export type HouseFlows = Pick<HouseDay, 'whole_home' | 'pv_kwh' | 'home_kwh' | 'from_solar_kwh' | 'from_battery_kwh'
  | 'from_grid_kwh' | 'solar_to_battery_kwh' | 'exported_kwh'>;

export interface Totals {
  basis: 'whole' | 'inverter'; counted: number; of: number;
  pv: number; home: number; fromSolar: number; fromBattery: number; fromGrid: number;
  toBattery: number; exported: number; ownPct: number | null;
}
const n0 = (v: number | null | undefined) => v ?? 0;

/** Whole-home days only when the period has any (owner, Nov 19); otherwise the inverter side of every day. */
export function totals(rows: HouseFlows[]): Totals {
  const known = rows.filter(r => r.home_kwh != null);
  const whole = known.filter(r => r.whole_home);
  const use = whole.length ? whole : known;
  const s = (k: keyof HouseFlows) => use.reduce((t, r) => t + n0(r[k] as number | null), 0);
  const home = s('home_kwh'), fromSolar = s('from_solar_kwh'), fromBattery = s('from_battery_kwh');
  return {
    basis: whole.length ? 'whole' : 'inverter', counted: use.length, of: rows.length,
    pv: s('pv_kwh'), home, fromSolar, fromBattery, fromGrid: s('from_grid_kwh'),
    toBattery: s('solar_to_battery_kwh'), exported: s('exported_kwh'),
    ownPct: home > 0 ? Math.round(((fromSolar + fromBattery) / home) * 100) : null,
  };
}

/** A day's flows from its 15-min slots, counting slots that start before `untilMs` (today vs the same hours yesterday). */
export function slotsToFlows(slots: HouseSlot[], untilMs = Infinity): HouseFlows {
  const use = slots.filter(s => Date.parse(s.ts) < untilMs && s.home_kw != null);
  const s = (k: keyof HouseSlot) => +(use.reduce((t, x) => t + n0(x[k] as number | null), 0) * 0.25).toFixed(3);
  return {
    whole_home: use.length > 0 && use.every(x => x.whole_home), pv_kwh: s('pv_kw'), home_kwh: use.length ? s('home_kw') : null,
    from_solar_kwh: s('from_solar_kw'), from_battery_kwh: s('from_battery_kw'), from_grid_kwh: s('from_grid_kw'),
    solar_to_battery_kwh: s('solar_to_battery_kw'), exported_kwh: s('exported_kw'),
  };
}

export const change = (cur: number | null, prev: number | null) =>
  cur == null || prev == null || prev <= 0 ? null : Math.round(((cur - prev) / prev) * 100);

export interface Flag { kind: 'incident' | 'gap' | 'battery'; tone: 'amber' | 'grey'; title: string; detail: string; dates: string[] }

/** "Anything wrong?": incidents, missing readings, a battery that barely moved. No solar-vs-forecast flag (owner, Nov 19). */
export function buildFlags(days: HouseDay[], events: SiteEvent[], r: Range, hasBattery: boolean, today: string): { list: Flag[]; checks: number } {
  const list: Flag[] = [];
  for (const e of events) {
    if (e.kind !== 'incident') continue;
    const a = istDay(Date.parse(e.at));
    const b = e.ended ? istDay(Date.parse(e.ended)) : today;
    const dates: string[] = [];
    for (let d = a < r.start ? r.start : a; d <= b && d <= r.end; d = addDays(d, 1)) dates.push(d);
    if (!dates.length) continue;
    list.push({
      kind: 'incident', tone: e.severity === 'info' ? 'grey' : 'amber', title: e.title,
      detail: `${fmtDay(a)}${b !== a ? ` – ${fmtDay(b)}` : ''}${e.ended ? '' : ' · still open'}`, dates,
    });
  }
  const gaps = days.filter(d => d.coverage != null && d.coverage < 0.9);
  if (gaps.length) {
    list.push({
      kind: 'gap', tone: 'grey', dates: gaps.map(d => d.date),
      title: gaps.length === 1 ? `Readings missing on ${fmtDay(gaps[0].date)}` : `Readings missing on ${gaps.length} days`,
      detail: 'Totals for those days count only the readings that arrived.',
    });
  }
  if (hasBattery) {
    const flat = days.filter(d => d.date !== today && d.soc_min != null && d.soc_max != null && d.soc_max - d.soc_min < 20);
    if (flat.length) {
      list.push({
        kind: 'battery', tone: 'amber', dates: flat.map(d => d.date),
        title: flat.length === 1 ? `Battery barely used on ${fmtDay(flat[0].date)}` : `Battery barely used on ${flat.length} days`,
        detail: 'Its charge moved less than 20 points in the day.',
      });
    }
  }
  return { list, checks: 3 };
}

export function sentence(t: Totals, prev: Totals | null, label: string): string {
  if (t.ownPct == null) return 'No readings for this period yet.';
  const who = t.basis === 'whole' ? 'the home' : 'the inverter circuits';
  const was = prev?.ownPct == null ? '' : prev.ownPct === t.ownPct ? ', the same as before'
    : `, ${t.ownPct > prev.ownPct ? 'up' : 'down'} from ${prev.ownPct}%`;
  return `${label} ${who} ran ${t.ownPct}% on its own power (solar + battery)${was}. `
    + `It bought ${t.fromGrid.toFixed(1)} kWh from the grid and sent ${t.exported.toFixed(1)} kWh back.`;
}

export interface Cell { date: string | null; value: number | null; level: number; flagged: boolean; whole: boolean }
const metricOf = (d: HouseDay | undefined, m: Metric): number | null => {
  if (!d || d.home_kwh == null) return null;
  if (m === 'pv') return d.pv_kwh;
  if (m === 'grid') return d.from_grid_kwh;
  return d.home_kwh > 0 ? Math.round(((n0(d.from_solar_kwh) + n0(d.from_battery_kwh)) / d.home_kwh) * 100) : null;
};

/** Monday-first grid; level 0..4 = worse..better within the period (-1 = no data); grid bought is inverted. */
export function calendarCells(days: HouseDay[], r: Range, m: Metric, flagged: Set<string>): Cell[] {
  const by = new Map(days.map(d => [d.date, d]));
  const vals = daysOf(r).map(d => metricOf(by.get(d), m)).filter((v): v is number => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const level = (v: number | null) => {
    if (v == null) return -1;
    let t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
    if (m === 'grid') t = 1 - t;
    return Math.min(4, Math.floor(t * 5));
  };
  const lead = (new Date(dayStartMs(r.start) + IST_MS).getUTCDay() + 6) % 7;
  const pad: Cell[] = Array.from({ length: lead }, () => ({ date: null, value: null, level: -1, flagged: false, whole: false }));
  return pad.concat(daysOf(r).map(d => {
    const row = by.get(d);
    const v = metricOf(row, m);
    return { date: d, value: v, level: level(v), flagged: flagged.has(d), whole: !!row?.whole_home };
  }));
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx jest src/shared/components/SiteDataPanel/tabs/historyModel.test.ts`
Expected: 8 passed.

Arithmetic in M2: three whole days give home 90, solar 36 and battery 18, so own power is 54/90 = 60%.
Arithmetic in M8: grid values 5 and 15; 5 is the best, so level 4; 15 gives level 0.

- [ ] **Step 5: Checkpoint.**
  - Changed: `historyModel.ts`, `historyModel.test.ts`.
  - Update M1–M8 to `passing`.

### Task 9: `HistoryCalendar.tsx`

**Files:**
- Create: `src/shared/components/SiteDataPanel/tabs/HistoryCalendar.tsx`

- [ ] **Step 1: Write the component** (tested through the tab in Task 10)

```tsx
/** 30-day calendar (mockup C): one tile per day coloured by the chosen measure, amber ring on flagged days. */
import React from 'react';
import type { HouseDay } from '../../../../services/api';
import { calendarCells, fmtDay, type Metric, type Range } from './historyModel';
import { KpiTile, Seg } from './cardParts';

const SHADES = ['#E6F4F2', '#B7E3DC', '#6FC7BA', '#1F9E8E', '#0B6B60'];
const SHADES_DARK = ['#12302C', '#174A43', '#1E6B60', '#2A9C8B', '#5EEAD4'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const HistoryCalendar: React.FC<{
  days: HouseDay[]; range: Range; flagged: Set<string>; isDark: boolean;
  metric: Metric; onMetric: (m: Metric) => void; picked: string | null; onPick: (d: string) => void; onOpen: (d: string) => void;
}> = ({ days, range, flagged, isDark, metric, onMetric, picked, onPick, onOpen }) => {
  const cells = calendarCells(days, range, metric, flagged);
  const shades = isDark ? SHADES_DARK : SHADES;
  const sel = days.find(d => d.date === picked) ?? null;
  const own = sel && sel.home_kwh ? Math.round((((sel.from_solar_kwh ?? 0) + (sel.from_battery_kwh ?? 0)) / sel.home_kwh) * 100) : null;
  const fmt = (v: number | null) => (v == null ? '–' : metric === 'own' ? `${v}%` : v.toFixed(1));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Seg<Metric> label="Colour by" value={metric} isDark={isDark} onChange={onMetric}
          options={[['own', 'Own power'], ['pv', 'Solar made'], ['grid', 'Grid bought']]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {DOW.map(d => <div key={d} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted-foreground)', textAlign: 'center' }}>{d}</div>)}
          {cells.map((c, i) => c.date == null ? <div key={`pad-${i}`} /> : (
            <button key={c.date} type="button" onClick={() => onPick(c.date!)} aria-pressed={picked === c.date}
              aria-label={`${fmtDay(c.date)}: ${fmt(c.value)}${c.flagged ? ', has a flag' : ''}${c.whole ? '' : ', inverter circuits only'}`}
              style={{
                border: 'none', borderRadius: 12, minHeight: 56, padding: 6, cursor: 'pointer', textAlign: 'left',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Rubik, sans-serif',
                background: c.level < 0 ? 'transparent' : shades[c.level],
                color: c.level >= 3 && !isDark ? '#fff' : 'var(--foreground)',
                opacity: c.whole ? 1 : 0.55,
                boxShadow: c.flagged ? '0 0 0 3px #B45309' : undefined,
                outline: picked === c.date ? '3px solid var(--foreground)' : undefined, outlineOffset: 2,
              }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{Number(c.date.slice(8))}</span>
              <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '0.95rem', fontWeight: 700 }}>{fmt(c.value)}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sel ? (
          <>
            <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'Rubik, sans-serif' }}>{fmtDay(sel.date)}</h3>
            <KpiTile isDark={isDark} tone="orange" label="Own power" value={own ?? '–'} unit={own != null ? '%' : undefined} />
            <KpiTile isDark={isDark} tone="blue" label="Grid bought" value={sel.from_grid_kwh?.toFixed(1) ?? '–'} unit="kWh"
              sub={`Solar made ${sel.pv_kwh?.toFixed(1) ?? '–'} kWh · home ${sel.home_kwh?.toFixed(1) ?? '–'} kWh`} />
            <button type="button" onClick={() => onOpen(sel.date)}
              style={{ minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--foreground)', color: 'var(--background)', fontWeight: 600, cursor: 'pointer' }}>
              Open this day
            </button>
          </>
        ) : <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Pick a day to see its numbers.</p>}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p . 2>&1 | grep HistoryCalendar`
Expected: no output.

- [ ] **Step 3: Checkpoint.** Changed: `HistoryCalendar.tsx`.

### Task 10: Rewrite `HistoryTab.tsx`

**Files:**
- Rewrite: `src/shared/components/SiteDataPanel/tabs/HistoryTab.tsx`
- Rewrite: `src/shared/components/SiteDataPanel/tabs/HistoryTab.test.tsx`

- [ ] **Step 1: Write the failing tests** (replace the file)

```tsx
import '@testing-library/jest-dom';
import React from 'react'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HistoryTab from './HistoryTab';

// scenarios: docs/test-scenarios/history-tab-redesign.md (U1-U8)
const mockChart: { props: any } = { props: null };
jest.mock('react-chartjs-2', () => ({
  Line: (p: any) => { mockChart.props = p; return <div data-testid="chart" />; },
  Bar: (p: any) => { mockChart.props = p; return <div data-testid="bars" />; },
}));
jest.mock('../chartUtils', () => ({
  useChartZoomState: () => ({ chartRef: { current: null }, isZoomed: false, resetZoom: () => {}, onZoomComplete: { current: () => {} } }),
  ZoomResetButton: () => null,
}));
const getDay = jest.fn();
const getDaily = jest.fn();
const getEvents = jest.fn();
jest.mock('../../../../services/api', () => ({
  apiService: {
    getHouseholdDay: (...a: any[]) => getDay(...a),
    getHouseholdDaily: (...a: any[]) => getDaily(...a),
    getSiteEvents: (...a: any[]) => getEvents(...a),
  },
}));

const NOW = Date.parse('2026-11-19T06:00:00Z');
const slot = (ts: string, whole = true) => ({
  ts, whole_home: whole, pv_kw: 4, home_kw: 4, from_solar_kw: 2, from_battery_kw: 0.4, from_grid_kw: 1.6,
  solar_to_battery_kw: 1, exported_kw: 1, inverter_kw: 2, grid_board_kw: 2, inv_out_kw: 3, soc: 60,
});
const dayRow = (date: string, whole = true) => ({
  date, source: '5min', whole_home: whole, coverage: 1, pv_kwh: 30, home_kwh: 30, from_solar_kwh: 12,
  from_battery_kwh: 6, from_grid_kwh: 12, solar_to_battery_kwh: 8, exported_kwh: 10, soc_min: 25, soc_max: 95,
});
const addD = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00+05:30`) + n * 864e5 + 19_800_000).toISOString().slice(0, 10);

beforeEach(() => {
  mockChart.props = null;
  getDay.mockImplementation((_s: string, date: string) => Promise.resolve({
    date, parts: ['grid_board', 'inverter'], whole_home: true, note: null,
    slots: [slot(`${addD(date, 0)}T00:00:00Z`), slot(`${addD(date, 0)}T00:15:00Z`)],
  }));
  getDaily.mockImplementation((_s: string, start: string, end: string) => {
    const days: any[] = [];
    for (let d = start; d <= end; d = addD(d, 1)) days.push(dayRow(d, d >= '2026-11-01'));
    return Promise.resolve({ start, end, parts: ['grid_board', 'inverter'], note: null, days });
  });
  getEvents.mockResolvedValue({ days: 7, events: [] });
});
const setup = () => render(<HistoryTab siteId="s1" isDark={false} nowMs={NOW} />);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('HistoryTab', () => {
  it('U1 Today: chart first, header summary, flags, then where energy went', async () => {
    setup();
    await screen.findByTestId('chart');
    const order = ['history-chart', 'history-flags', 'history-where'].map(id => screen.getByTestId(id));
    expect(order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('history-chart')).toHaveTextContent(/own power/);
    expect(screen.getAllByTestId('kpi')).toHaveLength(4);
    expect(screen.getByTestId('history-flags')).toHaveTextContent('No problems found in 3 checks');
  });

  it('U2 7 days: stacked daily bars', async () => {
    setup();
    click('7 days');
    await screen.findByTestId('bars');
    expect(mockChart.props.data.labels).toHaveLength(7);
    expect(mockChart.props.data.datasets.map((d: any) => d.label)).toEqual(['From solar', 'From battery', 'From grid', 'Solar made']);
  });

  it('U3 30 days: calendar with clickable days', async () => {
    setup();
    click('30 days');
    const tiles = await screen.findAllByRole('button', { name: /^\w{3}, \d+ \w{3}:/ });
    expect(tiles).toHaveLength(30);
    fireEvent.click(tiles[29]);
    expect(screen.getByRole('button', { name: 'Open this day' })).toBeInTheDocument();
  });

  it('U4 mixed days note', async () => {
    setup();
    click('30 days');
    await screen.findAllByRole('button', { name: /^\w{3}, \d+ \w{3}:/ });
    expect(screen.getByTestId('history-where')).toHaveTextContent('Whole home on 19 of 30 days');
  });

  it('U5 site without a meter', async () => {
    getDay.mockImplementation((_s: string, date: string) => Promise.resolve({ date, parts: ['inverter'], whole_home: false, note: null, slots: [slot(`${date}T00:00:00Z`, false)] }));
    setup();
    await screen.findByTestId('chart');
    expect(screen.getByTestId('history-where')).toHaveTextContent('Inverter circuits only');
  });

  it('U6 stepping back', async () => {
    setup();
    await screen.findByTestId('chart');
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled();
    click('Previous period');
    // Nov 18 is already fetched as "the day before" on load; stepping back must fetch Nov 17
    await waitFor(() => expect(getDay).toHaveBeenCalledWith('s1', '2026-11-17'));
  });

  it('U7 inverter detail adds raw lines', async () => {
    setup();
    await screen.findByTestId('chart');
    click('Inverter detail');
    expect(mockChart.props.data.datasets.map((d: any) => d.label)).toEqual(expect.arrayContaining(['Inverter output', 'Inverter-side load']));
  });

  it('U8 table view', async () => {
    setup();
    await screen.findByTestId('chart');
    click('Table');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
```

U4 arithmetic: the 30-day range is Oct 21–Nov 19, and days from Nov 1 are whole. That makes Nov 1–19 = 19 of 30.

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest src/shared/components/SiteDataPanel/tabs/HistoryTab.test.tsx`
Expected: FAIL. The old component has a different props shape and none of these test ids.

- [ ] **Step 3: Write the tab** (replace the file)

```tsx
/**
 * History tab (2026-11-19): chart first, then "Anything wrong?", then "Where energy went". Whole home where the site
 * has the parts (inverter + grid board + EV), else "Inverter circuits only". Spec
 * docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md (mockups A3 + C); scenarios
 * docs/test-scenarios/history-tab-redesign.md.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar as CJBar, Line as CJLine } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { apiService, type HouseDay, type HouseholdDay, type SiteEvent } from '../../../../services/api';
import { useChartZoomState, ZoomResetButton } from '../chartUtils';
import { ChartLegend, KpiRow, KpiTile, Seg, ink, inkMuted, legendFrom, segBtn, segWrap } from './cardParts';
import { HistoryCalendar } from './HistoryCalendar';
import {
  buildFlags, change, daysOf, fmtDay, istDay, periodRange, prevRange, sentence, slotsToFlows, totals,
  type Metric, type Period, type Totals,
} from './historyModel';

const SOLAR = '#F07522', BATT = '#0F9F8F', GRID = '#3B82F6', MADE = '#9A3412';
const k1 = (v: number) => v.toFixed(1);
const signed = (v: number | null) => (v == null ? null : `${v > 0 ? '+' : ''}${v}%`);

interface Props { siteId: string; isDark: boolean; nowMs?: number }

const HistoryTab: React.FC<Props> = ({ siteId, isDark, nowMs }) => {
  const now = nowMs ?? Date.now();
  const [period, setPeriod] = useState<Period>('today');
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [detail, setDetail] = useState(false);
  const [metric, setMetric] = useState<Metric>('own');
  const [picked, setPicked] = useState<string | null>(null);
  const [day, setDay] = useState<HouseholdDay | null>(null);
  const [prevDay, setPrevDay] = useState<HouseholdDay | null>(null);
  const [days, setDays] = useState<HouseDay[]>([]);
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const zoom = useChartZoomState();

  const range = useMemo(() => periodRange(period, offset, now), [period, offset, now]);
  const prev = useMemo(() => prevRange(range), [range]);
  const today = istDay(now);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    const back = Math.min(90, Math.round((Date.parse(`${today}T00:00:00+05:30`) - Date.parse(`${prev.start}T00:00:00+05:30`)) / 864e5) + 1);
    const jobs: Promise<unknown>[] = [
      apiService.getSiteEvents(siteId, back).then(r => live && setEvents(r.events)).catch(() => live && setEvents([])),
    ];
    if (period === 'today') {
      jobs.push(apiService.getHouseholdDay(siteId, range.end).then(r => live && setDay(r)));
      jobs.push(apiService.getHouseholdDay(siteId, prev.end).then(r => live && setPrevDay(r)));
    } else {
      jobs.push(apiService.getHouseholdDaily(siteId, prev.start, range.end).then(r => live && setDays(r.days)));
    }
    Promise.all(jobs).catch(e => live && setError(e instanceof Error ? e.message : 'History is unavailable'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [siteId, period, range.end, prev.start, prev.end, today]);

  // ── numbers ──
  const inRange = days.filter(d => d.date >= range.start && d.date <= range.end);
  const inPrev = days.filter(d => d.date >= prev.start && d.date <= prev.end);
  let cur: Totals, before: Totals | null;
  if (period === 'today') {
    const slots = day?.slots ?? [];
    const isToday = range.end === today;
    const lastMs = slots.length ? Date.parse(slots[slots.length - 1].ts) + 15 * 60_000 : 0;
    cur = totals([slotsToFlows(slots)]);
    // a running day compares with the same hours of the day before (spec decision)
    before = prevDay ? totals([slotsToFlows(prevDay.slots, isToday ? lastMs - 864e5 : Infinity)]) : null;
  } else {
    cur = totals(inRange);
    before = inPrev.length ? totals(inPrev) : null;
  }
  const hasBattery = period === 'today' ? (day?.slots ?? []).some(s => s.soc != null) : inRange.some(d => d.soc_max != null);
  const flagDays: HouseDay[] = period === 'today' ? [] : inRange;
  const { list: flags, checks } = buildFlags(flagDays, events, range, hasBattery, today);
  const flagged = new Set(flags.flatMap(f => f.dates));
  const label = period === 'today' ? (range.end === today ? 'Today' : `On ${fmtDay(range.end)}`) : `Over these ${range.len} days`;
  const empty = cur.counted === 0;

  // ── chart ──
  const chart = useMemo(() => {
    if (period === 'today') {
      const slots = day?.slots ?? [];
      const labels = slots.map(s => new Date(s.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }));
      const area = (label: string, key: 'from_solar_kw' | 'from_battery_kw' | 'from_grid_kw', c: string) =>
        ({ label, data: slots.map(s => s[key]), borderColor: c, backgroundColor: `${c}CC`, fill: true, stack: 'home', pointRadius: 0, borderWidth: 0, tension: 0, yAxisID: 'y' });
      const ds: any[] = [
        area('From solar', 'from_solar_kw', SOLAR), area('From battery', 'from_battery_kw', BATT), area('From grid', 'from_grid_kw', GRID),
        { label: 'Solar made', data: slots.map(s => s.pv_kw), borderColor: MADE, borderWidth: 2.5, fill: false, stack: 'pv', pointRadius: 0, tension: 0, yAxisID: 'y' },
        { label: 'Battery %', data: slots.map(s => s.soc), borderColor: BATT, borderDash: [6, 4], borderWidth: 2, fill: false, stack: 'soc', pointRadius: 0, tension: 0, yAxisID: 'soc' },
      ];
      if (detail) {
        ds.push({ label: 'Inverter output', data: slots.map(s => s.inv_out_kw), borderColor: '#f43f5e', borderDash: [4, 2], borderWidth: 1.5, fill: false, stack: 'inv', pointRadius: 0, yAxisID: 'y' });
        ds.push({ label: 'Inverter-side load', data: slots.map(s => s.inverter_kw), borderColor: '#8b5cf6', borderWidth: 1.5, fill: false, stack: 'invload', pointRadius: 0, yAxisID: 'y' });
      }
      return { labels, datasets: ds };
    }
    const ds = daysOf(range).map(d => inRange.find(x => x.date === d));
    const bar = (label: string, key: 'from_solar_kwh' | 'from_battery_kwh' | 'from_grid_kwh', c: string) =>
      ({ type: 'bar' as const, label, data: ds.map(r => r?.[key] ?? null), backgroundColor: ds.map(r => (r?.whole_home ? c : `${c}80`)), borderColor: c, stack: 'home' });
    return {
      labels: daysOf(range).map(fmtDay),
      datasets: [
        bar('From solar', 'from_solar_kwh', SOLAR), bar('From battery', 'from_battery_kwh', BATT), bar('From grid', 'from_grid_kwh', GRID),
        { type: 'line' as const, label: 'Solar made', data: ds.map(r => r?.pv_kwh ?? null), borderColor: MADE, backgroundColor: MADE, pointRadius: 5, borderWidth: 2, stack: 'pv' },
      ],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, day, days, detail, range.start, range.end]);

  const options = useMemo<ChartOptions<any>>(() => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (it: any) => ` ${it.dataset.label}: ${it.parsed.y == null ? '–' : Number(it.parsed.y).toFixed(2)} ${it.dataset.yAxisID === 'soc' ? '%' : period === 'today' ? 'kW' : 'kWh'}` } } },
    scales: {
      x: { stacked: true, ticks: { color: inkMuted(isDark), maxTicksLimit: 8, maxRotation: 0 }, grid: { display: false } },
      y: { stacked: true, beginAtZero: true, ticks: { color: inkMuted(isDark) }, title: { display: true, text: period === 'today' ? 'kW' : 'kWh', color: inkMuted(isDark) } },
      ...(period === 'today' ? { soc: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { color: inkMuted(isDark), callback: (v: any) => `${v}%` } } } : {}),
    },
  }), [isDark, period]);

  // ── render ──
  const card: React.CSSProperties = {
    background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.85)', borderRadius: 20, padding: '16px 20px',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,159,143,0.18)'}`, display: 'flex', flexDirection: 'column', gap: 12,
  };
  const h2: React.CSSProperties = { margin: 0, fontFamily: 'Rubik, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: ink(isDark) };
  const muted: React.CSSProperties = { margin: 0, fontFamily: 'Rubik, sans-serif', fontSize: '0.8125rem', color: 'var(--muted-foreground)' };
  const scope = cur.basis === 'inverter' ? 'Inverter circuits only'
    : cur.counted < cur.of ? `Whole home on ${cur.counted} of ${cur.of} days` : 'Whole home: inverter circuits + grid-direct circuits';
  const share = (v: number, of: number) => (of > 0 ? `${Math.round((v / of) * 100)}%` : '–');
  const cmp = (c: number | null, word: string) => (c == null ? '' : ` · ${signed(c)} vs ${word}`);
  const prevWord = period === 'today' ? 'the day before' : 'the period before';

  return (
    <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <Seg<Period> label="Period" value={period} isDark={isDark} onChange={p => { setPeriod(p); setOffset(0); setPicked(null); zoom.resetZoom(); }}
          options={[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']]} />
        <div role="group" aria-label="Step" style={segWrap(isDark)}>
          <button type="button" aria-label="Previous period" onClick={() => setOffset(o => o - 1)} style={segBtn(false, true, isDark)}>‹</button>
          <span style={{ ...segBtn(false, false, isDark), cursor: 'default' }}>{range.len === 1 ? fmtDay(range.end) : `${fmtDay(range.start)} – ${fmtDay(range.end)}`}</span>
          <button type="button" aria-label="Next period" disabled={offset >= 0} onClick={() => setOffset(o => Math.min(0, o + 1))}
            style={{ ...segBtn(false, false, isDark), opacity: offset >= 0 ? 0.4 : 1 }}>›</button>
        </div>
      </div>
      {error && <div role="alert" style={{ ...card, color: '#b91c1c' }}>History unavailable: {error}</div>}

      {/* 1. chart */}
      <section data-testid="history-chart" style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={h2}>{period === 'today' ? 'Through the day' : period === '7d' ? 'Day by day' : '30 days at a glance'}</h2>
            <p style={muted}>{empty ? 'No readings yet' : `${cur.ownPct ?? '–'}% own power · bought ${k1(cur.fromGrid)} kWh · exported ${k1(cur.exported)} kWh`}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {period === 'today' && view === 'chart' && (
              <div style={segWrap(isDark)}>
                <button type="button" aria-pressed={detail} onClick={() => setDetail(!detail)} style={segBtn(detail, true, isDark)}>Inverter detail</button>
              </div>
            )}
            {period !== '30d' && <Seg<'chart' | 'table'> label="View" value={view} isDark={isDark} onChange={setView} options={[['chart', 'Chart'], ['table', 'Table']]} />}
            <ZoomResetButton visible={zoom.isZoomed} onClick={zoom.resetZoom} />
          </div>
        </div>
        {loading && empty ? <p style={muted}>Loading history…</p>
          : day?.reason === 'older_than_90_days' && period === 'today' ? <p style={muted}>Detailed readings are kept for 90 days. Use 7 or 30 days to see this day's totals.</p>
          : period === '30d' ? (
            <HistoryCalendar days={inRange} range={range} flagged={flagged} isDark={isDark} metric={metric} onMetric={setMetric}
              picked={picked} onPick={setPicked}
              onOpen={d => { setPeriod('today'); setOffset(-Math.round((Date.parse(`${today}T00:00:00+05:30`) - Date.parse(`${d}T00:00:00+05:30`)) / 864e5)); }} />
          ) : view === 'table' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', minWidth: 520 }}>
                <thead><tr>{[period === 'today' ? 'Time' : 'Day', 'Solar made', 'Home', 'From solar', 'From battery', 'From grid'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid var(--border)' }}>{h}</th>)}</tr></thead>
                <tbody>{chart.labels.map((l: string, i: number) => (
                  <tr key={l + i}><td style={{ padding: 8 }}>{l}</td>
                    {[3, -1, 0, 1, 2].map(j => {
                      const v = j < 0 ? (chart.datasets.slice(0, 3).reduce((t: number, d: any) => t + (d.data[i] ?? 0), 0)) : chart.datasets[j].data[i];
                      return <td key={j} style={{ padding: 8, fontFamily: 'Fira Code, monospace' }}>{v == null ? '–' : Number(v).toFixed(2)}</td>;
                    })}</tr>))}</tbody>
              </table>
            </div>
          ) : (
            <div>
              <ChartLegend items={legendFrom(chart.datasets.map((d: any) => ({ ...d, fill: false, backgroundColor: d.borderColor })))} />
              <div style={{ height: 320 }}>
                {period === 'today'
                  ? <CJLine ref={zoom.chartRef} data={chart as any} options={options} />
                  : <CJBar ref={zoom.chartRef} data={chart as any} options={options} />}
              </div>
            </div>
          )}
      </section>

      {/* 2. anything wrong */}
      <section data-testid="history-flags" style={card}>
        <h2 style={h2}>Anything wrong?</h2>
        {flags.map(f => (
          <div key={f.kind + f.title} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${f.tone === 'amber' ? '#FDE68A' : 'var(--border)'}`, background: f.tone === 'amber' ? (isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB') : 'transparent' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: ink(isDark) }}>{f.title}</div>
            <div style={muted}>{f.detail}</div>
          </div>
        ))}
        {flags.length === 0 ? <p style={muted}>No problems found in {checks} checks.</p>
          : <p style={muted}>{checks - new Set(flags.map(f => f.kind)).size} other checks passed.</p>}
      </section>

      {/* 3. where energy went */}
      <section data-testid="history-where" style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={h2}>Where energy went</h2>
          <span style={muted}>{scope}</span>
        </div>
        {!empty && (
          <>
            <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.45, color: ink(isDark) }}>{sentence(cur, before, label)}</p>
            {[
              { title: `Solar made ${k1(cur.pv)} kWh`, sub: cmp(change(cur.pv, before?.pv ?? null), prevWord), parts: [
                [cur.fromSolar, SOLAR, `${k1(cur.fromSolar)} kWh to the home (${share(cur.fromSolar, cur.pv)})`],
                [cur.toBattery, BATT, `${k1(cur.toBattery)} kWh into the battery (${share(cur.toBattery, cur.pv)})`],
                [cur.exported, '#FCD9BF', `${k1(cur.exported)} kWh exported (${share(cur.exported, cur.pv)})`]] },
              { title: `Home used ${k1(cur.home)} kWh`, sub: cmp(change(cur.home, before?.home ?? null), prevWord), parts: [
                [cur.fromSolar, SOLAR, `${k1(cur.fromSolar)} kWh from solar (${share(cur.fromSolar, cur.home)})`],
                [cur.fromBattery, BATT, `${k1(cur.fromBattery)} kWh from the battery (${share(cur.fromBattery, cur.home)})`],
                [cur.fromGrid, GRID, `${k1(cur.fromGrid)} kWh from the grid (${share(cur.fromGrid, cur.home)})`]] },
            ].map(b => (
              <div key={b.title} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: ink(isDark) }}>{b.title}<span style={{ ...muted, display: 'inline' }}>{b.sub}</span></div>
                <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden', gap: 2 }} aria-hidden="true">
                  {b.parts.map(([v, c]) => <div key={String(c)} style={{ flex: Math.max(0, v as number), background: c as string }} />)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: '0.8125rem', color: ink(isDark) }}>
                  {b.parts.map(([, c, t]) => <span key={String(c)}>{t as string}</span>)}
                </div>
              </div>
            ))}
            <KpiRow>
              <KpiTile isDark={isDark} tone="orange" label="Own power" value={cur.ownPct ?? '–'} unit={cur.ownPct != null ? '%' : undefined}
                sub={before?.ownPct != null ? `${before.ownPct}% ${prevWord}` : undefined} />
              <KpiTile isDark={isDark} tone="blue" label="Bought from grid" value={k1(cur.fromGrid)} unit="kWh"
                sub={signed(change(cur.fromGrid, before?.fromGrid ?? null)) ? `${signed(change(cur.fromGrid, before?.fromGrid ?? null))} vs ${prevWord}` : undefined} />
              <KpiTile isDark={isDark} label="Exported" value={k1(cur.exported)} unit="kWh" />
              <KpiTile isDark={isDark} tone="teal" label="Battery" value={k1(cur.fromBattery)} unit="kWh used" sub={`${k1(cur.toBattery)} kWh stored`} />
            </KpiRow>
          </>
        )}
      </section>
    </motion.div>
  );
};

export default HistoryTab;
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx jest src/shared/components/SiteDataPanel/tabs/HistoryTab.test.tsx`
Expected: 8 passed.

If U3's tile-name regex misses, print `screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))` and align the regex with `fmtDay`'s en-IN output. Keep the aria-label format `"<fmtDay>: <value>"`.

- [ ] **Step 5: Checkpoint.**
  - Changed: `HistoryTab.tsx`, `HistoryTab.test.tsx`.
  - Update U1–U8 to `passing`.

### Task 10b: Pick dates, weekly bars, balance note

**Files:**
- Modify: `tabs/historyModel.ts`, `tabs/historyModel.test.ts`
- Modify: `tabs/HistoryTab.tsx`, `tabs/HistoryTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `historyModel.test.ts`. Also add `customRange, weeks, unbalanced` to its import.

```ts
it('M9 custom range, weekly rows, balance check', () => {
  const r = customRange('2026-08-22', '2026-11-19', 0);
  expect(r.len).toBe(90);
  expect(customRange('2026-08-22', '2026-11-19', -1)).toEqual({ start: '2026-05-24', end: '2026-08-21', len: 90 });
  const days = daysOf(r).map(d => day(d));
  const w = weeks(days, r);
  expect(w).toHaveLength(13);
  expect([w[0].date, w[0].home_kwh, w[12].home_kwh]).toEqual(['2026-08-22', 210, 180]); // 7 days, then the last 6
  expect(unbalanced(totals([day('a')]))).toBe(false);
  expect(unbalanced(totals([day('a', { pv_kwh: 40 })]))).toBe(true);
});
```

Also add `daysOf` to that import.

Append to `HistoryTab.test.tsx`:

```tsx
it('U9 pick dates over 60 days gives weekly bars', async () => {
  setup();
  click('Pick dates');
  await screen.findByTestId('bars');
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-22' } });
  await waitFor(() => expect(mockChart.props.data.labels).toHaveLength(13));
  expect(mockChart.props.data.labels[0]).toMatch(/^Week of /);
});

it('U10 balance note', async () => {
  getDay.mockImplementation((_s: string, date: string) => Promise.resolve({
    date, parts: ['grid_board', 'inverter'], whole_home: true, note: null, slots: [{ ...slot(`${date}T00:00:00Z`), pv_kw: 6 }],
  }));
  setup();
  await screen.findByTestId('chart');
  expect(screen.getByTestId('history-where')).toHaveTextContent("Figures don't fully balance");
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest src/shared/components/SiteDataPanel/tabs/history`
Expected: M9 fails on the missing exports; U9 fails because "Pick dates" is not found; U10 fails because the note is missing.

- [ ] **Step 3: Model.** In `historyModel.ts`:

Change the period types:

```ts
export type Period = 'today' | '7d' | '30d' | 'custom';
export const LEN: Record<Exclude<Period, 'custom'>, number> = { today: 1, '7d': 7, '30d': 30 };
```

Change `periodRange`'s signature to `periodRange(p: Exclude<Period, 'custom'>, offset: number, nowMs: number)`.

Append:

```ts
/** "Pick dates": the chosen span, stepped by its own length. */
export function customRange(start: string, end: string, offset: number): Range {
  const len = Math.round((dayStartMs(end) - dayStartMs(start)) / DAY_MS) + 1;
  return { start: addDays(start, offset * len), end: addDays(end, offset * len), len };
}

const SUM_KEYS = ['pv_kwh', 'home_kwh', 'from_solar_kwh', 'from_battery_kwh', 'from_grid_kwh', 'solar_to_battery_kwh', 'exported_kwh'] as const;

/** Week rows (7-day chunks from the range start) for ranges over 60 days. A week is whole only if every day is. */
export function weeks(days: HouseDay[], r: Range): HouseDay[] {
  const out: HouseDay[] = [];
  for (let i = 0; i < r.len; i += 7) {
    const a = addDays(r.start, i), b = addDays(r.start, Math.min(i + 6, r.len - 1));
    const chunk = days.filter(d => d.date >= a && d.date <= b);
    const row = {
      date: a, source: '5min', whole_home: chunk.length > 0 && chunk.every(d => d.whole_home),
      coverage: chunk.length ? Math.min(...chunk.map(d => d.coverage ?? 1)) : null, soc_min: null, soc_max: null,
    } as HouseDay;
    for (const k of SUM_KEYS) {
      (row as any)[k] = chunk.some(d => d[k] != null) ? +chunk.reduce((t, d) => t + n0(d[k]), 0).toFixed(3) : null;
    }
    out.push(row);
  }
  return out;
}

/** Spec: if solar made and its three destinations differ by more than 5%, say so; never force a balance. */
export const balanceGap = (t: Totals) => t.pv - t.fromSolar - t.toBattery - t.exported;
export const unbalanced = (t: Totals) => t.pv > 0 && Math.abs(balanceGap(t)) > 0.05 * t.pv;
```

- [ ] **Step 4: Tab.** Make these edits to `HistoryTab.tsx`, from the Task 10 code.

**a. Imports.** Extend the model import with `balanceGap, customRange, unbalanced, weeks`.

**b. State.** After `const now = nowMs ?? Date.now();`, add the picked span. It defaults to the last 30 days.

```tsx
  const [pick, setPick] = useState(() => { const r = periodRange('30d', 0, now); return { start: r.start, end: r.end }; });
```

**c. Range.** Replace the `range` memo:

```tsx
  const range = useMemo(() => (period === 'custom' ? customRange(pick.start, pick.end, offset) : periodRange(period, offset, now)),
    [period, offset, now, pick.start, pick.end]);
```

**d. Daily fetch.** Replace the line `jobs.push(apiService.getHouseholdDaily(siteId, prev.start, range.end)...` with the following. The route caps at 400 days, so a long span skips the comparison.

```tsx
      const from = range.len * 2 <= 400 ? prev.start : range.start;
      jobs.push(apiService.getHouseholdDaily(siteId, from, range.end).then(r => live && setDays(r.days)));
```

Then add `range.start` to that effect's dependency list.

**e. Period options.** Use:

```tsx
          options={[['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['custom', 'Pick dates']]} />
```

**f. Date inputs.** Put these right after the toolbar `</div>` and before the `{error && ...}` line:

```tsx
      {period === 'custom' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {([['From', 'start'], ['To', 'end']] as const).map(([lab, key]) => (
            <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: ink(isDark) }}>{lab}
              <input type="date" value={pick[key]}
                min={key === 'start' ? addDays(pick.end, -399) : pick.start} max={key === 'start' ? pick.end : today}
                onChange={e => { const v = e.target.value; if (v) { setPick(p => ({ ...p, [key]: v })); setOffset(0); } }}
                style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', background: 'transparent', color: 'inherit', font: 'inherit' }} />
            </label>
          ))}
        </div>
      )}
```

Also add `addDays` to the model import.

**g. Bars.** In the chart memo's non-today branch, replace

```tsx
    const ds = daysOf(range).map(d => inRange.find(x => x.date === d));
```

with

```tsx
    const weekly = range.len > 60;
    const ds = weekly ? weeks(inRange, range) : daysOf(range).map(d => inRange.find(x => x.date === d));
```

and replace `labels: daysOf(range).map(fmtDay),` with:

```tsx
      labels: weekly ? ds.map(r => `Week of ${fmtDay(r!.date)}`) : daysOf(range).map(fmtDay),
```

**h. Chart title.** Replace the `<h2>` text expression:

```tsx
            <h2 style={h2}>{period === 'today' ? 'Through the day' : period === '30d' ? '30 days at a glance' : range.len > 60 ? 'Week by week' : 'Day by day'}</h2>
```

**i. Balance note.** Put this right after the sentence `<p>` in "Where energy went":

```tsx
            {unbalanced(cur) && (
              <p style={muted} title="Solar made minus (to the home + into the battery + exported)">
                Figures don't fully balance: solar made and where it went differ by {k1(Math.abs(balanceGap(cur)))} kWh.
              </p>
            )}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npx jest src/shared/components/SiteDataPanel/tabs/history`
Expected: model 9 passed, tab 10 passed.

In U10, the note is computed from the slots: pv 6 × 0.25 = 1.5 kWh against 0.5 + 0.25 + 0.25 = 1.0, so the gap is above 5%.

- [ ] **Step 6: Checkpoint.**
  - Changed: the four files.
  - Update M9, U9 and U10 to `passing`.

### Task 11: Panel cleanup (`index.tsx`)

**Files:**
- Modify: `src/shared/components/SiteDataPanel/index.tsx`
- Modify: `src/shared/components/SiteDataPanel/types.tsx` (drop `HistorySeriesKey` if unused)

- [ ] **Step 1: Replace the History render block**

Find `{activeTab === 'history' && (` followed by `<HistoryTab ... />`. Replace it with:

```tsx
            {activeTab === 'history' && (
              <HistoryTab key="history" siteId={siteId} isDark={isDark} />
            )}
```

- [ ] **Step 2: Remove the header date picker**

In `headerControls`, delete the whole `{activeTab === 'history' && (<> <select value={dateRange} ...> ... </>)}` block: the select plus the two custom date inputs.

- [ ] **Step 3: Delete the History-only state and memos.** Keep `dateRange` and `fetchHistory`: `telemetry` still feeds `latest`, today's kWh and `noData`.

Delete:
- `showHistorySeries` state
- `historyView` state
- `historyZoom` and `historyChartOptions`
- `historyData`, `historyStatsVisible`, `historyResolutionLabel`
- the `HISTORY_SERIES` import
- `historyZoom.resetZoom()` (line ~608)
- the `HistorySeriesKey` import

Then run `npx tsc --noEmit -p . 2>&1 | grep SiteDataPanel` and remove whatever is reported as unused or missing. Do not touch `WeatherTab.tsx`'s existing error.

Then update the mock in `index.test.tsx` line 13. Change:

```ts
jest.mock('./tabs/HistoryTab', () => ({ __esModule: true, default: () => null, HISTORY_SERIES: [] }));
```

to:

```ts
jest.mock('./tabs/HistoryTab', () => ({ __esModule: true, default: () => null }));
```

- [ ] **Step 4: Run all panel tests and the build**

```bash
npx jest src/shared/components/SiteDataPanel
npx tsc --noEmit -p . 2>&1 | grep -E "SiteDataPanel|services/api" | grep -v WeatherTab
npx vite build 2>&1 | tail -3
```

Expected:
- all suites pass
- no type errors except the pre-existing `WeatherTab.tsx(208)` one
- the build ends with only the chunk-size warning

- [ ] **Step 5: Checkpoint.** Changed: `index.tsx`, `index.test.tsx`, `types.tsx`.

### Task 12: Docs

**Files:**
- Modify: `smart-solar-react-frontend/CLAUDE.md` (Notable components list)
- Modify: `smart-solar-django-backend/CLAUDE.md` (the "Devices with no site" paragraph's neighbourhood: one line on the household routes)

- [ ] **Step 1: Frontend CLAUDE.md.** Add after the `LoadCard.tsx` bullet:

```markdown
- `SiteDataPanel/tabs/HistoryTab.tsx` (+ pure `historyModel.ts`, `HistoryCalendar.tsx`) — the History tab (2026-11-19): Today / 7 days / 30 days (calendar) with ‹ ›, chart first, then "Anything wrong?" (incidents, missing readings, battery barely used), then "Where energy went" (sentence, two split bars, four tiles, change vs the previous period). Whole home = inverter + grid board + EV from `GET /sites/<id>/household/day|daily/`; periods mixing days count only whole-home days ("Whole home on N of M days"). Spec `docs/superpowers/specs/2026-11-19-history-tab-redesign-design.md`, scenarios `docs/test-scenarios/history-tab-redesign.md`
```

- [ ] **Step 2: Backend CLAUDE.md.** Add one sentence at the end of the "Devices with no site" paragraph:

```markdown
The site History tab reads `GET /sites/<id>/household/day/?date=` (15-min whole-home slots, last 90 days) and `/household/daily/?start=&end=` (≤400 days; days past 90 from `site_daily_energy`) from `api/services/household_history.py`: home use by solar / battery / grid with the meter as |W| per phase (F-051), `HOUSE_WHOLE_FROM` per site; scenarios `docs/test-scenarios/household-history.md`.
```

- [ ] **Step 3: Final checkpoint.** List every changed file in both repos with `git status --short` in each, and report test counts. Do not commit.

---

## After the build (owner steps, not part of execution)

- **Deploy.** The owner deploys the backend (SSM: `sudo -u ubuntu -H git pull`, then `docker compose up -d --build web`) and pushes the frontend.
- **Live checks.** Run L1–L5 (frontend) and L1–L2 (backend).
- **Daily table fix (owner OK needed).** If the stored daily meter total turns out to be net, fix the `em` CTE in `api/tasks/maintenance_tasks.py` (~line 2683) to the |W| per-phase rule and backfill `site_daily_energy`. This is a prod data change and waits for the owner's OK. Until then, days older than 90 days use the stored figure (`source: daily_table`).
