import React from 'react';
import '../App.css'; // Ensure skeleton styles are included

interface SkeletonProps {
  rows?: number;
  height?: string;
  width?: string;
  circular?: boolean;
  className?: string;
}

/**
 * Skeleton loader component for showing loading states
 * Provides better UX than plain "Loading..." text
 */
export const SkeletonLoader: React.FC<SkeletonProps> = React.memo(({
  rows = 3,
  height = '20px',
  width = '100%',
  circular = false,
  className = ''
}) => {
  return (
    <div className={`skeleton-loader ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`skeleton-line ${circular ? 'skeleton-circle' : ''}`}
          style={{
            height: circular ? height : height,
            width: circular ? height : width,
            borderRadius: circular ? '50%' : '4px',
            marginBottom: '12px',
          }}
        />
      ))}
    </div>
  );
});

/**
 * Skeleton card loader for grid layouts
 */
export const SkeletonCard: React.FC = React.memo(() => {
  return (
    <div className="skeleton-card card">
      <div className="skeleton-line" style={{ height: '24px', width: '60%', marginBottom: '16px' }} />
      <div className="skeleton-line" style={{ height: '16px', marginBottom: '8px' }} />
      <div className="skeleton-line" style={{ height: '16px', width: '80%' }} />
    </div>
  );
});

/**
 * Skeleton for table rows
 */
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 5 }) => {
  return (
    <tr className="skeleton-row">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <div className="skeleton-line" style={{ height: '16px' }} />
        </td>
      ))}
    </tr>
  );
};

/**
 * Skeleton for devices list
 */
export const SkeletonDeviceList: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="skeleton-loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

/**
 * Skeleton for dashboard
 */
export const SkeletonDashboard: React.FC = () => {
  return (
    <div className="skeleton-dashboard">
      <div className="skeleton-line" style={{ height: '32px', width: '30%', marginBottom: '24px' }} />
      <div className="grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
};
