/**
 * Simple in-memory cache service for API responses
 * Reduces unnecessary API calls and speeds up page loads
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresIn: number; // milliseconds
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default
  private static readonly LONG_TTL = 30 * 60 * 1000; // 30 minutes for static data

  /**
   * Set a cache entry
   */
  set(key: string, data: any, ttlMs: number = CacheService.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttlMs,
    });
  }

  /**
   * Get a cache entry if valid
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
   * Clear a specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
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
   * Get TTL constants
   */
  static getTTL(type: 'short' | 'long' = 'short'): number {
    return type === 'long' ? CacheService.LONG_TTL : CacheService.DEFAULT_TTL;
  }
}

export const cacheService = new CacheService();
export const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
export const LONG_TTL = 30 * 60 * 1000; // 30 minutes
