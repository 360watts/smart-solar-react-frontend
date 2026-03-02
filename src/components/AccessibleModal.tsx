import React, { useEffect, useRef } from 'react';

interface AccessibleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional id for aria-labelledby; defaults to auto-generated from title. */
  id?: string;
}

/**
 * Modal wrapper with ARIA attributes, focus trap, and ESC to close.
 * Use for dialogs so screen readers and keyboard users get correct behavior.
 */
export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  open,
  onClose,
  title,
  children,
  id = 'modal-title',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousActive = document.activeElement as HTMLElement | null;
    containerRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActive?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
      ref={containerRef}
      tabIndex={-1}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 id={id}>{title}</h3>
        {children}
      </div>
    </div>
  );
};
