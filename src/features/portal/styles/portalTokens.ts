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
