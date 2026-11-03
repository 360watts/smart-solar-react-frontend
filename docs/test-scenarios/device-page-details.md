# Device page: Details tab, Edit/Delete, one page per device

Replaces the old in-page device view on the Devices page. "Open device" now goes to `/devices/:id/dashboard`.
Tests: src/features/staff/viewer/__tests__/DetailsTab.test.tsx, DeviceDashboard.test.tsx.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| D1 | Tabs | staff with `devices` | open the device page | a Details tab is listed after Operations | unit | P0 | passing |
| D2 | Tabs | viewer without `devices` | open the device page | no Details tab, no Edit or Delete | unit | P0 | passing |
| D3 | Alerts | two open incidents for this device, one for another | open Details | only this device's two are listed with severity and message | unit | P0 | passing |
| D4 | Alerts | none open | open Details | "No active alerts for this device." | unit | P1 | passing |
| D5 | Alerts | alerts call fails | open Details | the rest of the tab still renders; alerts say they could not load | unit | P1 | passing |
| D6 | About | device record with IP, signal, temp, heap, health | open Details | each is shown; missing values show a dash | unit | P0 | passing |
| D7 | About | device with a site | open Details | Site is a link to /sites/<id>; without one it reads "Not at a site" | unit | P1 | passing |
| D8 | Config | preset assigned, pending update | open Details | "Waiting for device" and the preset id | unit | P1 | passing |
| D9 | Config | no preset | open Details | "No preset assigned" | unit | P2 | passing |
| D10 | Coverage | gateway with 3 of 4 registers received | open Details, expand | 75%, "3 / 4 registers", each slave section opens | unit | P0 | passing |
| D11 | Coverage | energy meter | open Details | no Register coverage section | unit | P1 | passing |
| D12 | Coverage | coverage call fails | expand | "No telemetry yet" empty state, no crash | unit | P2 | passing |
| D13 | Edit | `device_control` | click Edit | Edit device dialog opens with the full record; Save calls updateDevice and reloads the page data | unit | P0 | passing |
| D14 | Delete | `destructive` | click Delete, confirm | deleteDevice is called, then the browser goes to /devices | unit | P0 | passing |
| D15 | Delete | no `destructive` | open | no Delete button | unit | P0 | passing |
| N1 | Devices list | a row selected | click Open device, or double-click the row | browser goes to /devices/<id>/dashboard | unit | P0 | passing |
| N2 | Devices list | URL has `?deviceId=47` | open /devices | browser goes to /devices/47/dashboard | unit | P1 | passing |
| N3 | Devices list | device with no site | open it | page shows readings and Details with "Not at a site"; no site dashboard is requested | unit | P0 | passing (D7; the page never asks for a site dashboard) |

## Live verification
- Open a gateway with a site, a gateway with no site (e.g. 00A11EF28F0E) and an energy meter from the list; each lands on its device page.
- Edit a device name and save; confirm the header updates.
- Compare Details values with the old page for one device before the old view is gone.
