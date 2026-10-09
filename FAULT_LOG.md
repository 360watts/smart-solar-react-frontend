# Production Fault Log — smart-solar-react-frontend

Faults specific to the React dashboard UI.

---

## Index

| # | Title | Severity | Status |
|---|-------|----------|--------|
| [F-001-UI](#f-001-ui) | RS-485 freeze — missing staleness UI indicators | High | Fixed |
| [F-002-UI](#f-002-ui) | Auto-reboot toggle missing from device settings | Medium | Fixed |
| [F-003-UI](#f-003-ui) | `import.meta.env` TypeScript error — `vite/client` types missing from tsconfig | Low | Fixed |
| [F-004-UI](#f-004-ui) | Local dev hitting Railway cold-start — `.env.local` not present | Medium | Fixed |
| [F-005-UI](#f-005-ui) | `refreshToken()` linter rewrite — always returns `true` on failure | High | Fixed |
| [F-006-UI](#f-006-ui) | Site-hardware `⋯` menu items clipped by card `overflow: hidden` — "Disconnect" invisible | High | Fixed |
| [F-007-UI](#f-007-ui) | "Add grid" circuit-line button always 400s — backend rejects `grid_direct` | Medium | Fixed |
| [F-008-UI](#f-008-ui) | Dev-only: every write 401s after a page reload — in-memory CSRF token lost | Medium | Mitigated |
| [F-009-UI](#f-009-ui) | Drag/wheel zoom silently does nothing on Solar, Load, Weather tabs & staff Analytics charts | Medium | Fixed |

---

## F-001-UI

### RS-485 Freeze — Missing Staleness UI Indicators

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-03-23 |
| **Severity** | High |
| **Status** | Fixed 2026-03-23 |

#### Symptom
Dashboard showed frozen PV/inverter readings with no visual warning. Users had no way to know data was stale vs genuinely low production.

#### Root Cause
Backend (see [smart-solar-django-backend F-001](https://github.com/360watts/smart-solar-django-backend/wiki/Production-Fault-Log#f-001)) detects RS-485 freeze and sets `data_stale=True` / `data_source` in API responses. Frontend was not consuming these fields.

#### Fix Applied
`src/components/SiteDataPanel.tsx`:
- **Amber banner + STALE badge** on KPI cards when `data_stale === true` and `data_source === 'rs485'`
- **Green "Live via Deye Cloud" banner** when `data_source === 'deye_cloud'`; STALE badges suppressed
- `src/components/Devices.tsx`: logger serial config form — allows ops to configure `logger_serial` per site so the backend can route Deye Cloud fallback correctly

#### References
- `src/components/SiteDataPanel.tsx`
- `src/components/Devices.tsx`

---

## F-002-UI

### Auto-Reboot Toggle Missing from Device Settings

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-04-04 |
| **Severity** | Medium |
| **Status** | Fixed 2026-04-04 |

#### Symptom
Backend added `auto_reboot_enabled` field to Device model (migration 0042) allowing per-device toggle of RS-485 freeze auto-reboot. No UI control existed — the setting could only be changed via raw API calls.

#### Fix Applied
- Added `auto_reboot_enabled?: boolean` to `Device` interface in `Devices.tsx`
- Added `handleToggleAutoReboot()` handler — calls `PATCH /api/devices/<id>/` with `{ auto_reboot_enabled: bool }`, optimistically updates local state, refreshes device list
- Added checkbox toggle in device detail panel below the existing "Enable Device Logs" toggle
- Added `patchDevice(deviceId, data)` generic PATCH method to `src/services/api.ts`

#### References
- `src/components/Devices.tsx` — `handleToggleAutoReboot`, device detail panel
- `src/services/api.ts` — `patchDevice()`
- Backend: `api/models.py` `Device.auto_reboot_enabled`, migration `0042`

---

## F-003-UI

### `import.meta.env` TypeScript Error — `vite/client` Types Missing from tsconfig

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-04-04 |
| **Severity** | Low |
| **Status** | Fixed 2026-04-04 |

#### Symptom
TypeScript reports: `Property 'env' does not exist on type 'ImportMeta'` on `import.meta.env.VITE_API_BASE_URL` in `api.ts`.

#### Root Cause
`tsconfig.json` was configured with `"lib": ["dom", "dom.iterable", "es6"]` — targeting CRA-style compilation. The project uses Vite, but Vite's client type declarations (which extend `ImportMeta` with the `env` property) were never added to `compilerOptions.types`.

#### Fix Applied
Added `"types": ["vite/client"]` and upgraded lib to `"es2018"` (required for `Promise.finally`) in `tsconfig.json`:

```json
"lib": ["dom", "dom.iterable", "es2018"],
"types": ["vite/client"]
```

#### References
- `tsconfig.json`

---

## F-004-UI

### Local Dev Hitting Railway Cold-Start — `.env.local` Not Present

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-04-04 |
| **Severity** | Medium |
| **Status** | Fixed 2026-04-04 |

#### Symptom
Local dev server (`npm run dev`) shows `AbortError: Server is warming up — please try again in a moment` on `fetchUsers` and `fetchPresets` immediately on page load.

#### Root Cause
`.env` sets `VITE_API_BASE_URL` to the Railway production URL. No `.env.local` existed to override it for local development. All API requests hit Railway directly (no Vite proxy), triggering Railway cold-start delays that exceeded the 40-second client-side abort timeout.

The root trigger was a subagent change that updated the fallback URL in `api.ts` from the Vercel URL (always warm) to the Railway URL (subject to cold starts).

#### Fix Applied
Created `.env.local` (gitignored by default):
```
VITE_API_BASE_URL=/api
VITE_DEV_PROXY_TARGET=https://smart-solar-django-backend-production.up.railway.app
```

With `VITE_API_BASE_URL=/api`, requests go through the Vite dev proxy which forwards to Railway — bypassing the client-side 40-second abort timeout entirely.

#### References
- `.env.local` (created)
- `vite.config.js` — proxy configuration

---

## F-005-UI

### `refreshToken()` Linter Rewrite — Always Returns `true` on Failure

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-04-04 |
| **Severity** | High |
| **Status** | Fixed 2026-04-04 |

#### Symptom
A linter auto-fix rewrote the `refreshToken()` singleton pattern in `api.ts`, breaking the token refresh return value. A failed token refresh would be reported as successful, preventing automatic logout on expired tokens.

#### Root Cause
The linter replaced `.finally()` with a `.then().catch().then()` chain:

```ts
// BROKEN (linter rewrite):
this.refreshTokenPromise = this._doRefreshToken()
  .then(() => true)
  .catch(() => false)
  .then(() => {          // ← always returns true, ignores false from catch
    this.refreshTokenPromise = null;
    return true;
  });
```

The final `.then(() => { return true; })` discards the `false` produced by `.catch(() => false)` — so every token refresh failure is misreported as success, and the logout path (`if (!refreshSuccess) → redirect to /login`) never fires.

#### Fix Applied
Reverted to `.finally()` which correctly passes through the original resolved/rejected value:

```ts
this.refreshTokenPromise = this._doRefreshToken().finally(() => {
  this.refreshTokenPromise = null;
});
return this.refreshTokenPromise!;
```

The `!` non-null assertion is safe — `refreshTokenPromise` is assigned one line above and cannot be null at the return point.

#### References
- `src/services/api.ts` — `refreshToken()`

---

## F-006-UI

### Site-Hardware `⋯` Menu Items Clipped by Card `overflow: hidden` — "Disconnect" Invisible

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-09-08 |
| **Severity** | High |
| **Status** | Fixed 2026-09-08 |

#### Symptom
On SiteDetail → **Inverter & monitoring**, the monitor / meter row's `⋯` menu
showed only "Move to another site" — the **"Disconnect"** action (detach device
from site) was not visible. Reported as "there is only a move option".

#### Root Cause
`Item`'s dropdown (`siteHardware/ui.tsx`) was `position: absolute` inside
`SetupCard`, whose `<section>` sets `overflow: hidden` for its `borderRadius: 18`
corners. The monitor row is the last element in the card, so the menu opened
into the ~30 px of padding below it and the rest was clipped by the ancestor —
"Move" (item 1) rendered in the visible strip, "Disconnect" (item 2) fell
entirely inside the clipped region. Menu doesn't scroll; nothing surfaced.

#### Fix Applied
Rebuilt the menu in `siteHardware/ui.tsx` as `OverflowMenu`:
- Renders into a **portal on `document.body`**, positioned from the trigger's
  `getBoundingClientRect()` — no ancestor can clip it.
- Flips above the trigger when it would run past the viewport bottom.
- Repositions on scroll/resize; closes on outside `pointerdown`, `Escape`
  (returns focus to trigger), `Tab`.
- Arrow-key roving focus, `Home`/`End`, `role="menu"` / `menuitem`.
- Per-action optional `hint` second line; destructive actions grouped below a
  divider. Reveal springs from the trigger corner, `prefers-reduced-motion` aware.

#### References
- `src/features/staff/siteHardware/ui.tsx` — `OverflowMenu`, `Item`
- `src/features/staff/InverterMeasurementConfig.tsx` — monitor / meter menus (now
  carry `hint` copy clarifying detach ≠ delete)

---

## F-007-UI

### "Add Grid" Circuit-Line Button Always 400s — Backend Rejects `grid_direct`

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-09-08 |
| **Severity** | Medium |
| **Status** | Fixed 2026-09-08 |

#### Symptom
Circuits card → "Add grid" → Add → **"Validation failed"** / "Couldn't save that
circuit". Every attempt. `POST /api/sites/<id>/circuit-lines/` → 400.

#### Root Cause
"Add grid" seeded the composer with `circuit: 'grid_direct'`. The backend
`SiteCircuitLineSerializer.validate_circuit` (`api/serializers.py`) **explicitly
rejects `grid_direct` and `inverter_backup`** — those buses are implicit in the
inverter/gateway hardware and must not be declared as a `SiteCircuitLine`. The
only value the serializer accepts is `ev_line`, so the button could never succeed.

#### Fix Applied
`src/features/staff/InverterMeasurementConfig.tsx`:
- Removed the "Add grid" quick-action; corrected the card `purpose` copy
  (grid / backup are covered by hardware, not declarable).
- Pinned `saveCircuitLine`'s payload to `circuit: 'ev_line'` so no form path can
  POST an invalid choice.

#### References
- `src/features/staff/InverterMeasurementConfig.tsx` — `saveCircuitLine`, Circuits card
- Backend: `api/serializers.py` `SiteCircuitLineSerializer.validate_circuit`

---

## F-008-UI

### Dev-Only: Every Write 401s After a Page Reload — In-Memory CSRF Token Lost

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-09-08 |
| **Severity** | Medium (local dev only) |
| **Status** | Mitigated 2026-09-08 (workaround); durable fix proposed |

#### Symptom
In local dev (Vite proxy → backend), reads work but **every** write —
`detach`, `circuit-lines`, etc. — returns `401 Unauthorized`. Backend logs show
`Unauthorized: /api/sites/.../circuit-lines/` and a benign
`_verify_cron_secret … got='(empty)'` on `/profile/`.

#### Root Cause
`CookieJWTAuthentication` (`api/cookie_auth.py`) enforces a double-submit CSRF
check on unsafe methods: the `csrf_token` **cookie** must equal the `X-CSRFToken`
**header**, else the request falls back to anonymous → the endpoint's permission
check returns 401 (not 403). The header value is `inMemoryCsrfToken` in
`src/services/api.ts` — **held in memory only** (captured from the login response
body), wiped on every page reload while the httpOnly `access_token` cookie
survives. Post-reload: reads keep working, writes 401 until re-login. The
auto-refresh in `request()` re-captures the token, so a single 401 should
self-heal — if it doesn't, the `refresh_token` cookie is also expired.

#### Fix Applied / Workaround
Workaround: **log out and back in** on the dev tab. Proposed durable fix (local
dev is same-origin through the proxy, so the `httponly=False` `csrf_token` cookie
is readable): have `getCsrfToken()` fall back to `document.cookie` when the
in-memory copy is empty — no-op in production (cross-origin, unreadable).

#### References
- `src/services/api.ts` — `inMemoryCsrfToken`, `getCsrfToken()`, `getAuthHeaders()`
- Backend: `api/cookie_auth.py` `CookieJWTAuthentication.authenticate`

---

## F-009-UI

### Drag/Wheel Zoom Silently Does Nothing on Solar, Load, Weather Tabs & Staff Analytics Charts

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-09-28 |
| **Severity** | Medium |
| **Status** | Fixed 2026-09-28 |

#### Symptom
In `SiteDataPanel`, drag-to-zoom and wheel-zoom worked on the History tab but
did nothing on the Solar and Load tabs (no selection rectangle, no console
error, tooltip/hover still worked normally). Same silent failure on the
Weather tab and the staff Analytics dashboard charts, though those weren't
reported until this was traced.

#### Root Cause
`createDragZoomPlugins()` (`src/shared/components/SiteDataPanel/chartUtils.ts`)
returned `{ zoom: { zoom: {wheel, drag, pinch, mode, onZoomComplete}, pan: {...} } }`
— i.e. it already included the outer `zoom:` key meant to sit directly under
`options.plugins`. Every one of its 16 call sites (across `ForecastTab.tsx`,
`PhaseLoadTab.tsx`, `WeatherTab.tsx`, and the staff Analytics `shared.tsx`)
used it as `plugins: { ..., zoom: createDragZoomPlugins(cb) }`, which wrapped
it in *another* `zoom:` key — producing `plugins.zoom.zoom.zoom.*` (three
levels deep) instead of the `plugins.zoom.zoom.*` that `chartjs-plugin-zoom`
actually reads. `plugins.zoom.zoom` therefore resolved to `{zoom: {...}, pan:
{...}}` with no `wheel`/`drag`/`pinch`/`mode` at the level the plugin expects,
so it found nothing to enable and did nothing — a shape mismatch, not a
crash, hence no console error.

The History tab (`SiteDataPanel/index.tsx`) and `EnergyFlow/NodeDetailModal.tsx`
never used this helper — they wrote the zoom config inline at the correct
nesting depth — which is why they worked and the others didn't.

A misdiagnosis en route: a real but unrelated bug was found and fixed first —
`PhaseLoadTab.tsx`'s `phaseLoadChartOptions` `useMemo` had `resolvedLoadChartData`
(a live-polling value) in its deps, rebuilding the whole options object (and
therefore the zoom plugin config) on every ~30s telemetry poll. That's a real
options-identity-churn bug worth having fixed (same class as a prior fix in
`NodeDetailModal.tsx`), but it wasn't the cause of this symptom — deploying it
alone did not restore zoom, which is what led to finding the actual double-
nesting bug above.

#### Fix Applied
- `chartUtils.ts`: `createDragZoomPlugins()` now returns `{ zoom: {...}, pan:
  {...} }` directly (no extra wrapping `zoom:` key), matching how every caller
  assigns it (`plugins: { zoom: createDragZoomPlugins(cb) }`). One-line fix in
  the shared helper corrects all 16 call sites at once.
- `PhaseLoadTab.tsx`: `resolvedLoadChartData` moved to a ref
  (`resolvedLoadChartDataRef`) read inside the tooltip callback instead of
  being a `useMemo` dependency, so `phaseLoadChartOptions` no longer rebuilds
  on every telemetry poll. Kept as a legitimate fix even though it wasn't the
  root cause of this particular symptom.

#### References
- `src/shared/components/SiteDataPanel/chartUtils.ts` — `createDragZoomPlugins`
- `src/shared/components/SiteDataPanel/tabs/PhaseLoadTab.tsx`
- `src/shared/components/SiteDataPanel/tabs/ForecastTab.tsx`
- `src/shared/components/SiteDataPanel/tabs/WeatherTab.tsx`
- `src/features/staff/Analytics/sections/shared.tsx`
- `src/shared/components/SiteDataPanel/index.tsx` (unaffected — inlines config correctly)
- `src/shared/components/EnergyFlow/NodeDetailModal.tsx` (unaffected — inlines config correctly)

---

## F-010-UI

### Chart Canvas Shifts/Shrinks on Zoom (Energy Meter "Power (24h)" and Other `ZoomResetButton` Charts)

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-10-05 |
| **Severity** | Low |
| **Status** | Fixed 2026-10-05 |

#### Symptom
Dragging to zoom on `EnergyMeterDashboard`'s "Power (24h)" chart (and other charts using the same inline reset-button pattern) shifted and compressed the canvas downward the moment the zoom completed.

#### Root Cause
`ZoomResetButton` (`chartUtils.ts`) returned `null` when not zoomed, so its row only existed in the DOM once zoomed. That row sits inside `ChartCard`'s fixed-height content box, directly above the canvas — its sudden appearance shrank and shifted the canvas down. (A first-pass fix that always reserved the row's height instead overcorrected: the chart was then permanently shorter, even unzoomed, since the fixed-height box now always gave up space to the button row.)

#### Fix Applied
- `ZoomResetButton` gained an `overlay?: boolean` prop. When set, the button is `position: absolute` (zero layout footprint) instead of occupying a row — used only where the button sits directly above a chart canvas (`EnergyMeterDashboard`). Left as a normal inline button elsewhere (e.g. `HistoryTab.tsx`'s toolbar row, where it sits alongside other buttons in real flow and isn't the cause of any shift).
- `EnergyMeterDashboard/index.tsx`: removed the wrapping flex row; the button now renders as a direct sibling of the canvas inside `ChartCard`'s already-`position: relative` content box.

#### Residual
- `ForecastTab.tsx`'s kt chart (~line 508) has the identical inline-row-above-canvas pattern and the same latent bug — not reported, not fixed in this pass.
- Not committed/deployed.

---

## F-011-UI

### Commissioning Wizard "Cancel" Leaves Orphaned Draft Sites Forever

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-10-05 (found via a stale `SS-00001` DB row: `created_at` == `updated_at`, never touched again) |
| **Severity** | Low: no data-loss or user-facing breakage, but a real data-hygiene bug — every abandoned wizard leaves a permanent `draft` row. |
| **Status** | Fixed 2026-10-05, not committed/deployed. |

#### Symptom
A user reported sites they'd "deleted" were still in the DB with `site_status='draft'`.

#### Root Cause
`CommissioningWizard.tsx`'s Cancel button was a plain `<Link to="/sites">` — it only navigated away, never called the delete/archive endpoint. Step 1 (`site_staff_create`) already writes the draft `SolarSite` row to the DB immediately, before any later step runs. Any wizard abandoned at step 2+ via Cancel leaves that draft permanently orphaned — `site_status` stuck at `draft`, `updated_at` frozen at creation time.

#### Fix Applied
- Cancel now calls `requestCancel()`: if a draft was created (`createdSiteId` set) and commissioning hasn't completed (`step < 4`), it opens the house-style `ConfirmDialog` ("Discard this draft site?") instead of navigating immediately.
- Confirming calls `apiService.deleteSite(createdSiteId)` — the same soft-delete the Sites list already uses (`DELETE /sites/<id>/`, sets `site_status='archived'`, recoverable) — then navigates to `/sites`.
- Step 1 (nothing created yet) or step 4 (already complete) still navigate immediately with no prompt.
- On delete failure, the error shows inline in the dialog and the wizard stays open instead of silently navigating away while the draft might still exist.
- Test-scenario doc added: `docs/test-scenarios/commissioning-wizard-cancel-cleanup.md`.

#### Residual
- Existing orphaned drafts (e.g. `SS-00001`) are not cleaned up by this fix — it only prevents new ones going forward.
- Not committed/deployed.

## F-012-UI

### Commissioning Wizard's "Logger Serial" Field Silently Discarded Whatever Was Typed In

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-10-05 |
| **Severity** | Low: no error shown, but the field has complete false affordance — anything typed in vanishes. |
| **Status** | Fixed 2026-10-05 (wizard side), not committed/deployed. Related `SiteDetail.tsx` dead-end also fixed same day. |

#### Symptom
Staff reported the Logger Serial field in the Commissioning Wizard "doesn't save."

#### Root Cause
Three stacked issues, found while tracing the full flow:
1. `CommissioningWizard.tsx` step 1 had a field labeled "Logger Serial" (`dataLoggerSerial`) that was parsed into a local variable and then never included in any API payload — no `Inverter` record exists yet at that point in the wizard for it to attach to.
2. A stale code comment blamed the wrong model ("logger_serial is now set on Device, not Site") — migration `0107_remove_logger_serial_from_device.py` actually moved it to `Inverter`, not `Device`.
3. The real, current Logger Serial editor (`SiteDetail.tsx`'s Deye Settings panel) requires an existing active `Inverter` to attach to, and throws `"No active inverter on this site — add one on the Equipment tab before setting Logger Serial"` otherwise. Since nothing in the Commissioning Wizard ever creates an `Inverter`, this throws on the very first save attempt for any freshly-commissioned site.

#### Fix Applied
- Removed the dead field from the wizard; added a one-line note under the (correctly-saving) Deye Station ID field pointing to where Logger Serial actually gets set.
- Corrected the stale comment.
- Closed two unrelated pre-existing type-safety gaps found in the same file while editing (`geyserType`/`evType` typed as plain `string` against a stricter API contract — narrowed to match their `<select>` options).
- `SiteDetail.tsx`: per the user's explicit choice between two fix options, implemented the inline-create path — when saving Logger Serial fails because no `Inverter` exists, an inline mini-form (Make / Serial Number / Capacity kVA — the model's actual required fields) appears in the same card, and submitting it creates the `Inverter` with `logger_serial` set in one request instead of erroring out.

#### Residual
- Not committed/deployed.
- Not visually verified in a browser.

---

## Severity / Status Definitions

| Level | Meaning |
|-------|---------|
| **Critical** | Data integrity or safety breach |
| **High** | Core functionality broken; significant user impact |
| **Medium** | Degraded feature; workaround exists |
| **Low** | Minor inaccuracy; low operational impact |

| Status | Meaning |
|--------|---------|
| **Fixed** | Root cause resolved and deployed |
| **Mitigated** | Workaround in place; root fix pending |
| **Open** | Known issue, fix not yet implemented |


## F-013-UI

### Legacy global CSS overrode Tailwind: unlayered `* {margin:0; padding:0}` and a global `.grid` rule broke the new Sites and setup pages

| Field | Detail |
|-------|--------|
| **Date discovered** | 2026-10-09 (user screenshot of the redesigned Sites page) |
| **Severity** | Low/Medium: no data impact; new Tailwind-styled pages rendered without padding and with the wrong grid columns, overlapping the old design. Likely also affects older files that use Tailwind classes. |
| **Status** | Fixed for the two new pages and the reset (committed `146b8eb`). Wider cleanup open. |

#### Root Cause
- `index.css` had `* { margin: 0; padding: 0; box-sizing: border-box }` outside any layer. In Tailwind v4 utilities live in a layer, and unlayered CSS beats layered CSS regardless of specificity, so every `p-*`/`m-*` class was ignored.
- `App.css` defines `.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin: 24px 0 }` three times (lines near 280, 966, 1191). It shares a class name with Tailwind's `grid`, so any element using Tailwind's `grid` inherited those columns, gap and margin.

#### Fix Applied
- The reset now sits in `@layer base`, so utilities win.
- `Sites.tsx` and `SiteOnboarding.tsx` use `[display:grid]` instead of `grid`.

#### Residual
- Other Tailwind users of `grid` (about 17 files use Tailwind classes) may still collide; shadcn components gain their intended padding because of the layer change, so check them visually.
- Real fix: import `App.css` and the shared stylesheets into a lower layer (`@layer legacy`) so utilities always win; needs a visual pass over every screen.

---
*Last updated: 2026-10-09 (F-013-UI added: legacy global CSS overrides Tailwind)*
