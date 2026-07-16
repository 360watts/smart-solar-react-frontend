// Canvas 2D's fillStyle/strokeStyle can't resolve CSS custom properties (var(--x)) —
// that only works for real DOM elements under the CSS cascade. Chart.js paints its
// tooltip, ticks, and legend text directly on canvas, so passing 'var(--x)' as a color
// there silently fails and falls back to black. Read the computed value instead.
export function resolveCssVar(name: string, fallback = '#000000'): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
