# Configuration page (slave table + register map)

Page: `/configuration` (`src/features/staff/Configuration.tsx`). Mockup: https://claude.ai/artifact/1TxroC9FTKnTRVK7P8vsTf
Test file: `src/features/staff/__tests__/Configuration.test.tsx`

| ID | Given | When | Then | Type | Pri | Status |
|----|-------|------|------|------|-----|--------|
| C1 | 2 slaves from the API | page loads | one table row per slave with name, `#slave id`, polling, timeout, `active / total` registers | unit | P0 | passing |
| C2 | slaves loaded | page loads | first row is selected and its registers are listed below with address as hex | unit | P0 | passing |
| C3 | two slaves | click the second row | register table shows the second slave's registers | unit | P1 | passing |
| C4 | selected slave | flip a register switch | `updateGlobalSlave` is called with that register's `enabled` flipped and all others unchanged | unit | P0 | passing |
| C5 | API rejects the toggle | flip a switch | error toast shown, table keeps old state | unit | P1 | planned |
| C6 | slaves loaded | click Delete on a row | confirm dialog names the slave and its register count; nothing deleted yet | unit | P0 | passing |
| C7 | confirm dialog open | click Cancel | no `deleteGlobalSlave` call | unit | P0 | passing |
| C8 | confirm dialog open | click Delete slave | `deleteGlobalSlave(id)` called, row removed, success toast | unit | P0 | passing |
| C9 | one enabled, one disabled slave | choose Disabled in the status filter | only the disabled row stays | unit | P1 | planned |
| C10 | no slaves, no search | page loads | empty state "No slaves yet" | unit | P2 | planned |
| C11 | slave with 0 enabled registers | page loads | its count is shown in the warning colour | unit | P3 | planned |
| C12 | Edit clicked on a row | click | row is not also selected (click does not bubble) | unit | P2 | planned |

Edge cases from design review: Delete and Edit buttons must not change the selected row; the status filter only filters the current page (server search stays server-side); the register switch is disabled while a save is in flight.

## Live verification
- [ ] Flip a register switch on a real slave, reload, the state stays.
- [ ] Delete a test slave end to end.
- [ ] Dark and light theme, 400 px width: the tables scroll inside their own box, the page does not.
