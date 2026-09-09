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

---
*Last updated: 2026-09-08 (F-006-UI through F-008-UI added — site-hardware UI pass)*
