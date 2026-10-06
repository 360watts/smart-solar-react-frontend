# Test scenarios: staff AI chat (internal web, AiChat.tsx)

**Feature:** the floating "360Watts Buddy" chat for staff: `POST /ai/internal-chat/` (fleet-wide assistant) and the admin-only `/diagnose <question>` command (`POST /ai/diagnose-site/`). Server-side: `smart-solar-django-backend/docs/test-scenarios/ai-assistant.md` (section 6) and `solar-grid-diagnostic-ai/docs/test-scenarios/diagnostic-service.md`.
**Test files:** `src/features/staff/aiChatStream.test.ts` (pure parsing/history/error copy). `__tests__/AiChat.test.tsx` and `FleetHealthReport.test.tsx` already fail on a clean checkout (Jest cannot load the ESM `react-markdown`); fixing the Jest transform is a separate task, so hook-level behaviour is covered by the live checks below.

**Status values:** `planned` / `written` / `passing` / `live-verified`. Update the Status column in the same change that adds or fixes a test.

## 1. Parsing, history, errors

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| P1 | Complete line + partial tail | `parseSSEBuffer` | Event for the line; tail kept | unit | P0 | passing |
| P2 | Keepalive / padding / blank / `[DONE]` / `[ERROR] m` | Parsed | No event for the first three; done and error events | unit | P0 | passing |
| P3 | Chat token with `\n` escape | Parsed (unescape on) | Real newline | unit | P1 | passing |
| P4 | `/diagnose` JSON frame with `\n` inside a string | Parsed (unescape off) | Escape kept, so `JSON.parse` still works | unit | P0 | passing |
| P5 | Non-breaking space | `normalizeStreamFragment` | Becomes a normal space | unit | P2 | passing |
| H1 | Error bubble, diagnose card, empty placeholder | `buildHistory` | None is sent to the model | unit | P0 | passing |
| H2 | 30 messages | `buildHistory` | Last 20 | unit | P2 | passing |
| E1 | 503 with API envelope / 429 with HTML | `httpErrorMessage` | Envelope message / status copy, never raw JSON | unit | P1 | passing |

## 2. Stream behaviour (live)

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| S1 | Long answer | Streaming | Smooth updates (one render per frame, not per token) | live | P1 | planned |
| S2 | Connection drops mid-answer | Fetch fails | Partial answer stays with "(response cut off)" | live | P0 | planned |
| S3 | Stream ends without `[DONE]` | Reader ends | Marked cut off | live | P1 | planned |
| S4 | Click CLR during a stream | Clear | Request aborted, chat empties, no console error (used to throw on `last.content`) | live | P0 | planned |
| S5 | Navigate away during a stream | Unmount | Request aborted | live | P2 | planned |
| S6 | Expired access token | Send | One 401, token refreshed, request retried | live | P0 | planned |
| S7 | Backend returns 503 (`AI_CHAT_ENABLED` off) | Send | "The AI assistant is temporarily unavailable.", composer usable | live | P0 | planned |
| S8 | Previous answer was an error bubble | Send again | Request body has no error text | live | P0 | planned |
| S9 | Double Enter | Send twice fast | One request | live | P1 | planned |

## 3. Diagnose command (admin)

| ID | Given | When | Then | Type | Pri | Status |
|---|---|---|---|---|---|---|
| D1 | Superuser | `/diagnose why is h_0011 low?` | Status labels, then the report card | live | P0 | planned |
| D2 | Staff, not superuser | Same | Treated as a normal chat message (command not recognised) | live | P1 | planned |
| D3 | `DIAG_AI_ENABLED` off | Same | "Site diagnostics is not enabled on this server." | live | P1 | planned |
| D4 | Diagnosis longer than 60 s | Same | Status keeps updating (keepalive), no timeout | live | P0 | planned |
