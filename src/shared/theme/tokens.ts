import { darkChartColors, lightChartColors } from './chartColors';
import type { DesignTokens } from './types';

/**
 * Every non-chart field below is a CSS custom property reference, not a literal color.
 * The actual values live in exactly one place — the `:root` / `.dark-mode` blocks in
 * `src/index.css` — which `ThemeContext` switches between by toggling the `dark-mode`
 * class on `<html>`. Because the browser resolves `var(--x)` against whichever class is
 * currently active, the same string works for both light and dark; there is nothing to
 * keep in sync here. (Chart colors are the one exception — Chart.js renders to <canvas>,
 * which can't resolve CSS custom properties, so those stay real hex values sourced from
 * `chartColors.ts`, which mirrors the `--chart-*` vars in index.css.)
 */
const sharedDomTokens = {
  pageBg: 'var(--background)',
  surface: 'var(--card)',
  surfaceRaised: 'var(--surface-raised)',
  surfaceMuted: 'var(--surface-muted)',
  text: 'var(--foreground)',
  textMuted: 'var(--muted-foreground)',
  textDim: 'var(--text-dim)',
  textInverse: 'var(--text-inverse)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  primary: 'var(--primary)',
  primaryHover: 'var(--primary-hover)',
  primarySoft: 'var(--primary-soft)',
  secondary: 'var(--secondary)',
  secondarySoft: 'var(--secondary-soft)',
  success: 'var(--success)',
  successSoft: 'var(--success-soft)',
  warning: 'var(--warning)',
  warningSoft: 'var(--warning-soft)',
  danger: 'var(--destructive)',
  dangerSoft: 'var(--danger-soft)',
  info: 'var(--info)',
  infoSoft: 'var(--info-soft)',
  shadow: 'var(--shadow-card)',
  focus: 'var(--ring)',
} as const;

export const lightTokens: DesignTokens = {
  ...sharedDomTokens,
  charts: lightChartColors,
};

export const darkTokens: DesignTokens = {
  ...sharedDomTokens,
  charts: darkChartColors,
};

export function getDesignTokens(isDark: boolean): DesignTokens {
  return isDark ? darkTokens : lightTokens;
}
