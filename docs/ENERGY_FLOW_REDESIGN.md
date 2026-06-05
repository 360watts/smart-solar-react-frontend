# Energy Flow Dashboard Redesign

**Status:** Design approved for implementation  
**Last Updated:** Jun 3, 2026  
**Figma File:** [Energy Flow Dashboard Redesign](https://www.figma.com/design/2nNCMhHNfDoSmYdh6Mfdo0)

## Overview

Redesign of the energy flow visualization from a 4-corner cross layout (current) to a **hierarchical left-to-right layout** that scales naturally as smart device monitoring expands. Primary user: **Operations/maintenance staff** performing diagnostics and anomaly detection.

---

## Visual Architecture

### Layout Structure

```
┌────────────────────────────────────────────────────┐
│  MAIN FLOW (Hierarchical Left-to-Right)            │
├──────────────┬──────────────┬──────────────┬──────┤
│ Generation   │ Storage      │ Management   │ Load │  Consumption
│              │              │              │      │  
│ ☀️ PV        │ 🔋 Battery   │ ⚡ Hub       │ 🏠   │  Grid ↔
│ 5.3 kW       │ -2.1 kW      │ 0.4 kW       │ 3.2kW│  -0.6 kW
│              │              │              │      │
│ Online       │ Online       │ Online       │Onlin │  Online
└──────────────┴──────────────┴──────────────┴──────┘
         ↓            ↓             ↓           ↓
     [Flow arrows with magnitude indicators]
     
┌────────────────────────────────────────────────────┐
│  SMART DEVICES (Expandable Grid)                   │
├──────────────┬──────────────┬──────────────┬───────┤
│ 🔌 EV        │ 💧 Geyser    │ ❄️ AC Unit   │ 💨   │  Water Pump
│ 7.5 kW       │ 2.3 kW       │ 0 W          │ 0.5kW │
│ Online       │ Online       │ ⚠ Offline    │Onlin  │  (Plus more devices as registered)
│              │              │ (Red border) │       │
└──────────────┴──────────────┴──────────────┴───────┘
```

---

## Component Design

### Device Card (120×140px)

**Structure:**
- Background: White card with 8px rounded corners, 1px border (or 2.5px red if anomalous)
- Icon: 32px emoji or glyph (☀️ ⚡ 🏠 etc.)
- Name: 11px, semibold
- Power: 18px bold, real-time value (e.g., "5.3")
- Unit: 9px right-aligned (e.g., "kW" or "W")
- Status badge: 100×20px, rounded 4px
  - **Online:** Green background `#19AC24`, white text
  - **Offline:** Red background `#EF4444`, white text

**Anomaly Highlighting:**
- Border: 2.5px red `#EF4444` (instead of 1px gray)
- Glow effect: Drop shadow with red color, 8px radius, 0.25 alpha, (0, 2) offset
- Remains highlighted until issue resolved

### Flow Arrows

**Visual:**
- Solid line, 3px stroke, green color `#20B835`
- Direction: Left to right (source → destination)
- **Magnitude indicator:** Stroke width or opacity scales with power flow (future enhancement)

### Expandable Side Panel

**Default state:** Hidden (not visible until user clicks a device)

**Expanded state:** 
- Slide-in from right, 40-45% screen width
- Position: Overlays main flow (z-index higher)
- Background: White, 8px rounded corners, 1px gray border
- Animation: Smooth 300ms slide

**Panel sections (top to bottom):**

1. **Header** (20px height)
   - Device name + status (e.g., "AC Unit — Offline")
   - Close button (✕) top-right
   - Keyboard shortcut: ESC to close

2. **Health Status Section** (0-60px)
   - Label: "HEALTH STATUS" (10px, gray)
   - Badge: Status (Online/Offline), color-coded
   - Metrics: Temperature, Last Seen, Signal Strength (if applicable)

3. **Real-Time Metrics Section** (60-130px)
   - Label: "REAL-TIME METRICS" (10px, gray)
   - Grid: 2-column layout
     - Power (W)
     - Current (A)
     - Voltage (V)
     - Any device-specific metrics

4. **24h Trend Section** (130-200px)
   - Sparkline chart showing power over 24h
   - X-axis: Hours (00:00 → 24:00 IST)
   - Y-axis: Power (W or kW, auto-scaled)
   - Color: Green line, filled area below with 0.2 alpha

5. **Detailed Info / Scrollable Section** (200px+)
   - Energy totals (kWh today, weekly, monthly)
   - Fault history (if applicable)
   - Related alerts
   - Recent logs

**Closing:** Click ✕ or press ESC. Panel closes, device card remains highlighted.

### Alert Banner (Critical Anomalies)

**Trigger:** 
- Device offline > 5 minutes
- Temperature > 75°C
- Other critical thresholds (configurable)

**Appearance:**
- Position: Top of dashboard (below title)
- Height: 50px
- Background: Light red `#F8ECEC`
- Border: 1.5px red `#EF4444`
- Content: Icon (⚠) + message (e.g., "AC Unit offline for 5 min") + action link ("Switch to Diagnostic View")

**Behavior:**
- Does NOT auto-open side panel
- Draws attention visually (banner is above the fold)
- Click banner → Opens side panel for that device
- Dismissible (✕ button), but reappears if anomaly persists

---

## Interactions & User Flows

### Default View (Flow Only)

1. **Page loads:** Energy flow diagram displays with all online devices in green
2. **Device status changes:** Card border/status badge updates in real-time
3. **Anomaly detected:** Red border appears, banner shows at top (if critical)
4. **User sees:** Instant visual cue that something is wrong

### Expanding a Device

1. **User clicks a device card** → Side panel slides in (300ms animation)
2. **Panel shows:**
   - Health status (online/offline, temp, last seen)
   - Real-time metrics (power, current, voltage)
   - 24h trend sparkline
   - Related alerts
3. **User investigates:** Reads metrics, spots trends, identifies issue
4. **User closes:** Click ✕ or press ESC → Panel slides out

### Smart Auto-Switch (Diagnostic Suggestion)

1. **Critical anomaly detected** → Banner appears with "Switch to Diagnostic View" CTA
2. **Banner is NOT intrusive:** 
   - Operations can ignore it (visual cue on device card is enough)
   - Or click "Switch to Diagnostic View" → Opens side panel + highlights detailed alerts
3. **Flow:** Visual highlight → Banner → Detailed investigation path (user chooses)

---

## Data Requirements

### From API

Each device card needs real-time:
- `device_id`
- `name` (or `display_name`)
- `power_w` (current instantaneous power)
- `status` ("online" or "offline")
- Optionally: `temperature_c`, `last_seen_timestamp`

Side panel needs historical:
- `power_w` (for 24h trend, last 288 data points at 5min intervals)
- `current_a`, `voltage_v`, `energy_kwh`
- Any fault/alert history

### SmartDevice Integration

**Data model ready:**
- `SmartDevice.device_type`: tuya_plug, tuya_switch, ct_clamp, modbus_meter
- `SmartDevice.appliance_label`: ev_charger, geyser, ac_unit, water_pump, washing_machine, other
- `SmartDeviceReading.power_w`, `current_a`, `voltage_v`, `energy_kwh`, `switch_on`, `timestamp`
- Index on `(device, -timestamp)` for efficient 24h range queries

**Future expansion ready:**
- New `device_type` values slot seamlessly
- New `appliance_label` values auto-render with new icons
- Multi-device per appliance (e.g., 2× AC units) scales in grid

---

## Colors & Typography

### Color Palette

| Use Case | Color | Hex |
|----------|-------|-----|
| Online status badge | Green | `#19AC24` |
| Offline / Anomaly | Red | `#EF4444` |
| Power flow arrows | Green | `#20B835` |
| Solar / Generation | Amber | `#E9B949` |
| Grid import | Blue | `#3B82F6` |
| Card borders (normal) | Light gray | `#D9D9D9` |
| Card borders (anomaly) | Red | `#EF4444` |
| Background (light mode) | White | `#FFFFFF` |
| Background (dark mode) | Dark gray | `#1F2937` |

### Typography

- **Device card name:** 11px, regular weight
- **Power value:** 18px, bold weight (600+)
- **Unit:** 9px, regular weight
- **Status badge:** 9px, white, center-aligned
- **Panel title:** 14px, bold weight
- **Section label:** 9px, gray, uppercase
- **Metrics:** 10px, regular weight

---

## Responsive Design

### Desktop (≥1200px)
- Flow diagram: Full width (left side)
- Side panel: 40-45% width, visible when expanded (right side)
- Smart devices grid: 5 cards per row (EV, Geyser, AC, Water Pump, Washer)

### Tablet (768px–1199px)
- Flow diagram: Full width (stacked vertically)
- Side panel: Full-width modal overlay (40-45% width, centered, with backdrop)
- Smart devices grid: 3 cards per row
- Press ESC or click backdrop to close panel

### Mobile (<768px)
- Flow diagram: Single-column (vertical scroll)
- Side panel: Full-screen modal (100% width)
- Smart devices: 2 cards per row, stacked on scroll
- Close with ✕ button or back gesture

---

## Implementation Checklist

### Phase 1: Core Layout Refactor
- [ ] Replace current `EnergyFlowBlock` (4-corner cross) with new hierarchical layout
- [ ] Implement device card component (reusable, accepts device data)
- [ ] Add green flow arrows with animation
- [ ] Position core devices (PV, Battery, Hub, Load, Grid) left-to-right
- [ ] Add smart devices grid below main flow

### Phase 2: Expandable Panel
- [ ] Create side panel component (drawer/modal)
- [ ] Implement health status section
- [ ] Add real-time metrics grid
- [ ] Implement 24h trend sparkline chart
- [ ] Add close interaction (✕, ESC, click-outside)

### Phase 3: Anomaly Detection
- [ ] Add anomalous device highlighting (red border + glow)
- [ ] Implement alert banner for critical anomalies
- [ ] Wire up real-time status updates from API
- [ ] Test offline device detection

### Phase 4: Polish & Optimization
- [ ] Dark mode support (token colors)
- [ ] Responsive design (tablet, mobile)
- [ ] Accessibility (a11y labels, keyboard nav)
- [ ] Performance: Memoization, lazy loading for 24h trend
- [ ] Animation refinements (slide-in easing, highlight transitions)

### Phase 5: SmartDevice Integration
- [ ] Fetch `SmartDevice` records from API
- [ ] Render additional appliance cards dynamically
- [ ] Display real-time `SmartDeviceReading` power values
- [ ] Support future device types (tuya_switch, ct_clamp, etc.)

---

## Testing

### Unit Tests
- Device card renders with correct power, status, anomaly state
- Panel opens/closes with correct animation
- Trend sparkline renders with historical data
- Colors/badges respond to online/offline state

### Integration Tests
- Flow updates in real-time as API data arrives
- Side panel stays in sync with selected device
- Banner appears/disappears with critical anomalies
- Responsive layout works on tablet/mobile

### Manual Testing
- Offline device: Verify red border + banner appear
- Panel expansion: Click device → panel slides in, device stays highlighted
- Keyboard: Press ESC → panel closes
- Dark mode: Colors readable and on-brand
- Mobile: Full-screen modal, close button accessible
- Future devices: Add new SmartDevice via Django admin → Card appears automatically

---

## Future Enhancements

1. **Animated flow magnitude:** Arrow stroke width or opacity scales with power (kW)
2. **Tap to toggle views:** Single tap opens panel, long-tap shows quick metrics overlay
3. **Predictive alerts:** "Load spike incoming" based on forecast vs. actual
4. **Custom device grouping:** User-defined "appliance groups" (e.g., "HVAC" = AC + Water Pump)
5. **Export energy flow snapshots:** Save current flow state as image for reports
6. **Integration with fault detection:** Highlight devices involved in triggered faults
7. **Per-device settings:** Click gear icon to configure device polling interval, alert thresholds

---

## Notes

- **Database ready:** `SmartDevice` + `SmartDeviceReading` models support all future appliance types without schema changes
- **API ready:** `/sites/{id}/ev-plug/latest/` pattern replaces with generic `/sites/{id}/smart-devices/` to fetch all devices
- **Performance:** 24h trend queries use index on `(device, -timestamp)` for O(log n) range scans
- **Backward compatibility:** Current EV plug card logic preserved; new smart devices simply extend the same pattern
