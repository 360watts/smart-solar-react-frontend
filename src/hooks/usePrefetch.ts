import { useCallback, useRef } from 'react';
import { cacheService } from '../services/cacheService';

interface PrefetchOptions {
  /** Delay before starting prefetch (ms) */
  delay?: number;
  /** Cancel prefetch when element loses hover/focus */
  cancelOnLeave?: boolean;
  /** TTL for prefetched data in cache */
  cacheTTL?: number;
}

/**
 * Hook for prefetching data on hover/focus.
 * Improves perceived performance by loading data before user navigates.
 * 
 * @example
 * ```tsx
 * const { prefetch, cancelPrefetch } = usePrefetch();
 * 
 * <Link 
 *   to="/devices"
 *   onMouseEnter={() => prefetch('devices', () => apiService.getDevices())}
 *   onMouseLeave={cancelPrefetch}
 * >
 *   Devices
 * </Link>
 * ```
 */
export function usePrefetch(options: PrefetchOptions = {}) {
  const {
    delay = 100,
    cancelOnLeave = true,
    cacheTTL = 60000, // 1 minute
  } = options;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const prefetch = useCallback(async (
    cacheKey: string,
    fetchFn: () => Promise<any>,
    ttl: number = cacheTTL
  ) => {
    // Skip if already in cache
    if (cacheService.has(cacheKey)) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Cancel any existing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await fetchFn();
        
        // Only cache if not aborted
        if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
          cacheService.set(cacheKey, data, ttl);
        }
      } catch (error) {
        // Silently ignore prefetch errors
        if (error instanceof Error && error.name !== 'AbortError') {
          console.debug(`Prefetch failed for ${cacheKey}:`, error.message);
        }
      }
    }, delay);
  }, [delay, cacheTTL]);

  const cancelPrefetch = useCallback(() => {
    if (!cancelOnLeave) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [cancelOnLeave]);

  const isPrefetched = useCallback((cacheKey: string) => {
    return cacheService.has(cacheKey);
  }, []);

  return {
    prefetch,
    cancelPrefetch,
    isPrefetched,
  };
}

/**
 * Create prefetch handlers for a specific cache key.
 * Useful for creating reusable prefetch props for links.
 */
export function createPrefetchHandlers(
  cacheKey: string,
  fetchFn: () => Promise<any>,
  options: PrefetchOptions = {}
) {
  const { delay = 100, cacheTTL = 60000 } = options;
  let timeoutId: NodeJS.Timeout | null = null;

  return {
    onMouseEnter: () => {
      if (cacheService.has(cacheKey)) return;
      
      timeoutId = setTimeout(async () => {
        try {
          const data = await fetchFn();
          cacheService.set(cacheKey, data, cacheTTL);
        } catch (error) {
          // Silently ignore
        }
      }, delay);
    },
    onMouseLeave: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    onFocus: () => {
      if (cacheService.has(cacheKey)) return;
      
      timeoutId = setTimeout(async () => {
        try {
          const data = await fetchFn();
          cacheService.set(cacheKey, data, cacheTTL);
        } catch (error) {
          // Silently ignore
        }
      }, delay);
    },
    onBlur: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}

export default usePrefetch;
