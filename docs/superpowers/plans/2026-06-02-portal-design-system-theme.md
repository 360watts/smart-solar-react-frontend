# Portal Design System Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 360watts Design System (Solar Green `#2FBF71` primary, Amber `#E9B949` secondary) consistently across the entire customer portal, replacing all off-brand indigo/purple/old-green hardcoded values with a scalable token architecture.

**Architecture:** A single `portalTokens.ts` file exports typed JS token constants that mirror the CSS custom properties in `src/index.css`. Every portal component calls `getTokens(isDark)` to get the full token set for inline styles. CSS classes (Tailwind + App.css) pull from CSS vars in `src/index.css`. These two layers stay in sync by design.

**Tech Stack:** React 18 + TypeScript, Tailwind v4 (via `src/index.css`), CSS custom properties, inline styles for portal components.

---

## Token Colour Reference

| Token | Value | Use |
|-------|-------|-----|
| `primary` | `#2FBF71` | CTAs, active nav, borders, focus rings |
| `primaryDark` | `#1A9955` | Gradient end, hover darken |
| `primaryLight` | `#4DD68A` | Gradient highlight |
| `amber` | `#E9B949` | Solar/energy values, secondary accents, sun logo |
| `amberDark` | `#C9983A` | Amber hover/darken |
| `success` | `#34D399` | Online/healthy status |
| `warning` | `#F59E0B` | Warning alerts (semantic, unchanged) |
| `error` | `#EF4444` | Error/danger (unchanged) |
| `info` | `#3B82F6` | Info badges (unchanged) |

## CSS Load Order (active files only)

```
main.jsx
  └── src/index.css          ← Tailwind v4 + :root + .dark-mode CSS vars  [MODIFY]
        └── @import "tailwindcss"

app/App.tsx
  └── src/App.css            ← Brand vars + all component CSS (8989 lines) [MODIFY]

features/quotation/QuotationPage.tsx + QuotationHistoryPage.tsx
  └── src/features/quotation/quotation.css                                  [MODIFY]

Portal pages (PortalLayout, PortalOverview, PortalDevice, etc.)
  └── inline <style> tags + inline style={{}} props                         [MODIFY]
```

**Dead code (never imported — do not touch, but safe to delete later):**
`src/TopNavbar.css`, `src/MobileSidebarOverrides.css`, `src/styles/theme.css`,
`src/styles/index.css`, `src/styles/tailwind.css`, `src/styles/fonts.css`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **CREATE** | `src/features/portal/styles/portalTokens.ts` | JS token constants + `getTokens(isDark)` helper |
| **MODIFY** | `src/index.css` | Fix `:root` and `.dark-mode` CSS vars — primary/secondary/accent |
| **MODIFY** | `src/App.css` `:root` block | Update brand-green, secondary-color, success, solar vars |
| **MODIFY** | `src/App.css` body | Replace 59× hardcoded indigo/purple/blue rgba with green |
| **MODIFY** | `src/shared/layout/PortalLayout.tsx` | `PORTAL_STYLES` injected CSS + sidebar accent colors |
| **MODIFY** | `src/features/portal/PortalOverview.tsx` | KPI cards, site selector, loader, energy values |
| **MODIFY** | `src/features/portal/PortalDevice.tsx` | Device info, loader, status colors |
| **MODIFY** | `src/features/portal/PortalAlerts.tsx` | Alert timeline, loader, status colors |
| **MODIFY** | `src/features/portal/PortalProfile.tsx` | Avatar gradients, accent colors |
| **MODIFY** | `src/features/portal/PortalChat.tsx` | FAB button, chat header |
| **MODIFY** | `src/features/portal/security/styles.ts` | Icon box + button colors |
| **MODIFY** | `src/features/quotation/quotation.css` | Add `--green` token so `var(--green, #00a63e)` picks up design system value |

---

## Task 1: Create `portalTokens.ts` — the JS design token source of truth

**Files:**
- Create: `src/features/portal/styles/portalTokens.ts`

- [ ] **Step 1.1: Create the directory and file**

```bash
mkdir -p /home/ubuntu/work/smart-solar-react-frontend/src/features/portal/styles
```

- [ ] **Step 1.2: Write `portalTokens.ts`**

```typescript
// src/features/portal/styles/portalTokens.ts
//
// Single source of truth for portal inline-style colours.
// Mirrors CSS custom properties in src/index.css.
// To change a colour: update BOTH this file AND src/index.css.
//
// Usage:
//   const t = getTokens(isDark);
//   <div style={{ background: t.card, color: t.text, borderColor: t.border }} />

// ─── Brand palette ────────────────────────────────────────────────────────────
export const DS = {
  // Primary — Solar Green
  primary:          '#2FBF71',
  primaryDark:      '#1A9955',
  primaryLight:     '#4DD68A',
  primaryGradient:  'linear-gradient(135deg, #2FBF71 0%, #1A9955 100%)',

  // Secondary — Amber (solar energy highlight)
  amber:            '#E9B949',
  amberDark:        '#C9983A',
  amberLight:       '#F0CB6C',
  amberGradient:    'linear-gradient(135deg, #E9B949 0%, #F0CB6C 100%)',

  // Semantic status
  success:          '#34D399',
  warning:          '#F59E0B',
  error:            '#EF4444',
  info:             '#3B82F6',
} as const;

// ─── Alpha helpers ─────────────────────────────────────────────────────────────
export const alpha = {
  primary:  (a: number) => `rgba(47,191,113,${a})`,
  amber:    (a: number) => `rgba(233,185,73,${a})`,
  success:  (a: number) => `rgba(52,211,153,${a})`,
  warning:  (a: number) => `rgba(245,158,11,${a})`,
  error:    (a: number) => `rgba(239,68,68,${a})`,
  info:     (a: number) => `rgba(59,130,246,${a})`,
  white:    (a: number) => `rgba(255,255,255,${a})`,
  black:    (a: number) => `rgba(0,0,0,${a})`,
};

// ─── Surface tokens — theme-aware ─────────────────────────────────────────────
export interface SurfaceTokens {
  bg: string;
  surface: string;
  card: string;
  cardAlt: string;
  border: string;
  borderHover: string;
  text: string;
  textMuted: string;
  textDim: string;
}

export const DARK: SurfaceTokens = {
  bg:          '#080C14',
  surface:     '#0D1422',
  card:        '#0F1623',
  cardAlt:     '#131B2E',
  border:      'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.12)',
  text:        '#F0F4FF',
  textMuted:   '#8892A4',
  textDim:     '#4A5568',
};

export const LIGHT: SurfaceTokens = {
  bg:          '#F4F6F8',
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  cardAlt:     '#F0F4F8',
  border:      'rgba(0,0,0,0.08)',
  borderHover: 'rgba(0,0,0,0.14)',
  text:        '#0A0E1A',
  textMuted:   '#64748B',
  textDim:     '#94A3B8',
};

// ─── Main token accessor ───────────────────────────────────────────────────────
// Call at the top of every portal component:
//   const t = getTokens(isDark);
export const getTokens = (isDark: boolean) => ({
  ...DS,
  alpha,
  ...(isDark ? DARK : LIGHT),
  isDark,
});

export type Tokens = ReturnType<typeof getTokens>;
```

- [ ] **Step 1.3: Verify the file compiles**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
npx tsc --noEmit src/features/portal/styles/portalTokens.ts 2>&1 | head -20
```

Expected: no errors (or only "cannot find module" for ambient types — that's fine).

- [ ] **Step 1.4: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/features/portal/styles/portalTokens.ts
git commit -m "feat(portal): add portalTokens.ts — design system JS token source of truth"
```

---

## Task 2: Update `src/index.css` — Tailwind CSS vars to design system

**Files:**
- Modify: `src/index.css`

The `:root` block currently uses `oklch(0.205 0 0)` (near-black) for `--primary` and `oklch(0.97 0 0)` (light gray) for `--secondary`. Replace with design system values.

- [ ] **Step 2.1: Replace the entire `:root` block**

Find this block in `src/index.css` (starts at line ~41):
```css
:root {
  /* Light tokens */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  ...
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  ...
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
```

Replace with:
```css
:root {
  /* Light mode — 360watts Design System */
  --background: #F4F6F8;
  --foreground: #12151A;
  --card: #FFFFFF;
  --card-foreground: #12151A;
  --popover: #FFFFFF;
  --popover-foreground: #12151A;
  --primary: #2FBF71;
  --primary-foreground: #FFFFFF;
  --secondary: #E9B949;
  --secondary-foreground: #12151A;
  --muted: #ECEFF1;
  --muted-foreground: #717182;
  --accent: #E9B949;
  --accent-foreground: #12151A;
  --destructive: #EF4444;
  --destructive-foreground: #FFFFFF;
  --border: rgba(0,0,0,0.1);
  --input: rgba(0,0,0,0.07);
  --ring: #2FBF71;
  /* Design system extended palette */
  --green: #2FBF71;
  --green-soft: rgba(47,191,113,0.1);
}
```

- [ ] **Step 2.2: Replace the `.dark-mode` block**

Find:
```css
.dark-mode {
  /* Dark tokens */
  /* Unified dark app background (matches customer + staff portal) */
  --background: #080C14;
  --foreground: oklch(0.985 0 0);
  --card: #0F1623;
  ...
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  ...
}
```

Replace with:
```css
.dark-mode {
  /* Dark mode — 360watts Design System */
  --background: #080C14;
  --foreground: #F0F4FF;
  --card: #0F1623;
  --card-foreground: #F0F4FF;
  --popover: #0F1623;
  --popover-foreground: #F0F4FF;
  --primary: #2FBF71;
  --primary-foreground: #FFFFFF;
  --secondary: #E9B949;
  --secondary-foreground: #0A0E1A;
  --muted: rgba(255,255,255,0.08);
  --muted-foreground: #8892A4;
  --accent: #E9B949;
  --accent-foreground: #0A0E1A;
  --destructive: #EF4444;
  --destructive-foreground: #FFFFFF;
  --border: rgba(255,255,255,0.07);
  --input: rgba(255,255,255,0.1);
  --ring: #2FBF71;
  /* Design system extended palette */
  --green: #2FBF71;
  --green-soft: rgba(47,191,113,0.1);
}
```

- [ ] **Step 2.3: Verify Tailwind @theme inline still maps correctly**

The `@theme inline` block maps `--color-primary: var(--primary)` etc. — these are correct as-is. No changes needed there.

- [ ] **Step 2.4: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/index.css
git commit -m "feat(theme): update Tailwind CSS vars to 360watts design system — primary #2FBF71, secondary #E9B949"
```

---

## Task 3: Update `src/App.css` `:root` — brand color variables

**Files:**
- Modify: `src/App.css` lines 7–136 (the `:root` block)

The `:root` in App.css defines `--brand-green: #00a63e` and many derived values. Update these to design system values.

- [ ] **Step 3.1: Update brand color variables in App.css `:root`**

Find and replace the `:root` block opening color section (lines ~8–136). The exact block starts with `/* ---- 360Watts Brand Colors ---- */` and ends before `/* Background Colors */`:

```css
  /* ---- 360Watts Brand Colors ---- */
  --brand-green:       #2FBF71;
  --brand-green-dark:  #1A9955;
  --brand-green-light: #4DD68A;
  --brand-amber:       #E9B949;
  --brand-amber-dark:  #C9983A;
  --brand-amber-light: #F0CB6C;
  --brand-blue:        #3B82F6;

  /* Primary Colors — 360Watts Solar Green */
  --primary-gradient: linear-gradient(135deg, #2FBF71 0%, #1A9955 50%, #4DD68A 100%);
  --primary-color: #2FBF71;
  --primary-light: #4DD68A;
  --primary-dark: #1A9955;
  --secondary-color: #E9B949;

  /* Solar Theme Colors — Amber palette for energy/power values */
  --solar-gradient: linear-gradient(135deg, #E9B949 0%, #F0CB6C 50%, #C9983A 100%);
  --solar-gold: #E9B949;
  --solar-orange: #E9B949;
  --solar-amber: #E9B949;
```

Find and replace the `--success-color` block:
```css
  /* Status Colors - Balanced & Accessible */
  --success-color: #34D399;
  --success-bg: rgba(52, 211, 153, 0.12);
  --warning-color: #F59E0B;
  --warning-bg: rgba(245, 158, 11, 0.12);
  --danger-color: #EF4444;
  --danger-bg: rgba(239, 68, 68, 0.12);
  --info-color: #3B82F6;
  --info-bg: rgba(59, 130, 246, 0.12);
```

Find and replace the glow shadow section:
```css
  --shadow-glow-primary: 0 0 24px rgba(47, 191, 113, 0.25);
  --shadow-glow-success: 0 0 20px rgba(52, 211, 153, 0.2);
  --shadow-glow-danger: 0 0 20px rgba(239, 68, 68, 0.2);
```

Find and replace the `--cyan` hack section (currently `--cyan: #F07522`):
```css
  /* Secondary Accent — Amber (DS secondary, replaces old --cyan hack) */
  --cyan: #E9B949;
  --cyan-dark: #C9983A;
  --cyan-light: #F0CB6C;
  --cyan-glow: rgba(233, 185, 73, 0.3);
```

Find and replace the neon glow system section:
```css
  /* Glow System — Design System colours */
  --glow-primary: 0 0 20px rgba(47, 191, 113, 0.4), 0 0 60px rgba(47, 191, 113, 0.12);
  --glow-cyan: 0 0 20px rgba(233, 185, 73, 0.4), 0 0 60px rgba(233, 185, 73, 0.12);
  --glow-amber: 0 0 20px rgba(233, 185, 73, 0.4), 0 0 60px rgba(233, 185, 73, 0.12);
  --glow-success: 0 0 20px rgba(52, 211, 153, 0.4), 0 0 60px rgba(52, 211, 153, 0.12);
  --glow-danger: 0 0 20px rgba(239, 68, 68, 0.4), 0 0 60px rgba(239, 68, 68, 0.12);
```

- [ ] **Step 3.2: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/App.css
git commit -m "feat(theme): update App.css :root brand colors to design system palette"
```

---

## Task 4: Sed-replace 59× hardcoded off-brand colors in `src/App.css`

**Files:**
- Modify: `src/App.css` — all occurrences of indigo/purple/blue hardcoded rgba values

These are NOT covered by the `:root` variable changes because they're hardcoded directly (e.g. `box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35)`).

- [ ] **Step 4.1: Replace indigo rgba (primary off-brand color, 59 occurrences)**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
# Indigo rgba with spaces
sed -i 's/rgba(99, 102, 241,/rgba(47, 191, 113,/g' src/App.css
# Indigo rgba without spaces
sed -i 's/rgba(99,102,241,/rgba(47,191,113,/g' src/App.css
# Indigo hex
sed -i 's/#6366f1/#2FBF71/g' src/App.css
```

Verify count went to 0:
```bash
grep -c "99, 102, 241\|99,102,241\|6366f1" src/App.css
```
Expected: `0`

- [ ] **Step 4.2: Replace blue sidebar hover accent**

```bash
# Blue rgba used in sidebar nav hover backgrounds
sed -i 's/rgba(79, 172, 254,/rgba(47, 191, 113,/g' src/App.css
sed -i 's/rgba(79,172,254,/rgba(47,191,113,/g' src/App.css
# Blue hex in select dropdown arrow SVG fill
sed -i "s/fill='%234facfe'/fill='%232FBF71'/g" src/App.css
```

- [ ] **Step 4.3: Replace purple/violet animated background blobs**

```bash
# Purple blobs in body::before backgrounds (2 body::before blocks exist)
sed -i 's/rgba(102, 126, 234,/rgba(47, 191, 113,/g' src/App.css
sed -i 's/rgba(118, 75, 162,/rgba(47, 191, 113,/g' src/App.css
sed -i 's/rgba(139, 92, 246,/rgba(47, 191, 113,/g' src/App.css
```

- [ ] **Step 4.4: Fix OTP focus ring — uses separate `--accent-primary` var hardcoded as comment**

Find in App.css:
```css
.otp-box:focus {
  border-color: var(--accent-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
}
```

The sed commands above already replaced these values. Verify:
```bash
grep "6366f1\|accent-primary" src/App.css
```
Expected: 0 remaining occurrences of `#6366f1` (the `--accent-primary` CSS var name is fine to keep, its fallback is now `#2FBF71`).

If any remain, manually fix:
```css
.otp-box:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(47, 191, 113, 0.18);
}
.otp-box--filled {
  border-color: rgba(47, 191, 113, 0.5);
  background: rgba(47, 191, 113, 0.06);
}
```

Also update auth alt button hover:
```css
.auth-alt-btn:hover:not(:disabled) {
  background: rgba(47, 191, 113, 0.08);
  border-color: rgba(47, 191, 113, 0.35);
  color: var(--text-primary);
}
```

And OTP resend button color:
```css
.otp-resend-btn {
  color: var(--primary-color);
  font-weight: 500;
  margin-left: auto;
}
```

And selection highlight:
```css
::selection {
  background: rgba(47, 191, 113, 0.4);
  color: #ffffff;
}
:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}
```

- [ ] **Step 4.5: Verify no off-brand colors remain**

```bash
grep -n "6366f1\|99, 102, 241\|99,102,241\|79, 172, 254\|79,172,254\|102, 126, 234\|118, 75, 162\|139, 92, 246" src/App.css
```

Expected: empty output.

- [ ] **Step 4.6: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/App.css
git commit -m "feat(theme): replace 59 hardcoded indigo/purple/blue rgba values in App.css with design system green"
```

---

## Task 5: Update `PortalLayout.tsx` — injected styles + sidebar

**Files:**
- Modify: `src/shared/layout/PortalLayout.tsx`

The `PORTAL_STYLES` constant is injected into `<head>` as a `<style>` tag — CSS vars don't reach it. Nav active state currently uses amber `#F59E0B`. Per design system, active nav = primary green.

- [ ] **Step 5.1: Update the `PORTAL_STYLES` constant**

Find the `PORTAL_STYLES` string (lines ~16–101). Replace the entire string:

```typescript
const PORTAL_STYLES = `
  @keyframes portal-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes portal-pulse-ring {
    0%   { transform: scale(1);    opacity: 0.6; }
    70%  { transform: scale(1.45); opacity: 0;   }
    100% { transform: scale(1.45); opacity: 0;   }
  }
  @keyframes portal-fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes portal-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  .portal-fade-in   { animation: portal-fade-in 0.35s ease both; }
  .portal-fade-in-1 { animation: portal-fade-in 0.35s 0.05s ease both; }
  .portal-fade-in-2 { animation: portal-fade-in 0.35s 0.10s ease both; }
  .portal-fade-in-3 { animation: portal-fade-in 0.35s 0.15s ease both; }
  .portal-fade-in-4 { animation: portal-fade-in 0.35s 0.20s ease both; }

  .portal-nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    text-decoration: none;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    color: #8892A4;
    background: transparent;
    transition: all 0.18s ease;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    border: none;
    width: 100%;
    text-align: left;
  }
  .portal-nav-link::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(47,191,113,0.06);
    border-radius: 10px;
    opacity: 0;
    transition: opacity 0.18s ease;
  }
  .portal-nav-link:hover { color: #2FBF71; }
  .portal-nav-link:hover::before { opacity: 1; }
  .portal-nav-link.active {
    color: #2FBF71;
    background: rgba(47,191,113,0.1);
    font-weight: 600;
  }
  .portal-nav-link.active .portal-nav-dot {
    opacity: 1;
    background: #2FBF71;
    box-shadow: 0 0 8px rgba(47,191,113,0.8);
  }
  .portal-nav-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: transparent;
    margin-left: auto;
    opacity: 0;
    transition: all 0.18s ease;
    flex-shrink: 0;
  }

  .portal-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 12px; border-radius: 9px; border: none;
    background: transparent; cursor: pointer; font-size: 13px;
    font-family: 'DM Sans', sans-serif; font-weight: 500;
    transition: all 0.18s ease; width: 100%; text-align: left;
    color: #8892A4;
  }
  .portal-btn:hover { background: rgba(255,255,255,0.05); color: #F0F4FF; }
  .portal-btn.danger { color: #F87171; }
  .portal-btn.danger:hover { background: rgba(248,113,113,0.08); color: #FCA5A5; }
`;
```

- [ ] **Step 5.2: Update the `SunMark` component — keep amber (it's the solar energy icon)**

`SunMark` uses amber `#F59E0B`/`#FBBF24` — this is intentional for the sun/solar icon. No change needed here.

- [ ] **Step 5.3: Update `SidebarContent` — mobile menu button and user profile active state**

Find the mobile menu button in `PortalLayout` (the header `<button>` with `background: 'rgba(245,158,11,0.1)', color: '#F59E0B'`):

```typescript
<button
  onClick={() => setMobileOpen(true)}
  style={{ padding: 8, borderRadius: 8, border: 'none', background: 'rgba(47,191,113,0.1)', color: '#2FBF71', cursor: 'pointer' }}
>
  <Menu size={18} />
</button>
```

Find the user profile NavLink active background:
```typescript
background: isActive ? (isDark ? 'rgba(47,191,113,0.08)' : 'rgba(47,191,113,0.06)') : userBg,
border: isActive ? '1px solid rgba(47,191,113,0.25)' : `1px solid ${userBorder}`,
```

User avatar initials background — change from amber to primary green:
```typescript
<div style={{
  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
  background: 'linear-gradient(135deg, #2FBF71, #1A9955)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 12, color: '#FFFFFF',
}}>
```

- [ ] **Step 5.4: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/shared/layout/PortalLayout.tsx
git commit -m "feat(portal): apply design system to PortalLayout — green nav active states, primary avatar"
```

---

## Task 6: Update `PortalOverview.tsx`

**Files:**
- Modify: `src/features/portal/PortalOverview.tsx`

- [ ] **Step 6.1: Add import at top of file**

Add after the last import:
```typescript
import { getTokens } from './styles/portalTokens';
```

- [ ] **Step 6.2: Update the loading spinner**

Find the loading spinner div (uses `#F59E0B` border-top and `#F59E0B` Zap icon):
```typescript
<div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(47,191,113,0.15)', borderTop: '3px solid #2FBF71', animation: 'portal-spin 1s linear infinite' }} />
<Zap size={20} color="#2FBF71" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
```

- [ ] **Step 6.3: Update empty/error state icon**

Find the empty state with Sun icon `color="#F59E0B"`:
```typescript
<Sun size={32} color="#E9B949" />
```
(Amber is correct here — it's a solar/sun icon, not an action.)

- [ ] **Step 6.4: Update site selector active state**

Find the site selector buttons:
```typescript
border: s.site_id === selectedSiteId ? '1px solid #2FBF71' : `1px solid ${border}`,
background: s.site_id === selectedSiteId ? 'rgba(47,191,113,0.12)' : surface,
color: s.site_id === selectedSiteId ? '#2FBF71' : muted,
```

- [ ] **Step 6.5: Update KPI card accent colors**

Find `KpiCard` calls. The `accentColor` prop should use `DS.primary` for general KPIs and `DS.amber` for solar-specific values:

```typescript
// Capacity (solar kWp) — amber = energy value
<KpiCard ... accentColor="#E9B949" ... />
// Today Generation (kWh solar produced) — amber = solar energy  
<KpiCard ... accentColor="#E9B949" ... />
// Active Alerts — semantic: green if 0, warning amber if > 0
<KpiCard ... accentColor={summary.active_alert_count > 0 ? '#F59E0B' : '#34D399'} ... />
// Any remaining KPIs — primary green
<KpiCard ... accentColor="#2FBF71" ... />
```

- [ ] **Step 6.6: Update the header gradient badge (line ~176)**

Find `background: 'linear-gradient(135deg, #F0F4FF 30%, #F59E0B 100%)'`:
```typescript
background: 'linear-gradient(135deg, #F0F4FF 30%, #2FBF71 100%)',
```

Find `color: '#FBBF24'` solar badge:
```typescript
background: 'rgba(233,185,73,0.1)', color: '#E9B949', border: '1px solid rgba(233,185,73,0.2)'
```
(Amber remains correct here — solar capacity badge uses amber.)

- [ ] **Step 6.7: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/features/portal/PortalOverview.tsx
git commit -m "feat(portal): apply design system to PortalOverview — green primary, amber for solar values"
```

---

## Task 7: Update `PortalDevice.tsx`

**Files:**
- Modify: `src/features/portal/PortalDevice.tsx`

- [ ] **Step 7.1: Add import**

```typescript
import { getTokens, DS } from './styles/portalTokens';
```

- [ ] **Step 7.2: Update module-level color constants**

Find at the top of the file:
```typescript
const warn: { color: string; label: string; glow: string } = { ... }
// or similar inline warn definitions
```

The `warn` color `#FBBF24` stays as amber (it's a warning — correct semantic).

- [ ] **Step 7.3: Update loading spinner**

Find the loading div with `borderTop: '3px solid #F59E0B'`:
```typescript
<div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(47,191,113,0.15)', borderTop: '3px solid #2FBF71', animation: 'portal-spin 1s linear infinite' }} />
<Cpu size={20} color="#2FBF71" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
```

- [ ] **Step 7.4: Update empty state**

Find `<Cpu size={32} color="#F59E0B" />`:
```typescript
<Cpu size={32} color="#2FBF71" />
```

- [ ] **Step 7.5: Update device temperature warning threshold color**

Line ~171 uses `#FBBF24` for high temp — keep as amber (it's a thermal warning, amber is correct semantically).

- [ ] **Step 7.6: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/features/portal/PortalDevice.tsx
git commit -m "feat(portal): apply design system to PortalDevice — green primary actions"
```

---

## Task 8: Update `PortalAlerts.tsx`

**Files:**
- Modify: `src/features/portal/PortalAlerts.tsx`

- [ ] **Step 8.1: Add import**

```typescript
import { getTokens, DS, alpha } from './styles/portalTokens';
```

- [ ] **Step 8.2: Update module-level severity color map**

Find the severity color definitions at top of file (around lines 20–35):
```typescript
const SEVERITY: Record<string, { border: string; glow: string; bg: string; label: string; icon: React.ReactNode }> = {
  critical: { border: '#EF4444', glow: 'rgba(239,68,68,0.12)',  bg: 'rgba(239,68,68,0.08)',   label: 'Critical',  icon: <AlertOctagon size={12} /> },
  warning:  { border: '#F59E0B', glow: 'rgba(245,158,11,0.12)', bg: 'rgba(245,158,11,0.08)',  label: 'Warning',   icon: <AlertTriangle size={12} /> },
  info:     { border: '#3B82F6', glow: 'rgba(59,130,246,0.12)', bg: 'rgba(59,130,246,0.08)',  label: 'Info',      icon: <Info size={12} /> },
  resolved: { border: '#34D399', glow: 'rgba(52,211,153,0.12)', bg: 'rgba(52,211,153,0.08)',  label: 'Resolved',  icon: <CheckCircle size={12} /> },
};
```
These are semantic colors — keep as-is. Warning amber is correct.

Find `#FBBF24` for `acknowledged` state badge — keep as amber.

- [ ] **Step 8.3: Update loading spinner**

Find `borderTop: '3px solid #F59E0B'` and `<Bell size={20} color="#F59E0B"`:
```typescript
<div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid rgba(47,191,113,0.15)', borderTop: '3px solid #2FBF71', animation: 'portal-spin 1s linear infinite' }} />
<Bell size={20} color="#2FBF71" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
```

- [ ] **Step 8.4: Update timeline vertical line**

Find line ~275 `linear-gradient(to bottom, rgba(245,158,11,0.3), transparent)`:
```typescript
background: `linear-gradient(to bottom, rgba(47,191,113,0.3), transparent)`
```

- [ ] **Step 8.5: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/features/portal/PortalAlerts.tsx
git commit -m "feat(portal): apply design system to PortalAlerts — green primary, semantic amber/red kept"
```

---

## Task 9: Update `PortalProfile.tsx` and `PortalChat.tsx`

**Files:**
- Modify: `src/features/portal/PortalProfile.tsx`
- Modify: `src/features/portal/PortalChat.tsx`

- [ ] **Step 9.1: Update `PortalProfile.tsx` module constants (top of file)**

Find lines ~10–18:
```typescript
const ORANGE='#F07522',ORANGE_D='#d66419',NAVY='#2B4A6B',WARN='#F59E0B';
```

Replace:
```typescript
const PRIMARY='#2FBF71', PRIMARY_D='#1A9955', AMBER='#E9B949', NAVY='#2B4A6B', WARN='#F59E0B';
```

Find avatar gradient array (line ~18):
```typescript
const AV=[
  `linear-gradient(135deg,${PRIMARY} 0%,${PRIMARY_D} 100%)`,
  `linear-gradient(135deg,${NAVY} 0%,#1a2e42 100%)`,
  'linear-gradient(135deg,#4CAF82 0%,#2e6b53 100%)',
  'linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%)',
  `linear-gradient(135deg,${AMBER} 0%,#B45309 100%)`
];
```

Then replace all `ORANGE` usages with `PRIMARY` and `ORANGE_D` with `PRIMARY_D` throughout the file.

- [ ] **Step 9.2: Update `PortalChat.tsx` FAB button and chat header**

Find the injected `<style>` in PortalChat (~lines 243–260):
```css
.pchat-fab { background: linear-gradient(135deg, #2FBF71 0%, #1A9955 100%); ... }
```

Find all `#F59E0B`/`#FBBF24` occurrences in PortalChat and replace with:
- FAB button + chat header accent → `#2FBF71` (primary)
- `rgba(245,158,11,...)` → `rgba(47,191,113,...)`
- `box-shadow: 0 0 12px rgba(245,158,11,0.4)` → `0 0 12px rgba(47,191,113,0.4)`
- Crown icon + premium plan text → keep amber `#E9B949` (amber = premium/solar, good semantic)

Specifically replace in the injected CSS string:
```
linear-gradient(135deg, #F59E0B, #FBBF24)  →  linear-gradient(135deg, #2FBF71, #1A9955)
rgba(245,158,11,0.55)  →  rgba(47,191,113,0.55)
rgba(245,158,11,0.12)  →  rgba(47,191,113,0.12)
border: 2px solid rgba(245,158,11,0.5)  →  border: 2px solid rgba(47,191,113,0.5)
background: #F59E0B  →  background: #2FBF71
```

For the premium plan Crown icon (lines ~380–410) — keep amber:
```typescript
<Crown size={24} color="#E9B949" />
// "Basic" and "Premium" plan text stays amber — it's a tier highlight
<strong style={{ color: '#E9B949' }}>Basic</strong>
```

- [ ] **Step 9.3: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/features/portal/PortalProfile.tsx src/features/portal/PortalChat.tsx
git commit -m "feat(portal): apply design system to PortalProfile and PortalChat — green primary, amber for premium/solar"
```

---

## Task 10: Update `security/styles.ts` and `quotation.css`

**Files:**
- Modify: `src/features/portal/security/styles.ts`
- Modify: `src/features/quotation/quotation.css`

- [ ] **Step 10.1: Update `security/styles.ts`**

Find the `iconBox` style (line ~21–26):
```typescript
iconBox: {
  width: 28, height: 28, borderRadius: 8,
  background: 'rgba(47,191,113,0.1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#2FBF71',
},
```

Find the `button` style (line ~39–47):
```typescript
button: {
  padding: '10px 20px',
  background: 'transparent',
  color: '#2FBF71',
  border: '1.5px solid #2FBF71',
  borderRadius: 9,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
},
```

- [ ] **Step 10.2: Update `quotation.css` — add `--green` token**

The quotation.css uses `var(--green, #00a63e)` as fallback throughout. Since Task 2 added `--green: #2FBF71` to `:root`, these will automatically pick up the correct value. Verify:

```bash
grep "var(--green" /home/ubuntu/work/smart-solar-react-frontend/src/features/quotation/quotation.css | head -5
```

If any are still hardcoded as `#00a63e` without `var(--green,...)`, update them:
```bash
grep -n "#00a63e" /home/ubuntu/work/smart-solar-react-frontend/src/features/quotation/quotation.css
```

Replace any bare `#00a63e` in quotation.css:
```bash
sed -i 's/#00a63e/var(--green, #2FBF71)/g' src/features/quotation/quotation.css
# Also update #20BA5A (quotation progress bar gradient end)
sed -i 's/#20BA5A/#4DD68A/g' src/features/quotation/quotation.css
```

- [ ] **Step 10.3: Commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add src/features/portal/security/styles.ts src/features/quotation/quotation.css
git commit -m "feat(portal): apply design system to security/styles.ts + quotation.css green token"
```

---

## Task 11: Build verification

**Files:** No changes — verify everything compiles and renders correctly.

- [ ] **Step 11.1: TypeScript check**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors related to our changes. If `getTokens` import errors appear, check the import path is `'./styles/portalTokens'` (relative, no `.ts` extension).

- [ ] **Step 11.2: Build**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
npm run build 2>&1 | tail -20
```

Expected: successful build, no errors.

- [ ] **Step 11.3: Spot-check token consistency**

```bash
# Confirm no off-brand colors remain in portal files
grep -rn "F59E0B\|FBBF24\|245,158,11\|F07522\|#6366f1\|99,102,241\|00a63e" \
  src/features/portal/ src/shared/layout/PortalLayout.tsx \
  | grep -v "warning\|WARN\|warn\|semantic\|// amber\|premium\|crown\|Crown\|solar-icon\|sun\|Sun\|solar_amber" \
  | head -20
```

Any remaining `#F59E0B` should only be in explicitly semantic warning contexts (alert severity maps, thermal warnings). Everything else should be gone.

```bash
# Confirm no off-brand indigo/purple remains in App.css
grep -n "99, 102, 241\|6366f1\|79, 172, 254\|102, 126, 234\|118, 75, 162" src/App.css
```

Expected: empty output.

- [ ] **Step 11.4: Dev server smoke test**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
npm run dev &
sleep 5
echo "Dev server started — check http://localhost:5173/portal in browser"
```

Manually check in browser:
- Login page → primary button should be `#2FBF71` green
- Customer portal sidebar → active nav link green, not amber
- Portal overview → KPI cards have green accents; solar kWp/kWh values may use amber
- Portal chat FAB → green button
- Quotation wizard → progress bar green

- [ ] **Step 11.5: Final commit**

```bash
cd /home/ubuntu/work/smart-solar-react-frontend
git add -A
git commit -m "feat(theme): design system theme complete — Solar Green primary, Amber secondary across portal"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] `src/index.css` Tailwind tokens updated (Task 2)
- [x] `src/App.css` `:root` brand vars updated (Task 3)
- [x] 59× hardcoded indigo/purple/blue in App.css replaced (Task 4)
- [x] `PortalLayout.tsx` nav active states (Task 5)
- [x] `PortalOverview.tsx` site selector, KPI cards, loader (Task 6)
- [x] `PortalDevice.tsx` loader, empty state (Task 7)
- [x] `PortalAlerts.tsx` loader, timeline (Task 8)
- [x] `PortalProfile.tsx` avatar gradients, ORANGE const (Task 9)
- [x] `PortalChat.tsx` FAB + chat accent (Task 9)
- [x] `security/styles.ts` icon + button (Task 10)
- [x] `quotation.css` `--green` token (Task 10)
- [x] `portalTokens.ts` scalable token architecture (Task 1)

### Semantic Color Decisions
These amber usages were **intentionally kept** as correct semantic choices:
- `SunMark` component (solar sun icon) → amber
- Solar capacity / kWh energy values → amber (sun = energy)
- `warning` severity in alert maps → `#F59E0B` (semantic warning)
- Temperature warning `>= 65°C` → amber
- Premium plan Crown icon → amber (premium tier indicator)
- `acknowledged` alert state → amber

### Dead Code Note
These files are never imported anywhere and can be safely deleted in a future cleanup PR:
`src/TopNavbar.css`, `src/MobileSidebarOverrides.css`, `src/styles/theme.css`,
`src/styles/index.css`, `src/styles/tailwind.css`, `src/styles/fonts.css`
