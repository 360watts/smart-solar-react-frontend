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
```

Note: `playwright` is listed as a devDependency but there is no `playwright.config.*`, no `e2e`/`tests` directory, and no `test:e2e` script — E2E testing is not actually wired up in this repo.

**Environment variable:**
```bash
VITE_API_BASE_URL=https://smart-solar-django-backend.vercel.app/api
```

## Architecture

### Route Structure

Defined in `src/app/App.tsx`. Two layout trees: staff (`StaffLayout`, sidebar nav, gated by `StaffRoute`/`AdminRoute`) and customer portal (`PortalLayout`, gated by `CustomerRoute`).

```
/login                        → Login (public)
/verify-email                 → Email verification (public, from OTP email)
/invite/:token                → Accept invite (public, standalone)

# Customer portal (PortalLayout, CustomerRoute)
/portal                       → PortalOverview (index)
/portal/alerts                → PortalAlerts
/portal/device                → PortalDevice
/portal/profile               → PortalProfile
/portal/weather                → PortalWeather
/portal/history                → PortalHistory
/portal/solar                 → PortalSolar
/portal/load                  → PortalLoad
/portal/details               → PortalDetails

# Staff portal (StaffLayout, StaffRoute)
/                              → RoleRedirect (→ /dashboard for staff, /portal for customers)
/dashboard                     → Dashboard
/devices                       → Device list
/configuration                 → Configuration
/alerts                        → Active alerts
/users                         → User management
/employees                     → Employee list (AdminRoute)
/departments                   → Department list (AdminRoute)
/device-presets                → MODBUS register presets
/ota                           → Firmware OTA management (AdminRoute)
/sites                         → Site list
/sites/commissioning           → CommissioningWizard
/sites/:siteId                 → SiteDetail
/equipment                     → Equipment
/quotation                     → QuotationPage
/profile                       → User profile
```

Note: `/devices/:id/config` (previously documented) does not exist in the current router.

### Key Directories

Feature-based layout (entry point is `src/main.jsx`, not `main.tsx`):

```
src/
  app/            — App.tsx (router), constants, ambient declarations
  features/
    auth/         — Login, VerifyEmailPage
    staff/        — Staff dashboard pages (Dashboard, Devices, Sites, Equipment, etc.)
    portal/       — Customer portal pages (PortalOverview, PortalAlerts, PortalDevice, ...)
    mobile/       — Mobile-specific staff/ and portal/ variants
    quotation/    — Quotation builder (components/, hooks/, types/, utils/, doc/)
  shared/
    components/   — Cross-feature components (ErrorBoundary, Toast, SiteDataPanel/, EnergyFlow/, ...)
    guards/       — StaffRoute, AdminRoute, CustomerRoute
    hooks/        — Custom React hooks
    layout/       — StaffLayout, PortalLayout, NavigationProgress
    lib/          — Utility helpers
    theme/        — Theme tokens/helpers
    types/        — TypeScript interfaces
    ui/           — shadcn/ui component overrides (e.g. chart.tsx)
  services/       — API call functions (maps to Django endpoints)
  styles/         — Global stylesheets
  contexts/       — AuthContext (JWT), NavigationContext, ThemeContext, ToastContext
  _archive/       — Retired/legacy code kept for reference, not built
```

### Auth

JWT auth via `AuthContext`. Access token stored in memory; refresh token in localStorage. 401 responses trigger automatic refresh in the API service layer. `ProtectedRoute` wraps all authenticated pages; `AdminRoute` gates admin-only pages.

### API Layer

All API calls go through `src/services/`. Base URL from `VITE_API_BASE_URL`. Calls the Django backend at `smart-solar-django-backend`.

### Theming

Light/dark theme via `ThemeContext` + Tailwind dark mode. Do not hard-code colors — use Tailwind tokens or CSS variables.

### UI Theme + Select Migration

See [`THEME_MIGRATION_STATUS.md`](./THEME_MIGRATION_STATUS.md) for migration history and remaining native-`<select>` wave status. Note that doc still references pre-restructure paths (`src/components/...`, `src/ui/chart.tsx`); current locations are `src/features/staff/...` and `src/shared/ui/chart.tsx` respectively.

### Notable `src/features/staff/` Components

- `CommissioningWizard.tsx` — new-site commissioning flow
- `SavingsBillingEditor.tsx` — savings/billing tariff editor
- `RestoreArchivedDeviceModal.tsx` — restore a soft-deleted device
- `ComponentDetailModalPremium.tsx` — premium component detail modal
- `AiChat.tsx` — staff-only AI chat assistant (rendered via `StaffAiChat` in `App.tsx`, gated on `is_staff`/`is_superuser`)

### Customer Portal: `src/features/portal/` vs `smart-solar-customer-portal` repo

This repo also contains `src/features/portal/` (customer-facing pages, `/portal/*` routes) in addition to the separate `smart-solar-customer-portal` repo. Relationship between the two has not been confirmed from git history — flagging as needing clarification rather than guessing (e.g. whether one is a deprecated/legacy portal and the other the active migration target, or they serve different purposes).

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

---

## Claude Code Skills & Plugins

9 official skills + 5 MCP servers available. Use when they match the task.

**Recommended for this frontend:**

| Skill | When to Use |
|-------|------------|
| **frontend-design** | Building premium UI components, refining aesthetics, animations |
| **code-review** | Auditing components before PRs, checking for accessibility/performance |
| **code-simplifier** | SiteDataPanel (2600+ lines) or other large components need refactoring |
| **context7** | Look up current React, Recharts, Framer Motion API docs |
| **magic-mcp** (MCP) | Component inspiration, premium UI patterns via 21st.dev |
| **figma** (MCP) | Design-to-code, screenshot comparisons, visual prototyping |

**Example Invocations:**
```
# Code review for large component
Skill(skill="code-review")

# Simplify complex component
Skill(skill="code-simplifier")

# Check Chart.js / Framer Motion docs
Skill(skill="context7", args="Chart.js scatter plots")
```

**Note:** Satellite kt analytics dashboard uses Chart.js + Framer Motion + inline styles (no Tailwind). Keep this architecture when extending.
