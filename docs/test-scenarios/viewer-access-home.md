# Viewer home "Your access" (phase 2): dashboard

Spec: docs/superpowers/specs/2026-10-29-viewer-portal-redesign-design.md (§5.1). Data: `GET /me/access-summary/` (backend scenarios in its own repo).
Tests: `src/features/staff/viewer/__tests__/ViewerHome.test.tsx`.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| H1 | Headline | 2 devices, 1 site | render | "You can test 2 devices and 1 site" | unit | P0 | passing |
| H2 | Headline | devices only / sites only | render | wording adapts ("You can test 1 device") | unit | P1 | passing |
| H3 | Empty | nothing assigned | render | "Nothing has been given to you yet. An admin assigns devices and sites." | unit | P0 | passing |
| H4 | Table | rows from the API | render | silent devices first, serial, firmware, strip, status, last data | unit | P0 | passing |
| H5 | Table | site-less device | render | "bench, no site" beside the type | unit | P1 | passing |
| H6 | Strip | 48 cells full/partial/empty | render | 48 cells with state classes, label "last 24 hours" | unit | P1 | passing |
| H7 | Row | click a row | navigate | opens `/devices/:id/dashboard` | unit | P0 | passing |
| H8 | Sites | 2 sites | render | cards: id, place, "X of Y devices sending", latest open fault; no power numbers | unit | P1 | passing |
| H9 | Sites | site card click | navigate | opens `/my-sites/:siteId` | unit | P1 | passing |
| H10 | Link | any state | render | one line "You can run every operation on these devices. See your access" linking to `/profile` | unit | P2 | passing |
| H11 | Load | request fails | render | message and "Try again" | unit | P1 | passing |
| H12 | Refresh | page open | 60 s passes / tab regains focus | refetches | unit | P2 | passing |
| H13 | Route | viewer | open `/my-sites` | shows the new home; `MySites.tsx` is gone | unit | P0 | passing |
| H14 | Layout | any width | render | content max 1180 px, no ligatures, 16 px gutter, table scrolls in a box on phones | live | P1 | planned |

## Live verification
- Device-only tester login: home lists the bench unit, no sites.
- Site viewer: counts match the site's Devices tab; a silent device sorts first.
