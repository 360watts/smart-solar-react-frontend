// src/shared/components/SiteDataPanel/chartUtils.ts
import React, { useState, useCallback, useRef } from 'react';
import { type ChartArea } from 'chart.js';

export function makeGradient(
  ctx: CanvasRenderingContext2D,
  area: ChartArea,
  color: string,
  topOpacity = 0.35,
  bottomOpacity = 0,
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, color + Math.round(topOpacity * 255).toString(16).padStart(2, '0'));
  gradient.addColorStop(1, color + Math.round(bottomOpacity * 255).toString(16).padStart(2, '0'));
  return gradient;
}

// Returns the value for `options.plugins.zoom` directly (NOT `{ zoom: ... }`) —
// callers assign it as `plugins: { ..., zoom: createDragZoomPlugins(cb) }`.
// Wrapping this in an extra `zoom:` key here previously produced
// `plugins.zoom.zoom.zoom.*` (three levels deep) instead of the
// `plugins.zoom.zoom.*` chartjs-plugin-zoom actually reads, so it silently
// found nothing to enable — no error, drag/wheel just did nothing.
export function createDragZoomPlugins(onZoomComplete: () => void) {
  return {
    zoom: {
      wheel:  { enabled: true, speed: 0.08 },
      drag: {
        enabled: true,
        backgroundColor: 'rgba(15,159,143,0.14)',
        borderColor:     'rgba(15,159,143,0.7)',
        borderWidth: 1,
      },
      pinch:  { enabled: true },
      mode:   'x' as const,
      onZoomComplete,
    },
    pan: { enabled: false, mode: 'x' as const },
  };
}

export function useChartZoomState() {
  const chartRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const onZoomComplete = useRef(() => setIsZoomed(true));
  const resetZoom = useCallback(() => {
    chartRef.current?.resetZoom();
    setIsZoomed(false);
  }, []);
  return { chartRef, isZoomed, onZoomComplete, resetZoom };
}

const zoomResetButtonStyle: React.CSSProperties = {
  border:       '1px solid rgba(15,159,143, 0.25)',
  background:   'transparent',
  color:        '#0F9F8F',
  borderRadius: 8,
  padding:      '6px 12px',
  fontSize:     '0.75rem',
  fontWeight:   700,
  cursor:       'pointer',
  fontFamily:   'Rubik, sans-serif',
};

/**
 * `overlay`: use when this button sits directly above the chart canvas,
 * inside ChartCard's fixed-height content box — there, giving it its own
 * row (even conditionally) shifts/shrinks the canvas on zoom. Overlay mode
 * makes it `position: absolute` so it has zero layout footprint; it needs a
 * `position: relative` ancestor, which ChartCard's content wrapper already
 * is. Don't use overlay when the button sits in a toolbar row alongside
 * other controls (e.g. HistoryTab's series-toggle row) — there it's meant
 * to occupy normal flow space, not float over anything.
 */
export const ZoomResetButton: React.FC<{ visible: boolean; onClick: () => void; overlay?: boolean }> = ({ visible, onClick, overlay }) => {
  if (!visible) return null;
  const style = overlay
    ? { ...zoomResetButtonStyle, position: 'absolute' as const, top: -2, right: 0, zIndex: 2 }
    : zoomResetButtonStyle;
  return React.createElement('button', { onClick, style }, 'Reset Zoom');
};
