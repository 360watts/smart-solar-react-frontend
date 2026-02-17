/**
 * Enhanced in-memory cache service for API responses
 * Features:
 * - TTL-based expiration
 * - Stale-while-revalidate pattern support
 * - Subscription system for real-time updates
 * - Pattern-based cache invalidation
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number; // milliseconds
  staleTime?: number; // Time after which data is considered stale but usable
}

interface CacheSubscription {
  callback: (data: any) => void;
  pattern?: RegExp;
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private subscribers: Map<string, Set<CacheSubscription>> = new Map();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default
  private static readonly LONG_TTL = 30 * 60 * 1000; // 30 minutes for static data
  private static readonly REALTIME_TTL = 10 * 1000; // 10 seconds for real-time data
  private static readonly STALE_TIME = 30 * 1000; // 30 seconds before data is stale

  /**
   * Set a cache entry and notify subscribers
   */
  set(key: string, data: any, ttlMs: number = CacheService.DEFAULT_TTL, staleTime?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttlMs,
      staleTime: staleTime ?? Math.min(ttlMs / 2, CacheService.STALE_TIME),
    });
    
    // Notify subscribers
    this.notifySubscribers(key, data);
  }

  /**
   * Get a cache entry if valid (returns null if expired)
   */
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

  /**
   * Get cache entry even if stale (for stale-while-revalidate pattern)
   * Returns { data, isStale } or null if no entry exists
   */
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

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Check if cached data is stale but usable
   */
  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;

    const now = Date.now();
    const age = now - entry.timestamp;
    return age > (entry.staleTime ?? entry.expiresIn / 2);
  }

  /**
   * Clear a specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear cache entries matching a pattern
   */
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

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Subscribe to cache updates for a specific key
   */
  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    const subscription: CacheSubscription = { callback };
    this.subscribers.get(key)!.add(subscription);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(subscription);
        if (subs.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * Subscribe to cache updates matching a pattern
   */
  subscribePattern(pattern: RegExp, callback: (data: any) => void): () => void {
    const key = `__pattern__${pattern.source}`;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    const subscription: CacheSubscription = { callback, pattern };
    this.subscribers.get(key)!.add(subscription);

    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(subscription);
        if (subs.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * Notify all subscribers of a cache update
   */
  private notifySubscribers(key: string, data: any): void {
    // Direct key subscribers
    const directSubs = this.subscribers.get(key);
    if (directSubs) {
      directSubs.forEach(sub => {
        try {
          sub.callback(data);
        } catch (error) {
          console.error(`Cache subscriber error for key ${key}:`, error);
        }
      });
    }

    // Pattern subscribers
    this.subscribers.forEach((subs, subKey) => {
      if (subKey.startsWith('__pattern__')) {
        subs.forEach(sub => {
          if (sub.pattern && sub.pattern.test(key)) {
            try {
              sub.callback(data);
            } catch (error) {
              console.error(`Cache pattern subscriber error for key ${key}:`, error);
            }
          }
        });
      }
    });
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; keys: string[]; subscribers: number } {
    return {
      size: this.cache.size,
      keys: this.keys(),
      subscribers: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
    };
  }

  /**
   * Get TTL constants
   */
  static getTTL(type: 'short' | 'long' | 'realtime' = 'short'): number {
    switch (type) {
      case 'realtime':
        return CacheService.REALTIME_TTL;
      case 'long':
        return CacheService.LONG_TTL;
      default:
        return CacheService.DEFAULT_TTL;
    }
  }
}

export const cacheService = new CacheService();
export const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
export const LONG_TTL = 30 * 60 * 1000; // 30 minutes
export const REALTIME_TTL = 10 * 1000; // 10 seconds
