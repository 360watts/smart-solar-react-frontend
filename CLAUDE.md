# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web admin dashboard for the 360Watts smart solar monitoring platform. React + TypeScript + Vite SPA that connects to `smart-solar-django-backend`. Deployed on Vercel.

**Tech Stack:** React 18 + TypeScript, React Router v6, Radix UI + shadcn/ui, Recharts, Framer Motion, TailwindCSS, Vite, socket.io-client (live telemetry), html2canvas (export), xlsx (CSV export)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (http://localhost:5173/)
npm run build        # Production build → dist/
npm test             # Jest + React Testing Library
npx playwright test  # E2E tests
```

**Environment variable:**
```bash
VITE_API_BASE_URL=https://smart-solar-django-backend.vercel.app/api
```

## Architecture

### Route Structure

```
/login                  → Login (public)
/                       → Dashboard (protected)
/devices                → Device list
/devices/:id/config     → Device MODBUS configuration
/alerts                 → Active alerts
/users                  → User management
/employees              → Employee list (admin only)
/device-presets         → MODBUS register presets
/ota                    → Firmware OTA management
/profile                → User profile
```

### Key Directories

```
src/
  components/     — One file per page/feature (Dashboard, Devices, Alerts, etc.)
  contexts/       — AuthContext (JWT), NavigationContext, ThemeContext, ToastContext
  hooks/          — Custom React hooks
  services/       — API call functions (maps to Django endpoints)
  types/          — TypeScript interfaces
  lib/            — Utility helpers
  ui/             — shadcn/ui component overrides
```

### Auth

JWT auth via `AuthContext`. Access token stored in memory; refresh token in localStorage. 401 responses trigger automatic refresh in the API service layer. `ProtectedRoute` wraps all authenticated pages; `AdminRoute` gates admin-only pages.

### API Layer

All API calls go through `src/services/`. Base URL from `VITE_API_BASE_URL`. Calls the Django backend at `smart-solar-django-backend`.

### Theming

Light/dark theme via `ThemeContext` + Tailwind dark mode. Do not hard-code colors — use Tailwind tokens or CSS variables.

### UI Theme + Select Migration Status (2026-03-26)

Current implementation status for the unified theme/token migration:

- Canonical dark selector is now root-based: `html.dark-mode` (kept backward-compatible with `body.dark-mode` during transition).
- `src/ui/chart.tsx` dark selector was aligned from `.dark` to `.dark-mode`.
- Hardcoded `body` dark colors in `src/index.css` and `body.dark-mode` hard overrides in `src/App.css` were neutralized so token values drive theme behavior.
- Conflicting native select rule `color-scheme: light !important` was removed from `src/App.css`.

Batch 1 component status (completed):

- `src/components/Sites.tsx` — inline select `colorScheme` and styled `<option>` overrides removed.
- `src/components/CommissioningWizard.tsx` — inline select `colorScheme` and styled `<option>` overrides removed.
- `src/components/SiteDetail.tsx` — reviewed in Batch 1 scope and retained for next primitive migration step.

Additional components verified to still use native `<select>` (next migration waves):

- `src/components/Devices.tsx`
- `src/components/Users.tsx`
- `src/components/Equipment.tsx`
- `src/components/SiteDataPanel.tsx`
- `src/components/SlaveConfigModal.tsx`
- `src/components/Employees.tsx`
- `src/components/DevicePresets.tsx`
- `src/components/Configuration.tsx`
- `src/components/OTA.tsx`

Guidance for remaining waves:

- Keep payload parity checks when migrating owner/user selects (`owner_user_id` must remain numeric).
- Prefer headless primitives (Radix + portal rendering) for `BaseSelect`/`SearchableSelect`.
- Keep each wave small and independently revertible.

### Live Data

Socket.io client connects to backend for real-time telemetry updates on the Dashboard. Socket URL matches `VITE_API_BASE_URL` host.

## Deployment

Deployed on Vercel. `vercel.json` contains SPA rewrite rule (`/* → /index.html`). Build output: `dist/`.

## Known Limitations

- No i18n — all text is English, India-specific units (kWh, INR, etc.)
- Tests are sparse — primarily unit tests for utility functions

---

## Production Fault Log

Faults, root causes, and fixes are recorded in [`FAULT_LOG.md`](./FAULT_LOG.md) at the repo root.

**Workflow:** discover fault → open GitHub Issue → fix (reference issue # in commits) → append entry to `FAULT_LOG.md` → close issue.

| ID | Title | Status |
|----|-------|--------|
| F-001-UI | RS-485 freeze — amber/green staleness banners in `SiteDataPanel.tsx` | Fixed |
