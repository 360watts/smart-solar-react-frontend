import React from 'react';
import { PackageOpen, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="empty-state">
    <div className="empty-state-icon">{icon ?? <PackageOpen size={48} strokeWidth={1.5} />}</div>
    <p className="empty-state-title">{title}</p>
    {description && <p className="empty-state-desc">{description}</p>}
    {action && (
      <button className="empty-state-cta" onClick={action.onClick}>
        <Plus size={14} strokeWidth={2.5} />
        {action.label}
      </button>
    )}
  </div>
);
