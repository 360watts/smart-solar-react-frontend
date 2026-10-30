# Viewer Site page and Profile (phase 3): dashboard

Spec: docs/superpowers/specs/2026-10-29-viewer-portal-redesign-design.md (§5.2, §5.4). Data: `GET /me/access-summary/`, `GET /sites/:id/events/?days=7`, `GET /me/operations/?days=30`.
Tests: `src/features/staff/viewer/__tests__/ViewerSite.test.tsx`, `ViewerProfileSection.test.tsx`.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| V1 | Site | viewer opens a site | render | one strip per device at that site (same component as Home) above the tabs, each linking to `/devices/:id/dashboard` | unit | P0 | passing |
| V2 | Site | site with no devices | render | no strip block, no empty box | unit | P2 | passing |
| V3 | Site tabs | viewer | render | Forecast and Weather tabs are not offered | unit | P0 | passing |
| V4 | Site tabs | viewer | render | Overview, History, Phase load, Plugs, Usage kept; Events added | unit | P0 | passing |
| V5 | Events | events from the API | open Events tab | incidents and operations merged, newest first, kind, title, actor, serial | unit | P0 | passing |
| V6 | Events | no events | open Events tab | "Nothing happened in the last 7 days" | unit | P1 | passing |
| V7 | Events | request fails | open Events tab | message and "Try again" | unit | P1 | passing |
| V8 | Site | site not assigned | render | existing "This site isn't available to you" | unit | P1 | passing |
| P1 | Profile | viewer | open /profile | "What you've been given": Devices card and Sites card side by side (serial + type, id + place) | unit | P0 | passing |
| P2 | Profile | viewer with ops on | render | "On everything given to you" lists the operations; "Ask an admin for" lists the rest | unit | P0 | passing |
| P3 | Profile | viewer with device ops off | render | operation items move to "Ask an admin for" | unit | P0 | passing |
| P4 | Profile | viewer | render | "Need more? Ask your admin." line, no email button | unit | P1 | passing |
| P5 | Profile | trail rows | render | "Operations you ran, last 30 days": time, operation, device serial, newest first | unit | P0 | passing |
| P6 | Profile | no operations | render | "You haven't run any operations in the last 30 days" | unit | P1 | passing |
| P7 | Profile | admin or employee | open /profile | no viewer section | unit | P0 | passing |
| P8 | Copy | access copy file | read | marked KEEP IN SYNC with `staff_roles.py`, beside `roles.ts` | unit | P2 | passing |

## Live verification
- Site viewer: strips match Home; an operation run on the device page appears in Events and in the Profile trail.
