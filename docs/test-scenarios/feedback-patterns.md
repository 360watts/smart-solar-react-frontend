# Feedback patterns (Notice, EmptyState, ActivityList)

Shared components in `src/shared/components/Feedback.tsx` + `feedback.css` that replace plain grey helper text across the app. Mockup: https://claude.ai/artifact/C4m6GV7UunRZMN1XWB3Wob (2026-10-30). The two older `EmptyState` components (`shared/components/EmptyState.tsx`, `siteHardware/ui.tsx`) were merged into this one.

| ID | Area | Given | When | Then | Type | Priority | Status |
|----|------|-------|------|------|------|----------|--------|
| FB1 | ActivityList | runs today, today, yesterday; one by me, one by someone else, one with no actor | rendered with an `origin` | grouped under Today / Yesterday; my run says You, others show initials and name, no actor says Unknown; origin note ends the list | unit | P1 | passing |
| FB2 | EmptyState | `onRetry` passed | Try again clicked | it is a `role="alert"` and calls onRetry | unit | P0 | passing |
| FB3 | EmptyState | action with `to` | rendered in a router | the action is a link to that path (keeps link semantics for "Go to your home") | unit | P1 | passing |
| FB4 | Notice | `more` passed | rendered | the second sentence is muted (`fb-more`) after the main sentence | unit | P2 | passing |
| FB5 | Operations tab | recent runs exist | Recent runs opened | ActivityList with action icons; "Recording started on 29 Oct" ends the list | integration | P1 | passing (OperationsTab C1/C2) |
| FB6 | Settings sub-tab | a change is staged | history shown | the staged change appears once, in the change bar, not again in the history | integration | P1 | passing (OpsSettings H1) |
| FB7 | Profile (viewer) | viewer profile | rendered | no "Need more? Ask your admin." line; the Ask an admin card covers it | integration | P2 | passing (ViewerProfileSection P4) |

## Live verification

| ID | Check | Status |
|----|-------|--------|
| FB-L1 | Light and dark mode: notice tints, empty-state dashed box and timeline line read clearly on `/devices/:id/dashboard?tab=ops` | planned |
| FB-L2 | Phone width (about 400 px): timeline time column does not overflow; empty-state button wraps | planned |
| FB-L3 | Denied page (`RequireAccess`) and unknown viewer site show the lock empty state with a working link home | planned |
| FB-L4 | Mobile staff pages (OTA, Teams, Equipment) pick up the shared tokens under `.dark-mode` | planned |
