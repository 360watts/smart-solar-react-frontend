import React from 'react';
import { useToast } from '../contexts/ToastContext';

const ICONS: Record<string, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}${toast.exiting ? ' toast-exit' : ''}`}
          role="alert"
        >
          <span className="toast-icon">{ICONS[toast.type]}</span>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            {toast.message && (
              <div className="toast-message">{toast.message}</div>
            )}
          </div>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
          <div
            className="toast-progress"
            style={{ animation: `toastProgressBar ${toast.duration}ms linear forwards` }}
          />
        </div>
      ))}
    </div>
  );
};
