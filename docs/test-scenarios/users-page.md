# Users page (customer accounts)

Page: `/users` (`src/features/staff/Users.tsx`). Mockup: https://claude.ai/artifact/W7nn3mfUaGXBrKCWkVTc5r. Mobile keeps `MobileUsers`.
Test file: `src/features/staff/__tests__/Users.test.tsx`. Backend: unchanged (`GET/POST /users/`, `PUT/DELETE /users/<id>/`, `POST /users/<id>/activate/`, `GET /users/<id>/devices/`). New accounts are created inactive and no email goes out until Activate.

| ID | Given | When | Then | Type | Pri | Status |
|----|-------|------|------|------|-----|--------|
| U1 | 3 users from the API | page loads | one row each with name, `@username`, email, mobile, joined date and an Active / Inactive pill | unit | P0 | passing |
| U2 | users loaded | page loads | first user is selected, their details and devices are shown beneath the list | unit | P0 | passing |
| U3 | two users | click the second row | details and the device list change to that user | unit | P0 | passing |
| U4 | an inactive user | page loads | row has an Activate button; active rows do not | unit | P0 | passing |
| U5 | an inactive user | click Activate | `activateUser(id)` called, toast says the setup email was sent to their address | unit | P0 | passing |
| U6 | users loaded | choose Inactive in the status filter | only inactive rows stay | unit | P1 | planned |
| U7 | users loaded | click Delete | confirm dialog names the user; nothing deleted yet; Cancel deletes nothing | unit | P0 | passing |
| U8 | confirm dialog open | click Delete user | `deleteUser(id)` called, row gone, toast | unit | P0 | passing |
| U9 | users loaded | click Add user, leave fields empty, Save user | messages under the empty fields, `createUser` not called | unit | P0 | passing |
| U10 | add dialog filled | Save user | `createUser` called with the five fields, list reloads | unit | P0 | passing |
| U11 | users loaded | click Edit | dialog opens with that user's values; Save calls `updateUser(id, …)` | unit | P0 | passing |
| U12 | selected user has devices | click a device row | navigates to `/devices/<id>/dashboard` | unit | P1 | passing |
| U13 | selected user has no devices | page loads | "No devices assigned yet" | unit | P2 | passing |
| U14 | Edit or Delete clicked on a row | click | the row is not also selected | unit | P2 | planned |
| U15 | `createUser` rejects | Save user | error shown in the dialog, dialog stays open | unit | P1 | passing |

Edge cases: the status filter only filters the loaded page; deleting the selected user selects the next one; the page does not show the old full-page form.

## Live verification
- [ ] Add a user, see it inactive, Activate it, check the setup email arrives.
- [ ] Edit a mobile number with the phone field, save, reopen.
- [ ] Dark and light theme, 400 px width.
