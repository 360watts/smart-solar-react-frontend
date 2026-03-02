import { useState, useCallback } from 'react';

/**
 * Generic modal state hook. Use one per modal type to avoid multiple
 * separate { show, data } state objects.
 */
export function useModal<T = unknown>() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const openModal = useCallback((payload?: T | null) => {
    setData(payload ?? null);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setData(null);
  }, []);

  return { open, data, openModal, closeModal };
}
