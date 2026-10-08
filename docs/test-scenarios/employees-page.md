# Employees page (list + drawer + add dialog): test scenarios

Design: `smart-solar-django-backend/docs/superpowers/specs/2026-10-08-employees-page-redesign-design.md`
Code: `src/features/staff/employees/`. Tests: `src/features/staff/employees/__tests__/`.
Status: `planned` -> `written` -> `passing` -> `live-verified`.

## roles.ts (pure logic)

| # | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| R1 | a person with `role` missing and `is_superuser` | `roleOf` | `admin` (falls back to the flag) | unit | P0 | passing |
| R2 | viewer with 3 sites | `worksOn` | headline `3 sites`, note lists the first two names and `+1 more` | unit | P1 | passing |
| R3 | viewer with 0 sites | `formError` | message that they will see nothing | unit | P0 | passing |
| R4 | role is not viewer | `buildPayload` | `assigned_sites` is `[]` | unit | P0 | passing |
| R5 | no team chosen | `buildPayload` | no `team_id` key | unit | P1 | passing |
| R6 | editing someone | `buildPayload` with `address` | `address` carried through (the API blanks it otherwise) | unit | P0 | passing |
| R7 | backend messages (email taken, phone taken, last admin, unknown site, role forbidden) | `friendlyError` | the plain sentence from the spec; unknown text -> generic sentence | unit | P0 | passing |
| R8 | `is_active=false` / `on_leave` / default | `statusOf` | Inactive / On leave / Active | unit | P1 | passing |
| R9 | a person with `role: employee` and `is_superuser: true` | `roleOf` | `admin` (superuser wins over the role string) | unit | P0 | passing |
| R10 | a stored email with capitals | `buildPayload` on edit / sign-in toggle; with `lowercaseEmail` on create | kept as typed on edit (login matches exactly); lowercased only on create | unit | P0 | passing |

## Components

| # | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| C1 | role cards | click Viewer; arrow keys | `onChange('viewer')`; arrows move and select | unit | P0 | passing |
| C2 | site picker | search, toggle a site | filtered list; `onChange` with the new selection | unit | P0 | passing |
| C3 | people list | render with counts | tabs show counts; viewer row shows `2 sites`; inactive person shows Inactive | unit | P0 | passing |
| C4 | people list, own row | open ⋯ menu | no Turn off / Remove | unit | P0 | passing |
| C5 | people list, viewers tab empty | render | "No viewers yet" with an Add a viewer action | unit | P1 | passing |
| C6 | drawer, unchanged | render | Save disabled | unit | P0 | passing |
| C7 | drawer, viewer with no sites | render | Save disabled and the "won't see anything" hint | unit | P0 | passing |
| C8 | drawer, own record | render | role cards disabled with the note | unit | P0 | passing |
| C9 | drawer edited, then Close | click Close | "Discard your changes?" confirm | unit | P0 | passing |
| C10 | drawer, change role and sites, Save | click Save | `updateEmployee(id, payload)` with `role` and `assigned_sites`; `onSaved` called | unit | P0 | passing |
| C11 | add dialog | render | Employee preselected; no site picker | unit | P0 | passing |
| C12 | add dialog, choose Viewer | click | site picker appears; Send invite disabled until a site is picked | unit | P0 | passing |
| C13 | add dialog, filled form | click Send invite | `createEmployee` with `role`, `assigned_sites`, optional `team_id`; `onCreated` called | unit | P0 | passing |
| C14 | add dialog, add a team inline | create "Partners" | `createTeam({name})`, team selected | unit | P1 | passing |
| C15 | page 2 holds one person (26 total) | remove that person | page clamps to the last page and page 1 loads again | unit | P0 | passing |
| C16 | an employee with an address and no team | Turn off sign-in | `updateEmployee` payload keeps `role` and `address`, has `is_active: false` and no `team_id` | unit | P0 | passing |

## Live verification (after the backend and dashboard deploy together)

| # | Step | Expected | Status |
|---|---|---|---|
| L1 | Open /employees as an admin | New list; tabs show real counts | planned |
| L2 | Add a viewer with one site | Invite email arrives; viewer signs in and sees only that site | planned |
| L3 | Open that viewer, change sites, Save | Viewer's profile shows the new sites | planned |
| L4 | Change a viewer to Employee | Site list cleared; role changes; no 403 | planned |
| L5 | Turn off sign-in, then on | Chip changes Inactive/Active | planned |
| L6 | Remove a test account | Confirm dialog; account gone | planned |
| L7 | /teams page, add and rename a team | Works; /departments redirects to /teams | planned |
| L8 | Phone width (about 390 px) | List stacks, drawer and dialog are full-screen, targets >= 44 px | planned |
| L9 | Keyboard only | Esc closes, Tab stays in the drawer, arrow keys move between role cards | planned |
