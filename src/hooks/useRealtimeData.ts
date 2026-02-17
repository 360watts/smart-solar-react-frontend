import { useState, useEffect, useCallback, useRef } from 'react';

interface UseRealtimeDataOptions<T> {
  /** Polling interval in milliseconds (default: 10000 = 10 seconds) */
  interval?: number;
  /** Whether to fetch data immediately on mount (default: true) */
  fetchOnMount?: boolean;
  /** Whether polling should be active (default: true) */
  enabled?: boolean;
  /** Callback when data is successfully fetched */
  onSuccess?: (data: T) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Keep previous data while revalidating (stale-while-revalidate pattern) */
  keepPreviousData?: boolean;
  /** Dependencies that trigger a refetch when changed */
  dependencies?: any[];
  /** Refetch when window regains focus (default: true) */
  refetchOnFocus?: boolean;
  /** Pause polling when window loses focus (default: false) */
  pauseOnBlur?: boolean;
}

interface UseRealtimeDataReturn<T> {
  /** The fetched data */
  data: T | null;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Loading state for background revalidation */
  isRevalidating: boolean;
  /** Error from the last fetch attempt */
  error: Error | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
  /** Whether the data is stale (older than interval) */
  isStale: boolean;
  /** Last successful fetch timestamp */
  lastUpdated: Date | null;
}

/**
 * Custom hook for fetching data with automatic polling and real-time updates.
 * Implements the stale-while-revalidate pattern for optimal UX.
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useRealtimeData(
 *   () => apiService.getDevices(),
 *   { interval: 5000 }
 * );
 * ```
 */
export function useRealtimeData<T>(
  fetchFn: () => Promise<T>,
  options: UseRealtimeDataOptions<T> = {}
): UseRealtimeDataReturn<T> {
  const {
    interval = 10000,
    fetchOnMount = true,
    enabled = true,
    onSuccess,
    onError,
    keepPreviousData = true,
    dependencies = [],
    refetchOnFocus = true,
    pauseOnBlur = false,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const isMountedRef = useRef(true);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const fetchFnRef = useRef(fetchFn);

  // Keep fetchFn ref updated
  fetchFnRef.current = fetchFn;

  const fetchData = useCallback(async (isInitial = false) => {
    if (!isMountedRef.current) return;

    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRevalidating(true);
    }

    try {
      const result = await fetchFnRef.current();
      
      if (!isMountedRef.current) return;

      setData(result);
      setError(null);
      setLastUpdated(new Date());
      setIsStale(false);
      onSuccess?.(result);
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);

      // Keep previous data if option enabled
      if (!keepPreviousData) {
        setData(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRevalidating(false);
      }
    }
  }, [onSuccess, onError, keepPreviousData]);

  const refetch = useCallback(async () => {
    await fetchData(data === null);
  }, [fetchData, data]);

  // Handle window focus/blur
  useEffect(() => {
    if (!refetchOnFocus && !pauseOnBlur) return;

    const handleFocus = () => {
      setIsWindowFocused(true);
      if (refetchOnFocus && enabled) {
        fetchData(false);
      }
    };

    const handleBlur = () => {
      setIsWindowFocused(false);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [refetchOnFocus, pauseOnBlur, enabled, fetchData]);

  // Check if data is stale
  useEffect(() => {
    if (!lastUpdated || !interval) return;

    const checkStale = () => {
      const now = new Date();
      const timeSinceUpdate = now.getTime() - lastUpdated.getTime();
      setIsStale(timeSinceUpdate > interval);
    };

    const staleCheckInterval = setInterval(checkStale, 1000);
    return () => clearInterval(staleCheckInterval);
  }, [lastUpdated, interval]);

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled && fetchOnMount) {
      fetchData(true);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [enabled, fetchOnMount, ...dependencies]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || interval <= 0) return;

    // Clear any existing interval
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }

    const shouldPoll = !pauseOnBlur || isWindowFocused;

    if (shouldPoll) {
      intervalIdRef.current = setInterval(() => {
        if (isMountedRef.current) {
          fetchData(false);
        }
      }, interval);
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [enabled, interval, pauseOnBlur, isWindowFocused, fetchData]);

  return {
    data,
    isLoading,
    isRevalidating,
    error,
    refetch,
    isStale,
    lastUpdated,
  };
}

/**
 * Hook for real-time data with dependency-based refresh.
 * Useful when data depends on filters or search terms.
 */
export function useRealtimeDataWithDeps<T, D extends any[]>(
  fetchFn: (...deps: D) => Promise<T>,
  deps: D,
  options: Omit<UseRealtimeDataOptions<T>, 'dependencies'> = {}
): UseRealtimeDataReturn<T> {
  const memoizedFetchFn = useCallback(() => fetchFn(...deps), deps);
  
  return useRealtimeData(memoizedFetchFn, {
    ...options,
    dependencies: deps,
  });
}

export default useRealtimeData;
