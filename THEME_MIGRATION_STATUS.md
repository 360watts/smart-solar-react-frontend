# Theme Migration Status

Last updated: 2026-03-26

## What was completed

- Unified dark-mode contract to `html.dark-mode` in `src/contexts/ThemeContext.tsx` (with temporary `body.dark-mode` compatibility).
- Aligned non-CSS theme consumer in `src/ui/chart.tsx` from `.dark` to `.dark-mode`.
- Removed hardcoded body colors in `src/index.css` that forced dark visuals.
- Mapped key legacy `src/App.css` variables to runtime token variables from `src/index.css`.
- Removed conflicting select override (`color-scheme: light !important`) and reduced `body.dark-mode` hard background/color overrides in `src/App.css`.
- Removed inline select theme hacks in:
  - `src/components/Sites.tsx`
  - `src/components/CommissioningWizard.tsx`

## Components still using native `<select>` (next migration waves)

- `src/components/SiteDetail.tsx`
- `src/components/Devices.tsx`
- `src/components/Users.tsx`
- `src/components/Equipment.tsx`
- `src/components/SiteDataPanel.tsx`
- `src/components/SlaveConfigModal.tsx`
- `src/components/Employees.tsx`
- `src/components/DevicePresets.tsx`
- `src/components/Configuration.tsx`
- `src/components/OTA.tsx`

## Wave recommendation

1. Wave 2A (low-to-medium complexity): `Devices`, `Users`, `Employees`, `Configuration`
2. Wave 2B (medium complexity): `Equipment`, `SiteDataPanel`, `OTA`
3. Wave 2C (high complexity/modals): `SlaveConfigModal`, `DevicePresets`, `SiteDetail`

## Validation gates per wave

- Build: `npm run build`
- Visual: light/dark checks for trigger/menu/option states
- Keyboard: tab, arrow navigation, enter/select, escape/close
- Data contract: verify numeric IDs remain numeric in API payloads where required
