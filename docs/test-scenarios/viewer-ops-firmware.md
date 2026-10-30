# Viewer Operations: Firmware library sub-tab

Mockup: OpsFirmware.dc.html (design scratchpad). Files: `src/features/staff/viewer/OpsFirmware.tsx`, `opsFirmware.css`.
Tests: `src/features/staff/viewer/__tests__/OpsFirmware.test.tsx`.
Backend rules: list omits s3_key; create/update need device operations; non-admins may change only is_active, release_notes, description; delete is admin only.
The "Devices on it" column and the "uploaded by" name are left out: the firmware list does not return them (the fleet aggregate is employee-only).

| ID | Area | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|---|
| B1 | Builds | gateway device, list has gateway + meter builds | render | only gateway builds, newest first; build in Fira Code, notes line, size, date, Active/Inactive chip | unit | P0 | passing |
| B2 | Builds | meter device | render | only meter (energymeter) builds | unit | P0 | passing |
| B3 | Builds | "Show all builds" switch | turn on | other device types appear too | unit | P1 | passing |
| B4 | Builds | list loading | render | table skeleton, then rows | unit | P1 | passing |
| B5 | Builds | no builds | render | "No builds yet" with an Upload a build button | unit | P1 | passing |
| B6 | Builds | list request fails | render | plain "Couldn't load" message with Try again | unit | P1 | passing |
| B7 | Tabs | render | click Upload a build | tablist buttons, aria-selected follows | unit | P0 | passing |
| T1 | Toggle | inactive build, control | Activate, confirm | updateFirmwareVersion(id, {is_active:true}); list reloads; device cache cleared | unit | P0 | passing |
| T2 | Toggle | active build | Deactivate | dialog first; only on confirm is_active:false is sent | unit | P0 | passing |
| T3 | Toggle | API rejects | confirm | plain error, no crash | unit | P1 | passing |
| D1 | Delete | admin | Delete, confirm | dialog names the build; deleteFirmwareVersion(id) called; list reloads | unit | P0 | passing |
| D2 | Delete | non-admin with control | render | no Delete button at all (not disabled) | unit | P0 | passing |
| D3 | Delete | admin, 400/403/409 on delete | confirm | plain "can't be deleted, devices may be running it" message | unit | P1 | passing |
| P1 | Permissions | no device control | render | list read-only: no Activate/Deactivate/Delete, no Upload tab | unit | P0 | passing |
| U1 | Upload | form | choose file, build number, submit | FormData has file, version, device_type (gateway), description, release_notes, is_active; progress shown; success message; list refreshed; back on Builds | unit | P0 | passing |
| U2 | Upload | meter device | submit | device_type is energymeter | unit | P0 | passing |
| U3 | Upload | switch on | submit | is_active true; default off | unit | P1 | passing |
| U4 | Upload | file over 8 MB or not .bin | choose | plain message, no request | unit | P0 | passing |
| U5 | Upload | no file or no build number | submit | plain message, no request | unit | P1 | passing |
| U6 | Upload | backend 400 / 403 | submit | the backend sentence for 400, "not allowed" sentence for 403 | unit | P1 | passing |
| U7 | Upload | Cancel | click | form cleared, back to Builds | unit | P2 | passing |
| U8 | Upload | file dropped on zone | drop | file taken like Choose file | unit | P2 | passing |

## Live verification
- Viewer with device operations, gateway page: only gateway builds; upload a small .bin inactive; it appears; activate and deactivate each ask first; no Delete.
- Admin: Delete visible; deleting a build devices run is refused with a plain message.
- Viewer without device operations: read-only list.
- Dark mode and 375 px width: table scrolls inside its card, nothing clipped.
