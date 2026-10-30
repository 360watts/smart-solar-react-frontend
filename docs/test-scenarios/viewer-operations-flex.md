# Viewer Operations tab: Actions, Settings, Firmware library

Mockups: Operations.dc.html, OpsSettings.dc.html, OpsFirmware.dc.html (design scratchpad).
Tests: src/features/staff/viewer/__tests__/OperationsTab.test.tsx. Files: OperationsTab.tsx, OpsSettings.tsx, OpsFirmware.tsx, operationsTab.css.
Logs sub-tab: LogsCard + GatewayActivity moved here from the old device page; BuildsCard was only shown when the old page was not in Operations mode, so it is not a lost feature (the Firmware library sub-tab is its replacement).
Settings and Firmware insides are filled by later work; this doc covers the shell and the Actions sub-tab.

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| S1 | Sub-tabs | open Operations, no ?ops | render | Actions, Settings, Firmware library links; Actions is current | unit | P0 | passing |
| S2 | Sub-tabs | ?ops=settings | render | Settings is current; the settings controls render, not the action cards | unit | P0 | passing |
| S3 | Sub-tabs | click Firmware library | click | ?ops=firmware set, Firmware library current; Actions removes the param | unit | P1 | passing |
| S4 | Sub-tabs | open Operations | render | four links: Actions, Settings, Firmware library, Logs (Logs last, href ?ops=logs) | unit | P0 | passing |
| S5 | Logs | ?ops=logs, gateway | render | log files list (OpsLogFiles) and Gateway health (OpsHealth) shown; getDevice read once and passed as device; allowCheck true with device_control | unit | P0 | passing |
| S6 | Logs | ?ops=logs, gateway, no device_control | render | Gateway health gets allowCheck false | unit | P0 | passing |
| S7 | Logs | ?ops=logs, energy meter | render | one line "Energy meters have no remote logs."; no log list, no getDevice call | unit | P1 | passing |
| LG1 | Logs toolbar | gateway, ?ops=logs | render | range chips Last 24 hours, Last 7 days, Custom; "Download all (N)"; no Fetch/Reset buttons; From/To hidden until Custom | unit | P0 | passing |
| LG2 | Logs toolbar | click Last 7 days / Custom + Apply | click | getDeviceLogFiles called again with a from bound (offset 0); chip aria-pressed; Custom shows From and To, Apply fetches the typed range | unit | P0 | passing |
| LG3 | Logs toolbar | Download all (N) | click | bulkDownloadLogFiles called with the applied range; disabled when no files | unit | P1 | passing |
| LG4 | Logs toolbar | gateway, ?ops=logs | render | no "Check" button or day picker here: the day scan moved to Gateway health (HL4) | unit | P1 | passing |
| LG5 | Logs list | files returned | render | one row per file: name, time and size; Download button per row calls downloadDeviceLogFile | unit | P0 | passing |
| LG6 | Logs list | click a row | click | row aria-current/selected, getDeviceLogFileContent called, viewer shows the name; clicking another row switches; a slow older answer never replaces the newer file | unit | P0 | passing |
| LG7 | Logs viewer | file open | render | header name, switches "Errors and warnings only" and "Wrap lines", Download; no file selected shows "Pick a log file to read it." | unit | P1 | passing |
| LG8 | Logs viewer | mixed levels | render | E lines get class lvl-e, W lines lvl-w, others none; errors-only switch hides the rest | unit | P0 | passing |
| LG9 | Logs viewer | open fails | click | "Couldn't open that log file." | unit | P1 | passing |
| LG10 | Logs empty | zero files | render | "No log files in this range." with hint and a link to ?ops=settings keeping other params | unit | P0 | passing |
| LG11 | Logs state | loading / load fails | render | ListSkeleton; "Couldn't load the log files." with Try again that reloads | unit | P1 | passing |
| LG12 | Logs paging | more than 20 files | click Older/Newer | offset 20 requested; Newer disabled on page 1; "kept for 90 days, India time" note shown | unit | P1 | passing |
| LG13 | Logs layout | below 900px | view | viewer stacks under the list (CSS only) | manual | P2 | planned |
| A1 | Rows | gateway | render | ONE compact list, one row per action: Restart, Run diagnostics, Mute alerts, Update firmware, Roll back firmware, Hard reset (red, last); no Fetch logs, no Auto restart / APN / interval; each row has name, status line, state chip | unit | P0 | passing |
| A2 | Rows | energy meter | render | only Restart, Update firmware, Hard reset | unit | P0 | passing |
| A3 | State | one op per state | render | chips Confirmed, Waiting, Not confirmed, Failed, Never run | unit | P0 | passing |
| A4 | Status line | confirmed with confirmed_at and actor / own id / waiting / never run | render | one line: "Confirmed <time> by <name>" ("by you" for own id), "Waiting", "Not confirmed", "Never run"; no timeline, no star, arrows, layout switch, filter pills or Reset layout anywhere | unit | P0 | passing |
| A5 | Run | Restart clicked | confirm dialog OK | rebootDevice called, status note shown, operations reloaded | unit | P0 | passing |
| A6 | Run | Run diagnostics | click | runDeviceDiagnostics called without a dialog; no Fetch logs card (it is the Send logs switch in Settings) | unit | P0 | passing |
| A7 | Run | Mute, Unmute | click | muteDeviceAlerts(id, 4) / unmuteDeviceAlerts called | unit | P1 | passing |
| A8 | Run | newer firmware exists | click Update to X, confirm | triggerSingleUpdate(serial, id) called; no Update button when none newer | unit | P0 | passing |
| A9 | Run | gateway, Roll back | confirm | triggerRollback(serial) called | unit | P1 | passing |
| A10 | Waiting | state waiting | render | that card's run button is disabled | unit | P1 | passing |
| A11 | Failure | API call rejects | click | "Couldn't send that" note, no crash | unit | P1 | passing |
| H1 | Hard reset | gateway | render | red last row with the serial input inline; Hard reset button disabled until the full serial is typed (case-insensitive) | unit | P0 | passing |
| H2 | Hard reset | serial typed | click Hard reset, confirm | hardResetDevice called | unit | P0 | passing |
| H3 | Hard reset | meter | open dialog | meter wording (Wi-Fi erased) | unit | P2 | planned |
| R1 | Recent | recent list | render | "Recent runs" column lists op name, who, state-less time | unit | P1 | dropped (compact list redesign) |
| R2 | Recent | empty | render | "No runs recorded yet" | unit | P2 | dropped (compact list redesign) |
| F1 | Filters | mixed states | render | pills show counts; clicking Waiting shows only waiting cards, aria-pressed set; All restores | unit | P0 | dropped (compact list redesign) |
| F2 | Filters | no matches | click empty pill | "Nothing here" message | unit | P2 | dropped (compact list redesign) |
| L1 | Layout | default | click List, Compact, Cards | container layout attribute follows; choice saved in localStorage per device type | unit | P0 | dropped (compact list redesign) |
| L2 | Pin | click star | click | card moves to top, aria-pressed, saved; click again unpins | unit | P0 | dropped (compact list redesign) |
| L3 | Reorder | card in middle | Move down / Move up | order changes; first card has Move up disabled, last Move down disabled; saved | unit | P0 | dropped (compact list redesign) |
| L4 | Reset | pinned and reordered | Reset layout | default order, nothing pinned, Cards layout, storage cleared | unit | P1 | dropped (compact list redesign) |
| L5 | Storage | localStorage throws or holds garbage | render | renders default layout, no crash | unit | P0 | dropped (compact list redesign) |
| L7 | Storage | saved layout holds the removed id fetch_logs in pinned/order | render | ignored: no card, no crash, other pins kept | unit | P0 | dropped (compact list redesign) |
| L6 | Storage | device types gateway and meter | save for one | the other keeps its own layout | unit | P2 | dropped (compact list redesign) |
| O1 | Offline | device offline | render | notice shown; Restart, Diagnostics disabled; admin note always shown | unit | P0 | passing |
| O2 | Role | no device_control | render | no run buttons, no hard reset unlock; status still shown | unit | P0 | passing |
| O3 | Loading | operations not loaded | render | skeleton with "Loading…" | unit | P1 | passing |
| O4 | Load error | operations fail | render | "Couldn't load the operation history." | unit | P1 | passing |
| C1 | Recent runs | recent list present | render | collapsed: only a "Recent runs (N)" button (aria-expanded false), entries hidden; click shows op name, who, time; click again hides | unit | P0 | passing |
| C2 | Recent runs | empty | open | "No runs recorded yet." | unit | P2 | passing |
| C4 | Storage | any | use the tab | nothing is written to localStorage (no layout persistence) | unit | P1 | passing |
| C5 | Phones | narrow screen | view | buttons stack under the text (CSS only; live check below) | manual | P2 | planned |
| O5 | Refresh | any run completes | after call | getDeviceOperations called again | unit | P1 | passing |
| HL1 | Gateway health | events with a diag, all checks ok | render | header "Gateway health", chip "All good", "Last report <time>" with "N min ago" | unit | P0 | passing |
| HL2 | Gateway health | latest diag has two failing checks | render | chip "2 need a look" | unit | P0 | passing |
| HL3 | Gateway health | no diag events, no notes | render | chip "No health report yet"; empty text "No health report yet." and hint "Use Run diagnostics in Actions. Older firmware does not report health." with a link to Actions | unit | P1 | passing |
| HL4 | Scan logs | any role that can see logs | pick a day, click Scan logs | scanDeviceLogFiles(id, day) called; button "Scanning…" disabled meanwhile; tiles Errors and Warnings (red/amber when above 0, "No errors logged." when 0); "Scanned N log files from <day>."; no Check now button anywhere | unit | P0 | passing |
| HL5 | Scan logs | no log files that day | click Scan logs | "No log files from <day> to scan." | unit | P1 | passing |
| HL6 | Scan logs | scanDeviceLogFiles rejects | click Scan logs | "Couldn't scan those logs. Try again."; button enabled | unit | P1 | passing |
| HL7 | Scan logs | the Logs toolbar | render | the day scan is not duplicated there (see LG4) | unit | P1 | passing |
| HL8 | Diagnostics | Gateway health | render | no run-diagnostics button here; Run diagnostics stays in the Actions list | unit | P0 | passing |
| HL10 | Notes | wifi_failure {ssid, reason auth_failed} | render | amber row "Couldn't join Wi-Fi <ssid>: wrong password..." and link "Change Wi-Fi" to ?ops=settings keeping other params; counts in the chip | unit | P0 | passing |
| HL11 | Notes | config_rejected "12:3" | render | amber row naming settings 12 v3 and the fix | unit | P0 | passing |
| HL12 | Tiles | mixed checks and battery_pct 80 | render | one tile per check plus Backup battery; failing tiles first; each shows state chip "OK" or "Look" | unit | P0 | passing |
| HL13 | History | three diag events | render | list of up to 5 with time and verdict; newest selected; click an older one shows its tiles and aria-pressed | unit | P0 | passing |
| HL14 | Raw values | diag present | click "All raw values" | RawValues table shown, closed by default | unit | P1 | passing |
| HL15 | APN | any role | render | no APN form or "Save APN" anywhere | unit | P0 | passing |
| HL16 | Loading | events pending | render | skeleton "Loading..." | unit | P1 | passing |
| HL17 | Error | getDeviceEvents rejects | render, click Try again | "Couldn't load the health history." then refetch | unit | P0 | passing |
| HL18 | Phones, dark | 3/2/1 column tiles, dark mode | view | manual | manual | P2 | planned |

## Live verification (after deploy)

- Open /devices/<id>/dashboard?tab=ops on a gateway: one compact list of six rows, sub-tab bar matches the mockup, ?ops= changes with the sub-tabs and survives reload.
- Restart a bench gateway: card goes Waiting then Confirmed; Recent runs shows it with your name.
- On a phone width the row buttons stack under the text; Recent runs opens and closes.
- As a viewer without device control: statuses visible, no buttons. As a viewer with it: buttons present.
- Hard reset only on a bench unit: unlock needs the full serial.
