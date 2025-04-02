/**
 * Simple cache system for temporary data storage
 */

/**
 * Structure of a cache entry
 */
type CacheEntry<T> = {
  /** Stored data */
  data: T;
  /** Entry creation timestamp */
  timestamp: number;
};

/**
 * Simple cache with TTL (Time To Live)
 * @template T Type of stored values
 */
export class SimpleCache<T> {
  /** Map storing cache entries */
  private cache: Map<string, CacheEntry<T>> = new Map();
  /** Entry lifetime in milliseconds */
  private ttlMs: number;
  
  /**
   * Creates a new cache instance
   * 
   * @param ttlSeconds - Entry lifetime in seconds (default: 60)
   */
  constructor(ttlSeconds = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }
  
  /**
   * Retrieves a value from the cache
   * 
   * @param key - The key of the entry to retrieve
   * @returns The value associated with the key or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    const now = Date.now();
    // Check if the entry has expired
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data;
  }
  
  /**
   * Stores a value in the cache
   * 
   * @param key - The key to store the value under
   * @param data - The value to store
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Removes all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Removes a specific entry from the cache
   * 
   * @param key - The key of the entry to remove
   * @returns true if the entry was removed, false otherwise
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Checks if the cache contains an entry for the specified key
   * (does not check expiration)
   * 
   * @param key - The key to check
   * @returns true if the cache contains an entry for this key, false otherwise
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Returns the number of entries in the cache
   * (potentially includes expired entries)
   * 
   * @returns The number of entries in the cache
   */
  get size(): number {
    return this.cache.size;
  }
  
  /**
   * Gets a value from cache or loads it if not present
   * 
   * @param key - The key to retrieve
   * @param loader - Function to call if key not in cache
   * @returns The cached or newly loaded value
   */
  async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const cachedValue = this.get(key);
    if (cachedValue !== undefined) return cachedValue;
    
    // Value not in cache, load it
    const newValue = await loader();
    this.set(key, newValue);
    return newValue;
  }
  
  /**
   * Cleans expired entries from the cache
   */
  purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Schedules automatic purging of expired entries
   * 
   * @param intervalMs - Time between purges in milliseconds
   * @returns A function to stop the auto-purging
   */
  startAutoPurge(intervalMs = 60000): () => void {
    const interval = setInterval(() => this.purgeExpired(), intervalMs);
    return () => clearInterval(interval);
  }
} 