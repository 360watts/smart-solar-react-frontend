interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number; // milliseconds
  staleTime?: number; // Time after which data is considered stale but usable
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  /** Prevents duplicate simultaneous fetches for the same cache key. */
  private inflight: Map<string, Promise<any>> = new Map();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default
  private static readonly STALE_TIME = 30 * 1000; // 30 seconds before data is stale

  set(key: string, data: any, ttlMs: number = CacheService.DEFAULT_TTL, staleTime?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttlMs,
      staleTime: staleTime ?? Math.min(ttlMs / 2, CacheService.STALE_TIME),
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  getWithStaleStatus(key: string): { data: any; isStale: boolean; isExpired: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;
    const isExpired = age > entry.expiresIn;
    const isStale = age > (entry.staleTime ?? entry.expiresIn / 2);

    // Remove if fully expired
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: entry.data,
      isStale,
      isExpired: false,
    };
  }

  clear(key: string): void {
    this.cache.delete(key);
  }

  clearPattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clearAll(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  /**
   * Deduplicate in-flight requests: if a fetch for `key` is already running,
   * returns the same promise instead of starting a second HTTP request.
   * Sets cache on resolution; clears inflight entry regardless of outcome.
   *
   * Usage: `return cacheService.dedup('telemetry_x', () => this.request(...), ttlMs)`
   */
  async dedup<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = CacheService.DEFAULT_TTL): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) return cached as T;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher().then(
      (data) => { this.set(key, data, ttlMs); return data; },
    ).catch((err) => {
      // Remove from inflight immediately on failure so the next caller retries
      // rather than sharing a rejected promise.
      this.inflight.delete(key);
      throw err;
    }).finally(
      () => { this.inflight.delete(key); },
    );

    this.inflight.set(key, promise);
    return promise;
  }

}

export const cacheService = new CacheService();
