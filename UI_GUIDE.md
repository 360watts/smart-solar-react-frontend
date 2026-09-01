# UI Guide — the friendly style

This is the house style for **all new staff-facing UI** in this repo. It exists
because our earlier hardware screens read like engineering tools: schematics,
uppercase field labels, monospace device IDs, always-open forms. The people who
actually use the staff dashboard are field and ops staff, not engineers. They
want to know *what is working* and *what needs a hand* — nothing more.

When you build or touch a screen, follow this. When a screen predates the guide,
migrate it in the same style rather than matching its old patterns.

Reference implementation: `src/features/staff/siteHardware/` —
- `ui.tsx` — the shared primitives (import these, don't re-roll them)
- `InverterMeasurementConfig.tsx` — a full page built from them
- `SmartDeviceComposer.tsx` / `FoundPlugs.tsx` — a guided flow

---

## 1. Voice & tone

Write for a non-technical person standing on a customer's roof.

- **Name things by what they do, not how they're built.** "Inverter monitor",
  not "gateway". "Smart plug", not "smart device / provider".
- **Say what a button does, then confirm it happened.** "Connect the monitor" →
  "Connected". "Add a smart plug" → "Plug added. It'll start reporting shortly."
- **Errors say what went wrong and the next step.** No stack traces, no
  "Error: 422". "Couldn't reach the plugs — check they're online in the Smart
  Life app, then try again."
- **Sentence case everywhere.** No `ALL-CAPS MICRO LABELS`.
- **Short.** One idea per line. If a sentence needs a comma-spliced clause to
  explain a concept, the concept probably shouldn't be on the primary screen.

## 2. System term → what we show the user

| System / model term        | Say instead              |
|----------------------------|--------------------------|
| gateway device             | Inverter monitor         |
| energy meter               | Whole-home meter         |
| smart device               | Smart plug               |
| provider device ID         | Plug code                |
| ingest mode                | How often we check it    |
| circuit / bus              | "what it's wired to"     |
| `inverter_backup`          | Inverter (the default)   |
| `grid_direct`              | Grid                     |
| `ev_line`                  | EV                       |
| mirror / relay pairing     | "routed through the monitor" / "backed up by" |
| device serial              | keep, but prefix: "Monitor GRG-04" |
| heartbeat / last_seen      | "last update 4 minutes ago" |
| provisioning               | "setting it up"          |

If you introduce a new system concept, add its row here in the same PR.

## 3. Status vocabulary

Five states. **"Not set up yet" is amber, never red** — nothing is broken, it
just hasn't been done.

| State            | Colour token | Meaning                                    |
|------------------|--------------|--------------------------------------------|
| Connected        | `good` green | Hardware attached and configured           |
| Live             | `good` green | Actively reporting data right now          |
| Not set up yet   | `wait` amber | Expected, not done — a task, not a fault   |
| Needs attention  | `wait` amber | Was working, stopped reporting             |
| Not reporting    | `wait` amber | Same, for an individual device row         |

Red (`#e5484d`) is reserved for **destructive confirmations only** (remove /
disconnect), never for configuration state.

## 4. Visual tokens

All from `useTokens(isDark)` in `ui.tsx`. Never hard-code a hex in a screen.

- Surfaces: `card` (raised), `card2` (inset rows), `idleBg` (neutral fill)
- Text: `ink` (primary), `ink2` (secondary / hints)
- Lines: `line` (borders), `line2` (internal dividers)
- Semantic: `good` / `goodBg` / `goodInk`, `wait` / `waitBg` / `waitInk`
- Type: headings `head` (`'Outfit'`), body `body` (`'DM Sans'`) — both already
  loaded in `index.html`
- Radii: cards `18`, rows/controls `12–14`, chips/pills `999`
- Card entrance: `fs-rise`, staggered by `index * 60ms`

## 5. Patterns to use

- **`SetupShell`** — page wrapper. Friendly heading ("Let's get GRG-04
  monitored"), one-line sub, optional `progress={{done, total}}` → "3 of 4 done".
- **`SetupCard`** — one concern per card: icon, plain title, one-line *purpose*,
  a `StatusChip`, and a single primary `action`.
- **`Item`** — icon-first row. Lead with the **appliance icon**, then the name,
  then a plain-language status line. Secondary actions live behind a `⋯` menu,
  never as a row of buttons.
- **`Flow`** — guided composer. **Closed by default**, opens in place with an
  `✕`, reads as numbered questions (`FlowStep`), exactly one primary button in
  the footer. Every expandable thing has a way back.
- **`ChoiceGrid` / `RadioCards`** — tappable choices for any short fixed set
  (appliances, "which part of the home"). Use instead of a `<select>` of jargon.
- **`DetailsToggle`** — "Advanced details" expander. Device codes, ingest mode,
  device kind, display-name overrides all live *inside* this, collapsed.
- **`InlineConfirm`** — replaces `window.confirm`. Buttons say "Keep it" /
  "Remove", shown as a sticky bar, not a modal.
- **`EmptyState`** — dashed card, one headline, one detail line, optional single
  action. Calm, not an alarm.

## 6. Anti-patterns (do not ship)

- Monospace device IDs / serials in the primary view — hide behind Advanced details
- `UPPERCASE` field labels or eyebrows
- Always-open forms — everything editable opens from a trigger and closes again
- `window.confirm` / `window.alert` / `window.prompt` for anything routine
- Red for "not configured" / "no data yet"
- Schematic / wiring-diagram metaphors, connection "spines", panel "ledgers"
- A row of 3+ inline action buttons — collapse into the `⋯` menu
- Raw API error strings surfaced to the user

## 7. When a screen genuinely needs density

Dashboards and tables are scanned, not read. The friendly voice still applies to
labels, statuses, and empty states, but you may use tighter rows and inline
controls. Keep semantic colour (good / wait) doing the "what needs attention"
work at a glance.
