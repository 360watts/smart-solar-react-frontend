# OTA page (Firmware updates, `/ota`)

Filter-first redesign (mockup C, 2026-11-04). Files: `src/features/staff/OTA.tsx` (page), `ota/OtaDialogs.tsx` (send, upload, roll back), `ota/otaModel.ts` (pure helpers, `otaModel.test.ts`). Mobile keeps `MobileOTA`. Backend side: `smart-solar-django-backend/docs/test-scenarios/ota-page-mapping.md`.

Rule: any build can go to any device of the same type and chip: newer, older or a tagged build. Downgrades are named, never blocked.

| Area | Given | When | Then | Type | Priority | Status |
|---|---|---|---|---|---|---|
| Version order | 1.0.2, 1.0.9, 1.0.10 | sort | numeric order | unit | P0 | passing |
| Version order | 1.0.8-rc1 and 1.0.8 | sort | the tagged build just before the plain one | unit | P1 | passing |
| Direction | device on 1.0.7, build 1.0.5 | compare | "older" (downgrade) | unit | P0 | passing |
| Direction | device on 2.2.3-3P, build 2.2.3 | compare | same, skipped (the backend ignores the tag) | unit | P0 | passing |
| Fits | meter build, gateway | check | does not fit | unit | P0 | passing |
| Fits | build chip unknown | check | fits (same as backend) | unit | P1 | passing |
| State | `pending_rollback` | map row | "Roll back queued" | unit | P1 | passing |
| State | downloading, 250 of 1000 bytes | map row | "Downloading 25%" | unit | P2 | passing |
| Filters | devices on three versions | tick a version | table and every other facet count narrow; options with 0 fade | manual | P1 | planned |
| Filters | no filter set | open page | quick filters (Failed, Waiting over a day, Downloading, Never checked) with counts | manual | P2 | planned |
| Filters | filters set | click × on a chip / Clear all | that filter / all removed | manual | P2 | planned |
| Sorting | any column header | click twice | descending then ascending; versions sort by number | manual | P1 | planned |
| Paging | 60 matching devices | open, Next | 25 per page, "Showing 26 to 50 of 60", Page 2 of 3 | manual | P1 | planned |
| Paging | on page 3 | change a filter, search, sort or tab | back to page 1 | manual | P2 | planned |
| Paging | 60 matching devices, on page 1 | tick the header box | all 60 ticked (dock says 60), not just the 25 shown | manual | P1 | planned |
| Paging | on the last page, poll returns fewer devices | refresh | shows the new last page, never an empty one | manual | P3 | planned |
| Group | Group by version on | view devices | one section per running version, newest first | manual | P2 | planned |
| Send (ticked) | 3 gateways ticked on 1.0.7 | Send a build…, pick 1.0.5 | counts say 3 go back + downgrade warning; deploy sends 3 | manual | P0 | planned |
| Send (ticked) | gateway and meter ticked | Send a build… | no build listed, "take different builds" message | manual | P1 | planned |
| Send (ticked) | some devices already on the build | send | those skipped, never sent | manual | P1 | planned |
| Send (build) | build 1.0.5, devices on 1.0.4 and 1.0.7 | Send to devices… | starts on "older version" (1.0.4 ticked); "newer version" lists 1.0.7 with a downgrade warning | manual | P0 | planned |
| Switch on | build that would downgrade some idle devices | switch on | confirm shows up/down counts and suggests Send instead | manual | P0 | planned |
| Delete | build switched on | view | Delete disabled; backend also refuses while devices update to it | manual | P1 | planned |
| Stop | ticked devices with a target | Stop their updates | confirm warns a device already told may still install; targets removed | manual | P0 | planned |
| Retry | failed device | Try again | failed attempts reset, device retries at next check | manual | P2 | planned |
| Roll back | gateways + a meter ticked | Roll back | reason required, meter left out with a note; failures listed per serial | manual | P1 | planned |
| Upload | 1.0.4 when 1.0.8 is newest | upload | allowed, note "older than the newest… starts off" | manual | P0 | planned |
| Upload | same version, type and chip exists | type it | Upload disabled, suggests `-2` suffix | manual | P1 | planned |
| Upload | version 1.0.8-rc1 | type it | note that devices compare the part before the dash | manual | P2 | planned |
| Upload | backend 400 | upload | the backend's own sentence in the toast | manual | P2 | planned |
| Screen size | 768 to 1279 px | open page | filter rail folded behind a Filters button (badge = active filters); table fits without sideways scroll | browser (mocked API) | P1 | passing |
| Screen size | 1280 px and wider | open page | rail beside the table, Filters button hidden; no column cut off up to 1920 | browser (mocked API) | P1 | passing |
| Screen size | under 768 px | open page | phone page (`MobileOTA`) | browser (mocked API) | P2 | passing |
| Access | role without `device_control` | open page | no Upload, tick boxes, dock, Send/Delete, retry; switches read-only | manual | P0 | planned |
| Load | API down | open page | amber message with Try again, not an endless Loading | manual | P2 | planned |

## Live verification (after deploy, backend first)

- Status rows show chip, site and download %; a stopped device leaves its campaign.
- Send 1.0.5 to a bench gateway on a newer build: it downloads and reports 1.0.5.
- Upload an older build and a `-rc` build: both accepted, both start off.
- Known gap: Stop does not clear the retained `data/ota` message (open in the backend doc).
