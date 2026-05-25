# InviteMemberModal Redesign — Invite Hub

**Date:** May 25, 2026  
**Status:** Approved

## Overview

Simplify the invite flow by removing the email input form entirely. Transform the modal into a **sharing hub** that generates an invite immediately with a default Viewer role and provides three sharing options. Role management moves to the members list.

## Requirements

**Core Changes:**
- Remove email input form
- Generate invite automatically on modal open (Viewer role default)
- Display QR code prominently (160×160px)
- Provide three sharing options as icons: WhatsApp, Email, Copy Link
- Show copyable invite link below QR code
- No role selector in modal (user changes role later in Members section)
- Match AcceptInvitePage aesthetic (dark card, green accents, DM Sans typography)

**Sharing Behavior:**
- **WhatsApp:** Clicking icon opens `https://wa.me/?text=<URL-encoded-link>`
- **Email:** Clicking icon opens `mailto:?subject=Join%20360Watts&body=<link>`
- **Copy Link:** Copy to clipboard, show Check icon briefly, revert to Copy icon

**Layout:**
```
┌─────────────────────────┐
│ Invite a Member    [X]  │
├─────────────────────────┤
│                         │
│      [QR CODE]          │
│     (160×160px)         │
│                         │
│  https://app.360w...   │
│         [Copy]          │
│                         │
│   [WhatsApp] [Email]    │
│        [Copy]           │
│                         │
│ Share this invite link  │
│ or scan the QR code.    │
│ You can change their    │
│ role later in Members.  │
│                         │
└─────────────────────────┘
```

## Implementation

**File:** `src/features/portal/members/InviteMemberModal.tsx`

**API Flow:**
1. Modal mounts → calls `apiService.inviteSiteMember(siteId, 'auto@generated', 'viewer')`
2. Returns `SiteMember` with `qr_code` and `invite_link`
3. Display results immediately

**State:**
- `inviteResult: SiteMember | null` — stores invite data from API
- `copied: boolean` — tracks copy button state
- `loading: boolean` — shows spinner while generating invite
- `error: string | null` — displays any API errors

**New Dependencies:**
- `Mail`, `MessageCircle` from lucide-react (for icons)
- Existing: `Copy`, `Check as CheckIcon`, `X`, `useTheme`, `apiService`

**Styling:**
- Match AcceptInvitePage dark aesthetic
- QR container: white background, `borderRadius: 12px`, subtle shadow
- Icons: 20-24px size, clickable with hover effects
- Text: DM Sans, muted color for subtitle, green (#22c55e) for success states
- Modal: `position: fixed, inset: 0`, centered, backdrop blur

**Error Handling:**
- If invite generation fails, show error message in red box
- Retry button to regenerate invite
- Close button always available

## Success Criteria

✅ QR code displays on modal open (no form submission needed)  
✅ User can share via WhatsApp (opens native app)  
✅ User can share via Email (opens mail client)  
✅ User can copy link (shows check icon, then reverts)  
✅ Styling matches portal dark theme  
✅ Role is defaulted to Viewer, changeable later in Members  
✅ Modal closes on background click or X button  

## Notes

- Backend already supports `inviteSiteMember(siteId, email, role)` 
- Generate an internal/placeholder email for the automatic invite
- Consider: should we use a UUID or placeholder like `auto-invite-{uuid}@360watts.internal`?
- Role changes happen through the members list API (`updateMember`), not here
