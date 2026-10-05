# Test scenarios: commissioning wizard Cancel cleanup

**Feature:** `CommissioningWizard.tsx`'s "Cancel" button currently only navigates to `/sites` (`<Link to="/sites">`) — it never deletes the draft `SolarSite` row that step 1 already wrote to the DB. Any wizard abandoned after step 1 leaves an orphaned `site_status='draft'` row forever (found via a stale `SS-00001` row whose `created_at` == `updated_at`, i.e. never touched again after creation). Fix: Cancel now soft-deletes the just-created draft (via the same `deleteSite()` the Sites list already uses) when one exists and commissioning hasn't completed, behind a `ConfirmDialog` (`siteHardware/ui.tsx`) per the house destructive-action pattern.
**Design:** this conversation (no separate plan doc — a one-component bugfix).
**Test file (planned):** `src/features/staff/__tests__/CommissioningWizard.test.tsx` (new, or add to an existing staff test file if one already covers this component).

**Status values:** `planned` → `written` → `passing` → `live-verified`.

## 1. Cancel behavior

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| C1 | Step 1, no draft created yet (`createdSiteId` null) | Click Cancel | Navigates to `/sites` immediately, no confirm dialog, no API call | unit | P1 | planned |
| C2 | Step 2/3, a draft was created (`createdSiteId` set) | Click Cancel | `ConfirmDialog` opens ("Discard this draft site?") before anything else happens | unit | P1 | planned |
| C3 | Confirm dialog open (from C2) | User confirms | `deleteSite(createdSiteId)` called, then navigates to `/sites` | unit | P1 | planned |
| C4 | Confirm dialog open (from C2) | User cancels/Escape | Dialog closes, no API call, wizard stays open at the same step | unit | P1 | planned |
| C5 | Step 4 (Commissioning Complete) | Click Cancel | Navigates to `/sites` immediately, no confirm, no delete — the site is done, not a draft to discard | unit | P1 | planned |
| C6 | `deleteSite()` call fails (network/500) | Confirm clicked | Error surfaced (toast/error state), wizard stays open, navigation does NOT happen (avoid silently stranding the user while the draft may still exist) | unit | P2 | planned |
| C7 | Step 2/3, draft created | Click Cancel, confirm | Delete call is the soft-delete (`DELETE /sites/<id>/`, no `?hard=true`) — matches the existing Sites-list delete, recoverable | unit | P2 | planned |

## 2. Regression

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| R1 | Any step | Full page render | Cancel button still visible/clickable (no layout regression from the `width:'100%'` card fix) | unit | P3 | planned |
