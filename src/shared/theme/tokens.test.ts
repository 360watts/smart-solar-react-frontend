import { getChartColors } from './chartColors';
import { buildThemeCssVars } from './cssVars';
import { getDesignTokens } from './tokens';

describe('360watts design tokens', () => {
  it('exposes the Staff Ops light-mode foundation from the design system', () => {
    const tokens = getDesignTokens(false);

    expect(tokens.pageBg).toBe('#F4F6F8');
    expect(tokens.surface).toBe('#FFFFFF');
    expect(tokens.text).toBe('#12151A');
      expect(tokens.textMuted).toBe('rgba(18,21,26,0.62)');
      expect(tokens.primary).toBe('#2FBF71');
      expect(tokens.secondary).toBe('#E9B949');
      expect(tokens.textInverse).toBe('#0A0E1A');
      expect(tokens.danger).toBe('#DC2626');
  });

  it('keeps chart colors semantic and brand aligned', () => {
    const charts = getChartColors(false);

    expect(charts.pv).toBe('#E9B949');
    expect(charts.load).toBe('#3B82F6');
    expect(charts.battery).toBe('#2FBF71');
    expect(charts.danger).toBe('#EF4444');
  });

  it('serializes tokens for CSS variable application', () => {
    const cssVars = buildThemeCssVars(getDesignTokens(false));

    expect(cssVars['--background']).toBe('#F4F6F8');
    expect(cssVars['--foreground']).toBe('#12151A');
    expect(cssVars['--ring']).toBe('#2FBF71');
    expect(cssVars['--chart-pv']).toBe('#E9B949');
  });
});
