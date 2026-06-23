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

export function createDragZoomPlugins(onZoomComplete: () => void) {
  return {
    zoom: {
      wheel:  { enabled: true, speed: 0.08 },
      drag: {
        enabled: true,
        backgroundColor: 'rgba(0,166,62,0.14)',
        borderColor:     'rgba(0,166,62,0.7)',
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
  border:       '1px solid rgba(0, 166, 62, 0.25)',
  background:   'transparent',
  color:        '#00a63e',
  borderRadius: 8,
  padding:      '6px 12px',
  fontSize:     '0.75rem',
  fontWeight:   700,
  cursor:       'pointer',
  fontFamily:   'Poppins, sans-serif',
};

export const ZoomResetButton: React.FC<{ visible: boolean; onClick: () => void }> = ({ visible, onClick }) => {
  if (!visible) return null;
  return React.createElement('button', { onClick, style: zoomResetButtonStyle }, 'Reset Zoom');
};
