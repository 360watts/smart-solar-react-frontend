import type { DesignTokens, ThemeCssVars } from './types';

export function buildThemeCssVars(tokens: DesignTokens): ThemeCssVars {
  return {
    '--background': tokens.pageBg,
    '--foreground': tokens.text,
    '--card': tokens.surface,
    '--card-foreground': tokens.text,
    '--popover': tokens.surfaceRaised,
    '--popover-foreground': tokens.text,
    '--primary': tokens.primary,
    '--primary-foreground': tokens.textInverse,
    '--secondary': tokens.secondary,
    '--secondary-foreground': tokens.text,
    '--muted': tokens.surfaceMuted,
    '--muted-foreground': tokens.textMuted,
    '--accent': tokens.secondary,
    '--accent-foreground': tokens.text,
    '--destructive': tokens.danger,
    '--destructive-foreground': '#FFFFFF',
    '--border': tokens.border,
    '--input': tokens.border,
    '--ring': tokens.focus,
    '--chart-pv': tokens.charts.pv,
    '--chart-load': tokens.charts.load,
    '--chart-battery': tokens.charts.battery,
    '--chart-grid': tokens.charts.grid,
    '--chart-import': tokens.charts.import,
    '--chart-export': tokens.charts.export,
    '--chart-warning': tokens.charts.warning,
    '--chart-danger': tokens.charts.danger,
    '--chart-neutral': tokens.charts.neutral,
  };
}
