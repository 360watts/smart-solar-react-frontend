import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface AnomalyBannerProps {
  anomalousDevices: string[];
  onDeviceClick: (deviceName: string) => void;
  onDismiss: () => void;
  isDark: boolean;
}

const AnomalyBanner: React.FC<AnomalyBannerProps> = ({
  anomalousDevices,
  onDeviceClick,
  onDismiss,
  isDark,
}) => {
  if (anomalousDevices.length === 0) {
    return null;
  }

  const bgColor = 'var(--danger-soft)';
  const borderColor = '#EF4444';
  const textColor = 'var(--destructive)';

  return (
    <div
      style={{
        backgroundColor: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          flex: 1,
        }}
      >
        <AlertTriangle
          size={20}
          style={{ color: textColor, flexShrink: 0 }}
        />
        <div style={{ color: textColor, fontSize: '14px', lineHeight: 1.4 }}>
          {anomalousDevices.length === 1 ? (
            <>
              <span>
                <strong
                  style={{
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => onDeviceClick(anomalousDevices[0])}
                >
                  {anomalousDevices[0]}
                </strong>
                {' is showing anomalous readings'}
              </span>
            </>
          ) : (
            <span>
              <strong>{anomalousDevices.length} devices</strong>
              {' showing anomalous readings'}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: textColor,
          flexShrink: 0,
        }}
        aria-label="Dismiss anomaly banner"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default AnomalyBanner;
