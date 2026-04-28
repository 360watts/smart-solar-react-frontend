# Fleet Health Report - Visual Walkthrough

## Tab Appearance

The Fleet Health tab appears as the 4th tab in the Alerts component:

```
┌─────────────────────────────────────────────────────────┐
│ [Overview] [All Alerts] [Analytics] [Fleet Health]     │
│                                       ↑ New tab
└─────────────────────────────────────────────────────────┘
```

Icon: ❤️ (Heart icon from lucide-react)

---

## Full Page Layout

### Section 1: Date Picker & Controls

```
┌──────────────────────────────────────────────────────────────┐
│ Date: [2026-04-27]  Leave empty for latest report  [Latest]  │
└──────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Click date field to change date (YYYY-MM-DD format)
- Click "Latest" button to clear date and fetch latest report
- Report auto-fetches when date changes
- Shows loading spinner while fetching

---

### Section 2: Fleet Summary Cards (Responsive Grid)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Health Status   │  │ Total Alerts    │  │ Critical        │
│ 🔴 Critical     │  │ 15              │  │ 2               │
└─────────────────┘  └─────────────────┘  └─────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Warnings        │  │ Unresolved      │  │ RS-485 Stale    │
│ 8               │  │ 5               │  │ 3               │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Card Styling:**
- Health Status card has tinted background (red/yellow/green depending on status)
- Each metric card shows icon in top-right corner
- Bold number display (1.5rem, monospace font)
- Subtitle text in secondary color

**Health Status Colors:**
- 🔴 Critical (red) - `critical_alerts > 0`
- 🟡 Warning (orange) - `warning_alerts > 0` OR `rs485_stale_events > 0`
- ⚫ Failed (black) - `complete_failures > 0`
- 🟢 Healthy (green) - All clear

---

### Section 3: Report Metadata

```
┌────────────────────────────────────────────────────────┐
│ Report Date: 2026-04-27                                │
│ Window: Apr 27, 2026 - Apr 27, 2026                    │
│ Generated: 10:00:45                                     │
│ Last Accessed: Apr 28, 04:15:30                         │
└────────────────────────────────────────────────────────┘
```

---

### Section 4: Site Breakdown Table

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 Site Breakdown  (2 sites)                                                │
├────┬──────────┬────────┬─────────┬─────────┬──────────┬────────┬──────────┤
│    │ Site ID  │ Status │ Devices │ Records │ Complete │ Alerts │ Largest  │
│    │          │        │         │         │  %       │        │ Gap      │
├────┼──────────┼────────┼─────────┼─────────┼──────────┼────────┼──────────┤
│ ▼  │ site_001 │ 🔴     │ 2       │ 9960    │ 97.6%    │ 5      │ 15.3m    │  ← Expandable
│ ─  │ SERIAL_001│ 🟢    │ Online  │ 5760    │ 100.0%   │ 2      │ rs485... │  ← Device rows
│ ─  │ SERIAL_002│ 🔴    │ Offline │ 4200    │ 95.2%    │ 3      │ offline..│
├────┼──────────┼────────┼─────────┼─────────┼──────────┼────────┼──────────┤
│ ▶  │ site_002 │ 🟢     │ 1       │ 5760    │ 100.0%   │ 0      │ 0.0m     │  ← Collapsed
└────┴──────────┴────────┴─────────┴─────────┴──────────┴────────┴──────────┘
```

**Features:**
- Left column shows expand/collapse chevron (▶/▼)
- Sites sorted by alert count (highest first)
- Click any part of row to expand
- Site row highlighted when expanded
- Device rows indented and have different background color
- Device rows shown only when site is expanded

**Status Icons:**
- 🟢 Green - All devices online, no alerts
- 🟡 Yellow - Some devices offline OR has warnings
- 🔴 Red - Device(s) offline OR critical alerts

---

### Section 5: Issues Summary (if any issues exist)

```
┌────────────────────────────────────────────────────────┐
│ ⚠️  Issues Detected  (2 issues)                         │
├────────────────────────────────────────────────────────┤
│ ⚫ site_001: device offline (last heartbeat 2026-04-27)│
│ 🟡 site_001: RS-485 stale count = 2                    │
└────────────────────────────────────────────────────────┘
```

**Styling:**
- Alert-style box with left border (orange or dark depending on severity)
- Issue text as provided by backend
- Severity emoji at start of text

---

## Interaction Flow

### Expanding a Site

1. **Initial state:** All sites collapsed
   ```
   ▶ site_001
   ▶ site_002
   ```

2. **Click site_001 row:** Site expands to show devices
   ```
   ▼ site_001
   ─ SERIAL_001 (device details...)
   ─ SERIAL_002 (device details...)
   ▶ site_002
   ```

3. **Click site_001 again:** Site collapses
   ```
   ▶ site_001
   ▶ site_002
   ```

### Changing Date

1. **User clicks date input** → Calendar picker appears
2. **Select new date** → Input updates to YYYY-MM-DD
3. **Input change detected** → useEffect fires
4. **API called** → Loading spinner appears
5. **Report received** → Page updates with new data
6. **Sites reset** → All sites collapsed (expandedSites Set cleared)

### Loading State

When report is loading:
```
┌────────────────────────────────────────┐
│ Loading...                             │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└────────────────────────────────────────┘
```

### Error State

If API call fails:
```
┌────────────────────────────────────────┐
│ ❌ Error loading fleet health:          │
│ Failed to load report                  │
└────────────────────────────────────────┘
```

### Empty State

If no devices in report:
```
┌────────────────────────────────────────┐
│ No devices in report.                  │
└────────────────────────────────────────┘
```

---

## Mobile Responsive Behavior

### Mobile (< 768px width)

**Summary Cards:**
- Stack vertically (1 card per row)
- Full width with padding

**Table:**
- Horizontal scroll enabled
- Minimum width maintained
- Chevron icons smaller

**Date Picker:**
- Full width date input
- Controls wrap to next line

**Text:**
- Smaller font sizes (0.75rem - 0.875rem)
- Condensed padding

---

## Color Scheme Reference

**Health Status:**
- 🔴 Critical Red: `#EF4444` (rgb(239, 68, 68))
- 🟡 Warning Orange: `#F59E0B` (rgb(245, 158, 11))
- 🟢 Healthy Green: `#10B981` (rgb(16, 185, 129))
- ⚫ Failed Black: `#000000`
- Primary Purple: `#6366F1` (rgb(99, 102, 241))

**Backgrounds:**
- Primary card: `tok.bgCard(isDark)` (light: #FFFFFF, dark: #1E293B)
- Subtext card: `tok.bgSub(isDark)` (light: #F8FAFC, dark: #0F172A)
- Muted: `tok.bgMuted(isDark)` (light: #F3F4F6, dark: rgba(255,255,255,0.04))

**Text:**
- Primary: `tok.textPrimary(isDark)` (light: #0F172A, dark: #F8FAFC)
- Secondary: `tok.textSecondary(isDark)` (light: #64748B, dark: #94A3B8)
- Muted: `tok.textMuted(isDark)` (light: #94A3B8, dark: #64748B)

---

## Example Scenarios

### Scenario 1: Healthy Fleet

```
Cards show:
- Health Status: 🟢 Healthy
- Total Alerts: 0
- Critical: 0
- Warnings: 0
- RS-485 Stale: 0

Table shows:
- All sites with 🟢 status
- All devices Online
- 0 alerts per device
- 100% data completeness

Issues section:
- Not displayed (no issues)
```

### Scenario 2: Fleet with Warnings

```
Cards show:
- Health Status: 🟡 Warning
- Total Alerts: 8
- Critical: 0
- Warnings: 8
- RS-485 Stale: 3

Table shows:
- site_001: 🟡 status (has RS-485 stale)
- site_002: 🟢 status (all clear)
- Device rows show alert counts

Issues section:
- Shows RS-485 stale warnings
- Shows device offline issues
```

### Scenario 3: Critical Fleet Issues

```
Cards show:
- Health Status: 🔴 Critical
- Total Alerts: 15
- Critical: 2
- Warnings: 8
- RS-485 Stale: 3

Table shows:
- site_001: 🔴 status (has offline devices)
- site_002: 🟡 status (has warnings)
- Multiple devices shown as Offline
- High alert counts

Issues section:
- Shows complete device failures
- Shows offline devices
- Shows RS-485 freeze conditions
```

---

## Data Display Examples

### Device Detail Row

```
─ SERIAL_A1B2C3    🔴    Offline    4200    95.2%    3    rs485_stale, device_offline
```

**Fields:**
- Serial (monospace, small font, may truncate with ellipsis)
- Online status icon (🟢/🔴)
- Text "Online" or "Offline"
- Record count (right-aligned, monospace)
- Completeness percentage (right-aligned)
- Alert count (right-aligned, red if > 0)
- Alert codes (comma-separated, truncated with ellipsis if long)

### Alert Codes Display

If device has alerts in `alerts.by_fault_code`:
- **Single alert:** `device_offline`
- **Multiple alerts:** `rs485_stale, device_offline`
- **No alerts:** `—` (em dash)

---

## Accessibility Features

✅ **Semantic Structure**
- Table headers with semantic meaning
- Expandable sections with clear state
- Color + icon for status (not color alone)

✅ **Keyboard Navigation**
- Tab key cycles through all interactive elements
- Enter/Space to expand/collapse sites
- Date input keyboard accessible

✅ **Screen Readers**
- Site rows announce "Expanded" / "Collapsed" state
- Device count read aloud
- Alert badges read as numbers
- Emoji descriptions via text content

✅ **Color Contrast**
- All text meets WCAG AA standards
- Dark mode support included
- Emoji used in addition to color

---

## Performance Characteristics

**Rendering:**
- Initial render: ~300-500ms (50 devices)
- State update (expand/collapse): <50ms
- Report loaded and cached in state

**DOM Elements:**
- ~50 devices = ~150-200 DOM nodes
- No virtualization (suitable for <100 devices)
- Reflow on expand/collapse (minimal impact)

**API Calls:**
- One call when tab activated
- One call per date change
- No polling or auto-refresh

**Memory:**
- Single report object in state
- Set of expanded site IDs (one string per site)
- ~15-30KB for typical 50-device report
