# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** 360Watts Smart Solar
**Generated:** 2026-03-18 06:44:25
**Category:** Smart Home/IoT Dashboard

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E293B` | `--color-primary` |
| Secondary | `#334155` | `--color-secondary` |
| CTA/Accent | `#22C55E` | `--color-cta` |
| Background | `#0F172A` | `--color-background` |
| Text | `#F8FAFC` | `--color-text` |

**Color Notes:** Dark tech + status green

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** friendly, modern, saas, clean, approachable, professional
- **Google Fonts:** [Plus Jakarta Sans + Plus Jakarta Sans](https://fonts.google.com/share?selection.family=Plus+Jakarta+Sans:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #22C55E;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #1E293B;
  border: 2px solid #1E293B;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #0F172A;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1E293B;
  outline: none;
  box-shadow: 0 0 0 3px #1E293B20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Dark Mode (OLED)

**Keywords:** Dark theme, low light, high contrast, deep black, midnight blue, eye-friendly, OLED, night mode, power efficient

**Best For:** Night-mode apps, coding platforms, entertainment, eye-strain prevention, OLED devices, low-light

**Key Effects:** Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus

### Page Pattern

**Pattern Name:** Horizontal Scroll Journey

- **Conversion Strategy:** Immersive product discovery. High engagement. Keep navigation visible.
28,Bento Grid Showcase,bento,  grid,  features,  modular,  apple-style,  showcase", 1. Hero, 2. Bento Grid (Key Features), 3. Detail Cards, 4. Tech Specs, 5. CTA, Floating Action Button or Bottom of Grid, Card backgrounds: #F5F5F7 or Glass. Icons: Vibrant brand colors. Text: Dark., Hover card scale (1.02), video inside cards, tilt effect, staggered reveal, Scannable value props. High information density without clutter. Mobile stack.
29,Interactive 3D Configurator,3d,  configurator,  customizer,  interactive,  product", 1. Hero (Configurator), 2. Feature Highlight (synced), 3. Price/Specs, 4. Purchase, Inside Configurator UI + Sticky Bottom Bar, Neutral studio background. Product: Realistic materials. UI: Minimal overlay., Real-time rendering, material swap animation, camera rotate/zoom, light reflection, Increases ownership feeling. 360 view reduces return rates. Direct add-to-cart.
30,AI-Driven Dynamic Landing,ai,  dynamic,  personalized,  adaptive,  generative", 1. Prompt/Input Hero, 2. Generated Result Preview, 3. How it Works, 4. Value Prop, Input Field (Hero) + 'Try it' Buttons, Adaptive to user input. Dark mode for compute feel. Neon accents., Typing text effects, shimmering generation loaders, morphing layouts, Immediate value demonstration. 'Show, don't tell'. Low friction start.
- **CTA Placement:** Floating Sticky CTA or End of Horizontal Track
- **Section Order:** 1. Intro (Vertical), 2. The Journey (Horizontal Track), 3. Detail Reveal, 4. Vertical Footer

---

## Backend API Reference

**Base URL:** `https://api.360watts.com` (Cloudflare → Railway, TLS 1.2+)

**Auth:** User JWT (`Bearer <token>`) via `/api/auth/login/`. Device JWT separate (365-day, ESP32 only).

### Telemetry Endpoints

| Endpoint | Behaviour |
|----------|-----------|
| `GET /api/sites/<id>/telemetry/` | Raw or 15-min aggregated; query param `?start=&end=&aggregate=15min\|none` |
| `GET /api/sites/<id>/history/` | Always 15-min buckets (CAGG-backed); best for multi-day chart data |
| `POST /api/devices/<id>/telemetry/` | Device ingest — write-ahead to TimescaleDB, then DynamoDB (legacy) |

**Data source (as of 2026-04):** All telemetry reads come from **TimescaleDB** (`TelemetryRaw` hypertable + `telemetry_15min` CAGG). DynamoDB is no longer queried by the frontend-facing endpoints.

### Key Telemetry Fields (`normalised` payload)

| Field | Unit | Notes |
|-------|------|-------|
| `pv1_power_w` | W | PV string 1; zero when inverter in standby |
| `pv2_power_w` | W | PV string 2 |
| `grid_power_w` | W | Positive = import, negative = export |
| `ac_output_power_w` | W | Load power |
| `battery_soc_percent` | % | State of charge |
| `battery_power_w` | W | Positive = charging |
| `pv_today_kwh` | kWh | Daily generation counter |
| `load_today_kwh` | kWh | Daily load counter |
| `grid_buy_today_kwh` | kWh | Daily import |
| `grid_sell_today_kwh` | kWh | Daily export |
| `timestamp` | ISO 8601 UTC | Bucket end time for aggregated records |
| `sample_count` | int | Present in 15-min buckets; raw rows omit this |

### Aggregation Behaviour

- Range ≤ 6 h and `aggregate=none` → raw rows (~5 s cadence)
- Range > 6 h or `aggregate=15min` → 15-min CAGG buckets
- Bucket timestamp is **end of window** (e.g. "11:00" = 10:45–10:59 data)

---

## Anti-Patterns (Do NOT Use)

- ❌ Slow updates
- ❌ No automation

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
