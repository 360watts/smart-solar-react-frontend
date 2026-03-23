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

### Live Data

Socket.io client connects to backend for real-time telemetry updates on the Dashboard. Socket URL matches `VITE_API_BASE_URL` host.

## Deployment

Deployed on Vercel. `vercel.json` contains SPA rewrite rule (`/* → /index.html`). Build output: `dist/`.

## Known Limitations

- No i18n — all text is English, India-specific units (kWh, INR, etc.)
- Tests are sparse — primarily unit tests for utility functions
