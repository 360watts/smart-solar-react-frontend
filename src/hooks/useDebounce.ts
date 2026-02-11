import { useState, useEffect, useCallback } from 'react';

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
 * Custom hook to debounce a callback function
 * Useful for search, filtering, and other expensive operations
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const newTimeoutId = setTimeout(() => {
        callback(...args);
      }, delay);

      setTimeoutId(newTimeoutId);
    },
    [callback, delay, timeoutId]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

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
