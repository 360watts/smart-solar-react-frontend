import React from 'react';

interface AuditTrailProps {
  createdBy?: string | null;
  createdAt?: string;
  updatedBy?: string | null;
  updatedAt?: string;
  className?: string;
}

const AuditTrail: React.FC<AuditTrailProps> = ({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
  className = 'audit-trail',
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className={className}>
      <div className="audit-row">
        <span className="audit-label">Created:</span>
        {createdBy ? (
          <span className="audit-value">
            by <strong>{createdBy}</strong> on {formatDate(createdAt)}
          </span>
        ) : (
          <span className="audit-value">System</span>
        )}
      </div>

      {updatedBy && (
        <div className="audit-row">
          <span className="audit-label">Last Updated:</span>
          <span className="audit-value">
            by <strong>{updatedBy}</strong> on {formatDate(updatedAt)}
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(AuditTrail);
