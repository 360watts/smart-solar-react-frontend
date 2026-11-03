# Slave edit dialog

Component: `src/features/staff/SlaveEditDialog.tsx` with pure helpers in `slaveForm.ts`. Used by `/configuration`. (`DevicePresets` still uses the older `SlaveConfigModal`.) Mockup: https://claude.ai/artifact/GgLJBPeCBR9eEZGFi1EXLn. Backend rules: `smart-solar-django-backend/docs/test-scenarios/slave-config-validation.md`.
Tests: `src/features/staff/__tests__/slaveForm.test.ts`, `SlaveEditDialog.test.tsx`.

| ID | Given | When | Then | Type | Pri | Status |
|----|-------|------|------|------|-----|--------|
| E1 | valid form | `validateSlave` | no errors | unit | P0 | passing |
| E2 | slave ID 0, 248, "abc" | `validateSlave` | `slave_id` error | unit | P0 | passing |
| E3 | new slave, ID already in the list | `validateSlave` | `slave_id` error; editing the same slave is fine | unit | P0 | passing |
| E4 | timeout 6000, poll 5000 | `validateSlave` | `timeout_ms` error | unit | P0 | passing |
| E5 | register: empty label, address 70000, count 0, function 7, duplicate address | `validateSlave` | one `reg:<id>` error each | unit | P0 | passing |
| E6 | form with priority 4 | `toSlavePayload` | payload has `priority: 4` (it used to be dropped) | unit | P0 | passing |
| E7 | CSV with a good row and a bad row | `parseRegisterCsv` | one register, one "Row n" message | unit | P1 | passing |
| E8 | edit mode | open | fields show the slave's values, title "Edit slave" | unit | P0 | passing |
| E9 | invalid timeout | click Save slave | message under the field, `onSave` not called | unit | P0 | passing |
| E10 | valid form | click Save slave | `onSave` called with the form | unit | P0 | passing |
| E11 | a register row | click its chevron | advanced fields (Byte order, Word order, Offset) show | unit | P1 | passing |
| E12 | a register | Remove register | row gone, count updated | unit | P1 | passing |
| E13 | dialog open | Add register | new row, opened, address one above the highest | unit | P1 | passing |
| E14 | search "grid" | type | only matching registers listed | unit | P2 | passing |
| E15 | parent passes `error` | render | banner shown | unit | P2 | planned |

## Live verification
- [ ] Edit a real slave, change priority, save, reopen: priority stays.
- [ ] Import a CSV with 40 rows.
- [ ] Dark and light theme, 400 px width: the dialog scrolls inside itself.
