import React from 'react';

type StatusType = 'online' | 'offline' | 'warning' | 'critical' | 'error' | 'info';

interface StatusPillProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
}

const STATUS_LABELS: Record<StatusType, string> = {
  online:   'Online',
  offline:  'Offline',
  warning:  'Warning',
  critical: 'Critical',
  error:    'Error',
  info:     'Info',
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  pulse = false,
}) => {
  const variantClass =
    status === 'error' ? 'status-pill--critical' : `status-pill--${status}`;
  const dotClass = ['status-dot', pulse && status === 'online' ? 'status-dot--pulse' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={`status-pill ${variantClass}`}>
      <span className={dotClass} />
      {label ?? STATUS_LABELS[status]}
    </span>
  );
};
