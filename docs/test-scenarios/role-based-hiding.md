# Role-based hiding in the dashboard: test scenarios

Hiding is a convenience; the backend keeps enforcing. Features come from `user.access` (falls back to superuser-only for old backends). Status: planned | written | passing | live-verified.

## Navigation per role

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| NAV-1 | Admin signed in | Menu renders | All links visible, incl. Employees, Teams, OTA, Analytics, Catalog | unit | P1 | passing |
| NAV-2 | Employee signed in | Menu renders | Dashboard, Sites, Alerts, Devices, Bookings, Support, Configuration, Presets only; no Employees/Teams/Users/OTA/Analytics/Catalog/Quotations/AI chat | unit | P0 | passing |
| NAV-3 | Viewer signed in | Menu renders | Only "My sites" (and Profile); no fleet pages | unit | P0 | passing |
| NAV-4 | Backend sends no `access` (old backend) | Superuser / non-superuser staff | Superuser sees all; non-superuser staff sees non-admin-only links | unit | P1 | passing |

## Route guard

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| RG-1 | Employee | Opens `/employees` directly | The "This page isn't available for your role" card with a link to their home (`/dashboard`); no redirect, page content never shown | unit | P0 | passing |
| RG-2 | Viewer | Opens `/devices` directly | The same card with a link to `/my-sites`; no redirect | unit | P0 | passing |
| RG-3 | Admin | Opens any page | Page renders | unit | P2 | passing |
| RG-4 | Staff user with an empty `access` list | Opens a denied page | Card links to `/profile` (never back to a page they cannot open) | unit | P1 | passing |
| RG-5 | Viewer with no `access` list (old backend) | Menu and pages | Gets nothing (fails closed) | unit | P0 | passing |
| RR-1 | Viewer | Opens `/` | Sent to `/my-sites` | unit | P1 | passing |
| RR-2 | Employee | Opens `/` | Sent to `/dashboard` | unit | P1 | passing |

## My sites (viewer home)

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| MS-1 | Viewer with assigned sites | Opens home | Lists only assigned sites by name, each with an "Open" link labelled "Open <site name>" | unit | P0 | passing |
| MS-2 | Viewer with no assigned sites | Opens home | Friendly empty state | unit | P2 | passing |
| MS-3 | Viewer | Opens a site not assigned to them by URL | Rejected client-side with "This site isn't available to you"; no data requested. The backend also denies (live check 2) | unit + live | P0 | passing |
| MS-4 | Viewer, assigned site | Opens `/my-sites/<id>` | Monitoring panel shows | unit | P1 | passing |
| MS-5 | Viewer's assignments change on the server | Viewer keeps the tab open | `assigned_sites` only refreshes on login or page reload, so the new site shows after one of those | note | P3 | planned |

## In-page hiding

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| IP-1 | No `site_billing` | Site overview tab | No "Billing" heading / "Net metering started on" field, no Savings & Billing editor | manual | P1 | planned |
| IP-2 | No `site_billing` | Site onboarding page | No Savings & Billing editor under "Billing & energy wallet" | manual | P2 | planned |
| IP-3 | No `destructive` | Site settings tab | No "Remove this site" card and no confirm modal | manual | P0 | planned |
| IP-4 | No `destructive` | Site equipment tab | No trash button on inverter/battery/panel rows; edit button remains | manual | P0 | planned |
| IP-5 | No `destructive` | Devices page | No row trash button, no "Delete" in device detail actions, no bulk "Delete (n)" button even with rows selected | manual | P0 | planned |
| IP-6 | No `destructive` | Restore Archived Device modal | Restore works; no row checkboxes, no bulk bar, no permanent-delete button | unit | P0 | passing |
| IP-7 | `destructive` allowed | Restore Archived Device modal | Checkbox and permanent-delete button shown | unit | P1 | passing |
| IP-8 | No `site_credentials` | Edit device modal | SSID visible; no "Change" toggle, no Wi-Fi password field; saving never sends `wifi_password` | manual | P0 | planned |
| IP-9 | No `site_credentials` | Mobile devices edit sheet | No Wi-Fi Password block; mobile action menu has no Delete without `destructive` | manual | P1 | planned |
| IP-10 | Admin | All of the above | Every control present, unchanged behaviour | manual | P1 | planned |
| IP-11 | No `ai_chat` | Any staff page | The AI chat button and panel are not rendered | unit | P1 | planned |
| IP-12 | Overview call fails for the role | Site data panel | The panel keeps working with its other data; no error banner | unit | P1 | planned |
| IP-13 | No `users` (employee) | Commissioning wizard | Site id is still generated; owner picker replaced by "Customer details are managed by an admin. Ask an admin to link the owner."; no error banner on load | unit | P0 | planned |
| IP-14 | No `site_billing` and no `users` (employee) | Site onboarding, pick a site | No savings or user calls; Customer section reads "Customer details are managed by an admin." with no Save and no progress chip; Billing can reach Complete from the EB fields; no "Could not load billing details" | unit | P0 | planned |
| IP-15 | No `destructive` (employee) | Manage provisions modal | Pending claims show no Revoke button | unit | P0 | planned |
| IP-16 | No `users` (employee) | Site detail (desktop and mobile) | No user-list call; Customer shows the owner name as plain text, or "Managed by an admin"; saving details does not send `owner_user_id` | unit | P1 | planned |
| IP-17 | No `destructive` | Devices page | No select-all or row checkboxes (the only bulk action is delete) | manual | P1 | planned |
| IP-18 | No `site_billing` | `onboardingProgress.sectionProgress(..., false)` | Billing counts only the two EB fields (2 of 2) | unit | P1 | passing |

## Device operations switch

Per-person switch in the Employees panel and Add teammate dialog. Off means "watch only": the backend denies non-read requests on device-operation routes (`DEVICE_OPS_OFF`) and drops `device_control` from `user.access`, so the dashboard hides device-writing controls. Backend contract: `device_ops_enabled` on the employees API (always true for admins).

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| DO-1 | Admin opens an employee or viewer in the access panel | Panel renders | A "Device operations" switch is shown under the role cards | unit | P0 | passing |
| DO-2 | Admin opens an admin in the access panel, or picks the Admin role in either dialog | Panel renders | No switch; it returns when the role changes back to employee or viewer | unit | P0 | passing |
| DO-3 | Add teammate dialog, employee or viewer | Dialog opens | Switch is on by default; helper reads "Can restart devices and change their settings." | unit | P0 | passing |
| DO-4 | Switch turned off | Helper text | Reads "Can watch devices but not change them." | unit | P1 | passing |
| DO-5 | Person has `device_ops_enabled: false` (or missing, which counts as on) | Panel opens | Switch reflects the stored value | unit | P0 | passing |
| DO-6 | Switch flipped in the access panel | Save button | Counts as a change (Save enabled); update payload carries `device_ops_enabled` | unit | P0 | passing |
| DO-7 | Create (employee or viewer) | Send invite | Payload carries `device_ops_enabled` (true by default, false when switched off) | unit | P0 | passing |
| DO-8 | Admin role selected (create or update) | Payload built | `device_ops_enabled` is left out | unit | P0 | passing |
| DO-9 | Employee or viewer with the switch off | People list | Note under the headline ends "Watch only"; headline unchanged | unit | P1 | passing |
| DO-10 | Backend answers "Device operations are turned off for your account." | Any save error | Shown as "Device operations are turned off for your account. Ask an admin." | unit | P1 | passing |
| DO-11 | No `device_control` | Site setup (inverter monitor, meter, smart plugs) | Rows stay; no "Connect the monitor", "Add a meter", "Add a smart plug", and no row menus (move, disconnect, route through monitor, edit or remove plug) | unit | P0 | passing |
| DO-12 | No `device_control` | Devices page (desktop) | Detail header has no Edit, Reboot, Hard Reset, Mute or Unmute (Delete stays tied to `destructive`); no log or auto-reboot toggles; table has no pencil, and no Actions column when no action remains | manual | P0 | planned |
| DO-13 | No `device_control` | Devices page (mobile) | No three-dot menu unless `destructive` is allowed; menu has no Edit, Reboot, Hard Reset or Mute | manual | P0 | planned |
| DO-14 | No `device_control` | Mobile site detail | Gateway shows details but no Detach, Move or Attach controls | manual | P1 | planned |
| DO-15 | No `device_control` | OTA page (desktop and mobile) | No Deploy Firmware card, no Cancel on the active campaign, no Emergency Rollback card; mobile has no Deploy buttons and no Rollback; repository and status stay readable | manual | P0 | planned |
| DO-16 | `device_control` allowed (admin, or switch on) | All of the above | Every control present, unchanged behaviour | manual | P1 | planned |
| DO-17 | Admin switches an employee off in the panel | Employee's session | After next login or reload, `user.access` lacks `device_control` and the controls above are gone | live | P0 | planned |

## Live verification (staging/prod, after deploy)

Sign in as each role and check:

1. Viewer: menu shows only My sites; typing `/devices`, `/employees`, `/dashboard` in the address bar lands back on My sites.
2. Viewer: open a site that is not assigned to them (by URL): no data is shown and the API returns 403/404.
3. Employee: menu has no Employees, Teams, Users, OTA, Analytics, Catalog, Quotations, AI chat; typing `/employees` shows "This page isn't available for your role" with a link to the dashboard (no redirect).
4. Employee: open a site: no Savings & Billing editor, no "Net metering started on", no "Remove this site", no trash buttons in Equipment.
5. Employee: Devices page has no delete button (row, detail, bulk); Restore Archived has no permanent delete; Edit device has no Wi-Fi password field.
6. Employee (needs `STAFF_ROLES_ENFORCE=1`): open Commissioning, the site id is filled and the owner area explains an admin links the customer; no error banner.
7. Employee: open Site onboarding for a site; no error banners, Customer says it is managed by an admin, Billing can show Complete.
8. Employee: open Manage provisions with a pending claim; no Revoke button. Open a site page; Customer shows a name as text.
9. Any role: after an admin changes a viewer's assigned sites, the viewer sees the change only after logging in again or reloading.
10. Admin: all of the above are present and work.
11. Admin: open an employee in Employees, turn Device operations off, save. The People list shows "Watch only" under the employee.
12. That employee (sign out and in): Devices has no Edit, Reboot, Hard Reset or Mute; a site's setup page has no Connect, Add or plug menus; OTA has no Deploy or Rollback. Telemetry, alerts and logs still show.
13. Same employee, direct API write (for example `POST /devices/<id>/reboot/` with their token): returns 403 with code `DEVICE_OPS_OFF`. A read such as `GET /devices/` still returns 200.
14. Admin turns it back on: after the employee signs in again, the controls return and the write works.
15. Add teammate with the switch off: the new account is watch only from the first sign-in. Admin accounts never show the switch.
