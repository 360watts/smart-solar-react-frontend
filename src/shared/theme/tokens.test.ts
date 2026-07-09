import { getChartColors } from './chartColors';
import { getDesignTokens } from './tokens';

describe('360watts design tokens', () => {
  it('exposes the Staff Ops light-mode foundation as CSS custom property references', () => {
    const tokens = getDesignTokens(false);

    // Every non-chart token is a var(...) reference into index.css's :root / .dark-mode
    // blocks — that's the single source of truth, so light and dark resolve the same
    // strings and let the browser pick the right value via the `dark-mode` class.
    expect(tokens.pageBg).toBe('var(--background)');
    expect(tokens.surface).toBe('var(--card)');
    expect(tokens.text).toBe('var(--foreground)');
    expect(tokens.textMuted).toBe('var(--muted-foreground)');
    expect(tokens.primary).toBe('var(--primary)');
    expect(tokens.secondary).toBe('var(--secondary)');
    expect(tokens.textInverse).toBe('var(--text-inverse)');
    expect(tokens.danger).toBe('var(--destructive)');
  });

  it('resolves identically for dark mode, since the CSS class drives the actual value', () => {
    expect(getDesignTokens(true).textMuted).toBe(getDesignTokens(false).textMuted);
  });

  it('keeps chart colors semantic and brand aligned', () => {
    const charts = getChartColors(false);

    expect(charts.pv).toBe('#E9B949');
    expect(charts.load).toBe('#3B82F6');
    expect(charts.battery).toBe('#2FBF71');
    expect(charts.danger).toBe('#EF4444');
  });
});
