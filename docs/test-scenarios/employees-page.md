# Employees page (table + filters + person popup + invite): test scenarios

Design: `smart-solar-django-backend/docs/superpowers/specs/2026-11-05-employees-page-redesign-design.md` (replaces the 2026-10-08 list + drawer design).
Backend scenarios: `smart-solar-django-backend/docs/test-scenarios/employees-list-filters.md` (E1–E20).
Code: `src/features/staff/employees/`. Tests: `src/features/staff/employees/__tests__/`.
Status: `planned` -> `written` -> `passing` -> `live-verified`.

## roles.ts (pure logic) — `roles.test.ts`

| # | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| R1 | `role` missing, `is_superuser` | `roleOf` | `admin` | unit | P0 | passing |
| R2 | viewer with 0 sites and 0 devices | `formError` | says they will see nothing | unit | P0 | passing |
| R3 | role is not viewer | `buildPayload` | `assigned_sites` / `assigned_devices` are `[]` | unit | P0 | passing |
| R4 | no team chosen | `buildPayload` | no `team_id`; with `clearTeam` sends `team_id: null` | unit | P1 | passing |
| R5 | editing someone | `buildPayload` with `address` | address carried through | unit | P0 | passing |
| R6 | backend messages | `friendlyError` | the plain sentence; unknown -> generic | unit | P0 | passing |
| R7 | `is_active` false / `on_leave` / default | `statusOf` | Can't sign in / On leave / Can sign in | unit | P1 | passing |
| R8 | stored email with capitals | `buildPayload` | kept on edit; lowercased only on create | unit | P0 | passing |
| R9 | `+91-98400 12345`, `919840012345`, `98400` | `mobileDigits` / `toMobile` / `mobileError` | 10 digits / `+919840012345` / "Enter all 10 digits" | unit | P0 | passing |
| R10 | employment set on the form | `buildPayload` | `employment_status` and `is_active` sent; `extra.is_active` wins | unit | P0 | passing |
| R11 | ISO time 3 h / 3 days ago, null | `relativeTime` | "3 hours ago" / "3 days ago" / null | unit | P2 | passing |
| R12 | `ROLE_MATRIX` | read | firmware has two rows (send updates vs the page) | unit | P2 | passing |

## Filters and table — `FilterBar.test.ts`

| # | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| F1 | default view, no chips | `toQuery` | only `ordering: 'name'` | unit | P0 | passing |
| F2 | viewer view, team/site/device-controls/employment chips, Joined desc | `toQuery` | role + every filter + `-joined` | unit | P0 | passing |
| F3 | Can't sign in view with sign-in chip on | `toQuery` | `isActive: false` (the view wins) | unit | P1 | passing |
| F4 | 1 or 4 chip values | `chipText` | `Team: Field` / `Team: Field, Support +2` | unit | P2 | passing |
| F5 | admin / employee / viewer with devices / viewer with nothing | `reachOf` | Everything / All sites / 2 devices / Nothing yet; chips cap at 2 sites +N | unit | P1 | passing |

## Page — `EmployeesPage.test.tsx`

| # | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| P1 | two people | load | a row each (labelled by full name); asks `ordering=name`; "Sorted by Name A to Z"; no sign-in yet shows "Not yet recorded" | unit | P0 | passing |
| P2 | table | click Last sign-in twice, then Reset | `-last_active`, `last_active`, back to `name` | unit | P1 | passing |
| P3 | views | click Can't sign in | asks `isActive=false`, no role | unit | P0 | passing |
| P4 | chips | Device controls = No, then Clear all | `deviceOps=false`, chip reads "Device controls: No"; cleared after | unit | P1 | passing |
| P5 | search leaves nobody | type `zzz` | "No one matches" | unit | P1 | passing |
| P6 | 26 people, page 2 holds one | Remove that person | goes back to page 1, "Showing 1 to 25 of 25 people" | unit | P0 | passing |
| P7 | an employee with an address | ⋯ -> Turn off sign-in | PUT keeps role, address, email; `is_active: false`; no `team_id` | unit | P0 | passing |
| P8 | own row | render | no ⋯ menu | unit | P0 | passing |
| P9 | a row | click it; Compare roles in header | person popup opens; roles popup opens | unit | P1 | passing |

## Person popup — `PersonDialog.test.tsx`

| # | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| D1 | no edits | render | Save off, "No changes"; after Viewer + a site: "2 unsaved changes", Save on | unit | P0 | passing |
| D2 | Viewer + one site | Save | full PUT (name, email, address, `team_id: null`, sites); toast "Saved. Meera now sees 1 site." | unit | P0 | passing |
| D3 | role -> Admin | Save | asks first; "Make admin" sends it | unit | P0 | passing |
| D4 | Employment -> Left | Save | "Sign-in turns off when you save."; sends `terminated` + `is_active: false` | unit | P0 | passing |
| D5 | email changed | type | warns the new email is also the sign-in | unit | P1 | passing |
| D6 | stored `+91-9840012345` | open Contact | field shows `9840012345`; a short number flags on blur | unit | P1 | passing |
| D7 | unsaved edits | Close | asks to discard; Discard closes | unit | P0 | passing |
| D8 | own record | render | role locked with a note; no sign-in or Remove buttons | unit | P0 | passing |
| D9 | one reboot op | Device activity tab | "Restarted"; asked for 30 days | unit | P1 | passing |
| D10 | same mobile stored differently, sites reordered | `changeCount` | 0 | unit | P1 | passing |
| D11 | popup over popup (Compare roles over person) | Esc | only the top one closes | unit | P2 | planned |

## Invite — `InviteDialog.test.tsx`

| # | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| I1 | empty form | render | Send off, says what is missing; filled -> "Arun gets a welcome email with sign-in details." | unit | P0 | passing |
| I2 | filled | Send invite | `+919840012345`, email lowercased, role employee; `onCreated` | unit | P0 | passing |
| I3 | Viewer | pick a device | asks for a site or device first; chip shows; summary adds "will see 1 device" | unit | P0 | passing |
| I4 | Team box | type a new name, pick Create | `onCreateTeam('Night shift')` | unit | P1 | passing |
| I5 | Access section | Compare roles | opens the roles popup | unit | P2 | passing |

## Live verification (after backend then frontend deploy)

| # | Check | Pri | Status |
|---|---|---|---|
| L1 | Sign in, then the list shows "Last sign-in: just now" for you | P0 | planned |
| L2 | Search a phone number (last 4+ digits) and a site id; both find the person | P1 | planned |
| L3 | Set someone Left: they can't sign in; Turn on sign-in brings them back | P0 | planned |
| L4 | Device activity for a staff member who rebooted a device shows it | P1 | planned |
| L5 | Phone width: card list, popups fill the screen, no sideways scroll | P1 | planned |
