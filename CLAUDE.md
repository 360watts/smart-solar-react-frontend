# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Web admin dashboard for the 360Watts smart solar monitoring platform. React + TypeScript + Vite SPA that connects to `smart-solar-django-backend`. Deployed on Vercel.

**Tech Stack:** React 18 + TypeScript, React Router v6, Radix UI + shadcn/ui, Recharts, Framer Motion, TailwindCSS, Vite, html2canvas (export), xlsx (CSV export)

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

Defined in `src/app/App.tsx`. Single layout tree: staff (`StaffLayout`, sidebar nav, gated by `StaffRoute`, and per page by `RequireAccess` from `src/shared/access`, which hides what the signed-in role cannot use; see "Role-based access" below). This app has no customer-facing routes — the customer portal was decommissioned here and now lives solely in `smart-solar-customer-portal`. Non-staff accounts hitting `/` are redirected to `https://my.360watts.com` (`RoleRedirect` in `App.tsx`) rather than routed anywhere internally.

```
/login                        → Login (public)
/verify-email                 → Email verification (public, from OTP email)

# Staff portal (StaffLayout, StaffRoute)
/                              → RoleRedirect (→ /dashboard for staff, external customer portal otherwise)
/dashboard                     → Dashboard
/devices                       → Device list
/configuration                 → Configuration
/alerts                        → Active alerts
/service-bookings              → ServiceBookings
/users                         → User management
/employees                     → Employees page: list, person drawer, add dialog; viewers are managed here (RequireAccess `employees`)
/teams                         → Teams (RequireAccess `teams`); `/departments` redirects here
/my-sites                      → Viewer home: the sites assigned to the signed-in viewer (RequireAccess `my_sites`)
/my-sites/:siteId              → Viewer site view (SiteDataPanel with the read-only monitoring tabs)
/device-presets                → MODBUS register presets
/ota                           → Firmware OTA management (RequireAccess `ota`, admin only)
/sites                         → Site list
/sites/commissioning           → CommissioningWizard
/sites/onboarding              → SiteOnboarding (pick a site, fill customer / system / appliances / billing; per-section progress)
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
    mobile/       — Mobile-specific staff/ variants (customer-facing mobile/portal/ variant removed with the portal decommission)
    quotation/    — Quotation builder (components/, hooks/, types/, utils/, doc/)
  shared/
    components/   — Cross-feature components (ErrorBoundary, Toast, SiteDataPanel/, EnergyFlow/, ...); EnergyFlow/flowModel.ts holds the pure flow helpers (mix shares, line geometry); smart plugs are listed in the site panel's Smart plugs tab (`SiteDataPanel/tabs/PlugsTab.tsx`, read-only, helpers in `EnergyFlow/plugHelpers.tsx`), the flow only shows load totals + an "N smart plugs ›" link
    guards/       — StaffRoute (AdminRoute is no longer used by any route)
    access/       — Feature keys, `useAccess()`, `RequireAccess` (see "Role-based access")
    hooks/        — Custom React hooks
    layout/       — StaffLayout, NavigationProgress
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

JWT auth via `AuthContext`. Access token stored in memory; refresh token in localStorage. 401 responses trigger automatic refresh in the API service layer. `StaffRoute` wraps the staff pages; per-page access is decided by the backend's `access` list (below), not by `is_superuser` alone.

### Role-based access

Roles are admin / employee / viewer (backend `api/staff_roles.py`). `/auth/user/` and the login responses return `role`, an `access` array of feature keys and, for viewers, `assigned_sites`. `useAccess().can('<feature>')` (in `src/shared/access/`) is the single check: the three nav lists (`staffNavigation.tsx`, `StaffLayout.tsx`, `Navbar.tsx`), `RequireAccess` on every staff route, the AI chat bubble and the in-page controls (site billing, permanent deletes, Wi-Fi passwords, device-writing buttons) all use it. Hide controls, do not disable them. Feature keys live in `src/shared/access/features.ts` and must match the backend `FEATURES` table. If the backend sends no `access` list (older deploy) the hook falls back to the old behaviour, except a viewer, who gets nothing. Hiding is a convenience only; the backend enforces everything. Viewers have no list-all endpoint: their home is `/my-sites`, built from `assigned_sites`. Design: `smart-solar-django-backend/docs/superpowers/specs/2026-10-08-staff-roles-design.md`; scenarios: `docs/test-scenarios/role-based-hiding.md`, `employees-page.md`.

### API Layer

All API calls go through `src/services/`. Base URL from `VITE_API_BASE_URL`. Calls the Django backend at `smart-solar-django-backend`.

**Backend infra (2026-09-08):** the Django backend moved off Railway (Singapore) to self-hosted **AWS Mumbai `ap-south-1`** for MNRE data-residency compliance. The public URL `https://api.360watts.com` is unchanged. If `VITE_API_BASE_URL` still points at the Vercel proxy (`smart-solar-django-backend.vercel.app`), that proxy's `vercel.json` must be repointed at `api.360watts.com` before Railway is decommissioned — better: set `VITE_API_BASE_URL=https://api.360watts.com/api` directly and drop the Vercel hop.

### Theming

Light/dark theme via `ThemeContext` + Tailwind dark mode. Do not hard-code colors — use Tailwind tokens or CSS variables.

### UI Style — the friendly house style

**All new staff-facing UI follows [`UI_GUIDE.md`](./UI_GUIDE.md).** Plain,
non-technical language (the audience is field/ops staff, not engineers), calm
status vocabulary ("Not set up yet" is amber, not red), appliance-first rows,
guided flows closed by default, device codes behind an "Advanced details"
expander, destructive actions confirmed in a centred `ConfirmDialog` modal
(never `window.confirm` or a sticky bar). Row secondary-actions live in a
portaled `⋯` menu (`Item` / `OverflowMenu` — a portal so a card's
`overflow: hidden` can't clip it). Shared primitives live in
`src/features/staff/siteHardware/ui.tsx`; `InverterMeasurementConfig.tsx` is the
reference page. When touching an older screen, migrate it toward this style
rather than matching its old patterns.

### UI Theme + Select Migration

See [`THEME_MIGRATION_STATUS.md`](./THEME_MIGRATION_STATUS.md) for migration history and remaining native-`<select>` wave status. Note that doc still references pre-restructure paths (`src/components/...`, `src/ui/chart.tsx`); current locations are `src/features/staff/...` and `src/shared/ui/chart.tsx` respectively.

### Notable `src/features/staff/` Components

- `HealthBand.tsx` — one-row site health on the Dashboard (status, alerts button, devices, capacities, location); replaced the KPI cards and chip row 2026-10-09. Spec: `smart-solar-django-backend/docs/superpowers/specs/2026-10-09-dashboard-redesign-design.md`
- `CommissioningWizard.tsx` — new-site commissioning flow
- `SavingsBillingEditor.tsx` — savings/billing editor (EB bill, investment, payment status, latest bill date / billing anchor, energy-wallet balance override)
- `SiteOnboarding.tsx` + `onboardingProgress.ts` — staff page to complete a site's customer, system, appliance and billing details (`/sites/onboarding?site=<id>`, sidebar entry under Sites). The Billing section also holds the EB account fields (consumer number + EB-registered mobile). Redesigned 2026-10-09 as "Site setup": entered from the Sites list (Needs setup chip, Finish setup / Edit setup per row; no nav entry), built on Tailwind classes and the `needed`/`done`/`forest` tokens in `index.css`, with a shared time zone list (`timezones.ts`). Not built: a `/sites/:id/setup` route and retiring the wizard. Two legacy-CSS traps for new pages are in `UI_GUIDE.md` section 8 (F-013-UI). Spec: `smart-solar-django-backend/docs/superpowers/specs/2026-10-07-site-onboarding-page-design.md`
- `RestoreArchivedDeviceModal.tsx` — restore a soft-deleted device
- `ComponentDetailModalPremium.tsx` — premium component detail modal
- `AiChat.tsx` — staff-only AI chat assistant (rendered via `StaffAiChat` in `App.tsx`, gated on `can('ai_chat')`, admin only)
- `employees/` — the Employees page: `EmployeesPage.tsx`, `PeopleList.tsx`, `PersonPanel.tsx` (role, assigned sites, device-operations switch), `AddTeammateDialog.tsx`, `roles.ts` (role copy and payload rules; keep in sync with the backend tiers)
- `viewer/` — `MySites.tsx` and `ViewerSite.tsx`, the viewer's home and site view; `ViewerDevices.tsx` + `DeviceDrawer.tsx` are the site panel's Devices tab (only with `can('device_control')`; scenarios `docs/test-scenarios/viewer-devices.md`)
- `Teams.tsx` — teams manager (renamed from Departments, 2026-10-08)

### Customer Portal Decommission

This app previously shipped its own customer-facing portal at `src/features/portal/` (`/portal/*` routes, `PortalLayout`, `CustomerRoute`). It was unused and has been fully removed — the active customer-facing app is the dedicated `smart-solar-customer-portal` repo, deployed at `my.360watts.com`. `RoleRedirect` (`App.tsx`) sends any non-staff account there instead of routing internally.

### Live Data

Dashboard live updates are REST polling (`Dashboard.tsx`'s `fetchSites`/`fetchAlerts` on a `setInterval`), not a websocket — `socket.io-client` was previously a dependency here but had zero usage in `src/`; removed 2026-07-20.

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

## Shared workflow rules (all 360watts repos)

Keep this block identical in every repo's CLAUDE.md. When you change it, change it everywhere.

- **No auto-commit or deploy:** confirm with the user before `git commit`, `git push`, merging to main, or deploying.
- **No AI attribution in commits:** leave `Co-Authored-By: Claude ...` lines out of commit messages.
- **Test scenario document for every new feature:** `docs/test-scenarios/<feature>.md`, written before the tests.
  - Contents: given / when / then rows grouped by area, a type (unit / integration / live), a priority (P0–P3) and a status (`planned` → `written` → `passing` → `live-verified`).
  - Include the edge cases found in design review, and a live-verification section.
  - Update the Status column in the same change that adds or fixes a test.
  - Example: `smart-solar-django-backend/docs/test-scenarios/inverter-settings-history.md`.
