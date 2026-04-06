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
*Last updated: 2026-04-04 (F-002-UI through F-005-UI added)*
