# Production Fault Log — smart-solar-react-frontend

Faults specific to the React dashboard UI.

---

## Index

| # | Title | Severity | Status |
|---|-------|----------|--------|
| [F-001-UI](#f-001-ui) | RS-485 freeze — missing staleness UI indicators | High | Fixed |

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
*Last updated: 2026-03-24*
