import { useCallback, useState } from 'react';

/**
 * useState that survives a browser reload (localStorage, per browser). Only a stored value found in `allowed`
 * is used, so a stale or edited entry falls back to `initial`. Storage may be blocked (private window): every
 * read and write is guarded and the state still works in memory.
 */
export function usePersistedState<T extends string | boolean>(key: string, initial: T, allowed?: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return initial;
      const v = (typeof initial === 'boolean' ? raw === 'true' : raw) as T;
      return !allowed || allowed.includes(v) ? v : initial;
    } catch { return initial; }
  });
  const set = useCallback((v: T) => {
    setValue(v);
    try { localStorage.setItem(key, String(v)); } catch { /* storage blocked: keep it in memory only */ }
  }, [key]);
  return [value, set] as const;
}
