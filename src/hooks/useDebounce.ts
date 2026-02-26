import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDebouncedValueOptions {
  delay?: number;
}

/**
 * Custom hook to debounce a value with a delay
 * Useful for search inputs and other frequent updates
 */
export function useDebouncedValue<T>(
  value: T,
  options: UseDebouncedValueOptions = {}
): T {
  const { delay = 300 } = options;
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook to debounce a callback function.
 * Uses a ref for the timeout ID so the returned function is stable
 * (does not re-create on every invocation, which would defeat debouncing).
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef<T>(callback);

  // Keep callbackRef current so the latest callback is always used
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Stable debounced function — never recreated
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay] // only delay changes recreate the wrapper
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return debouncedCallback;
}

/**
 * Custom hook for search input with debouncing
 * Returns a hook that handles search input changes with built-in debouncing
 */
export function useDebouncedSearch(
  onSearch: (query: string) => void,
  delay: number = 300
) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedCallback = useDebouncedCallback(onSearch, delay);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      debouncedCallback(query);
    },
    [debouncedCallback]
  );

  return {
    searchQuery,
    setSearchQuery,
    handleSearch,
  };
}
