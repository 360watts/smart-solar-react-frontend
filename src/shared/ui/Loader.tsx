import React from 'react';

interface LoaderProps {
  /**
   * Size of the spinner in pixels
   * @default 16
   */
  size?: number;
  
  /**
   * Color of the spinner (CSS color value)
   * @default 'currentColor'
   */
  color?: string;
  
  /**
   * Animation duration in seconds
   * @default 0.6
   */
  duration?: number;
  
  /**
   * Show text label next to spinner
   */
  label?: string;
  
  /**
   * If true, show full-page overlay loader
   */
  fullScreen?: boolean;
  
  /**
   * If true, show loader as inline element (not full screen)
   * @default true
   */
  inline?: boolean;
}

/**
 * Reusable Loader/Spinner component
 * 
 * Usage (inline with button):
 * ```
 * <button disabled={isLoading}>
 *   <Loader size={16} label="Saving..." />
 * </button>
 * ```
 * 
 * Usage (full-screen overlay):
 * ```
 * {isLoading && <Loader fullScreen label="Loading..." />}
 * ```
 */
export const Loader: React.FC<LoaderProps> = ({
  size = 16,
  color = 'currentColor',
  duration = 0.6,
  label,
  fullScreen = false,
  inline = true,
}) => {
  const spinnerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `2px solid ${color}33`, // 20% opacity
    borderTopColor: color,
    animation: `spin ${duration}s linear infinite`,
  };

  // Full-screen overlay mode
  if (fullScreen) {
    return (
      <>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={spinnerStyle} />
            {label && <span style={{ color: 'currentColor', fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>}
          </div>
        </div>
      </>
    );
  }

  // Inline mode
  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={spinnerStyle} />
        {label && <span style={{ fontSize: '0.875rem' }}>{label}</span>}
      </div>
    </>
  );
};

export default Loader;
