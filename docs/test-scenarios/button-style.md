# Button looks and wording

Classes in src/index.css; rules in UI_GUIDE.md ("Buttons and words").

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| B1 | Confirm | a danger ConfirmDialog | open | the confirm button is `ui-btn--danger-fill`, cancel is `ui-btn--link` | unit | P1 | written |
| B2 | Devices | a device row selected | view side panel | Open device is `ui-btn--main`; Edit and Reboot `ui-btn--support`; Delete `ui-btn--danger` | unit | P1 | passing |
| B3 | Operations | a gateway | view actions | Restart is main; Roll back and Hard reset are red outline | unit | P1 | passing (OperationsTab) |
| B4 | Alerts | any tab | view | shared `btn` / `btnPrimary` helpers resolve to the support and main looks | unit | P2 | planned |

## Live verification
- Light and dark: main button readable (white on teal, dark on mint), focus ring visible.
- Phone width: no button row overflows its card.
