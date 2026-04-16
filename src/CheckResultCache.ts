/**
 * Cache layer for check results
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult, CacheOptions, CachedCheckResult } from './types.js';

/**
 * In-memory cache for check results
 */
class MemoryCache {
  private cache: Map<string, CachedCheckResult> = new Map();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl ?? 3600000; // 1 hour default
    this.maxSize = options.maxSize ?? 1000;
  }

  set(key: string, result: CheckResult): void {
    // Simple LRU eviction: if cache is full, delete oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  get(key: string): CheckResult | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * File-based persistent cache for check results
 */
class FileCache {
  private readonly dir: string;
  private readonly ttl: number;

  constructor(options: CacheOptions = {}) {
    this.dir = options.dir ?? './.username-checker-cache';
    this.ttl = options.ttl ?? 3600000; // 1 hour default

    // Ensure cache directory exists
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key to be filesystem-safe
    const sanitized = key.replace(/[^a-z0-9-]/gi, '_').toLowerCase();
    return join(this.dir, `${sanitized}.json`);
  }

  set(key: string, result: CheckResult): void {
    try {
      const filePath = this.getFilePath(key);
      const cached: CachedCheckResult = {
        result,
        timestamp: Date.now(),
      };
      writeFileSync(filePath, JSON.stringify(cached, null, 2));
    } catch {
      // Silently fail on write errors
    }
  }

  get(key: string): CheckResult | null {
    try {
      const filePath = this.getFilePath(key);

      if (!existsSync(filePath)) {
        return null;
      }

      const data = readFileSync(filePath, 'utf-8');
      const cached: CachedCheckResult = JSON.parse(data);

      // Check TTL
      if (Date.now() - cached.timestamp > this.ttl) {
        try {
          unlinkSync(filePath);
        } catch {
          // Silently ignore cleanup failure.
        }
        return null;
      }

      return cached.result;
    } catch {
      // Silently fail on read errors
      return null;
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    try {
      if (existsSync(this.dir)) {
        rmSync(this.dir, { recursive: true, force: true });
      }
    } catch {
      // Silently fail
    }
  }

  size(): number {
    try {
      if (!existsSync(this.dir)) {
        return 0;
      }

      return readdirSync(this.dir).filter((entry) => entry.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }
}

/**
 * Hybrid cache that uses memory for current session and file for persistence
 */
export class CheckResultCache {
  private memoryCache: MemoryCache;
  private fileCache: FileCache | null = null;
  private readonly type: 'memory' | 'file' | 'hybrid';

  constructor(options: CacheOptions = {}) {
    this.type = options.type ?? 'memory';

    this.memoryCache = new MemoryCache(options);

    if (this.type === 'file' || this.type === 'hybrid') {
      this.fileCache = new FileCache(options);
    }
  }

  /**
   * Get a cached result
   */
  get(siteKey: string, username: string): CheckResult | null {
    const key = this.getCacheKey(siteKey, username);

    // Try memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached) {
      return memCached;
    }

    // Try file cache if available
    if (this.fileCache) {
      const fileCached = this.fileCache.get(key);
      if (fileCached) {
        // Populate memory cache from file cache
        this.memoryCache.set(key, fileCached);
        return fileCached;
      }
    }

    return null;
  }

  /**
   * Set a cached result
   */
  set(siteKey: string, username: string, result: CheckResult): void {
    const key = this.getCacheKey(siteKey, username);

    // Write to memory cache
    this.memoryCache.set(key, result);

    // Write to file cache if available
    if (this.fileCache) {
      this.fileCache.set(key, result);
    }
  }

  /**
   * Check if a result is cached
   */
  has(siteKey: string, username: string): boolean {
    const key = this.getCacheKey(siteKey, username);
    return this.memoryCache.has(key) || (this.fileCache?.has(key) ?? false);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.fileCache?.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { type: string; memorySize: number; fileSize?: number } {
    return {
      type: this.type,
      memorySize: this.memoryCache.size(),
      fileSize: this.fileCache?.size(),
    };
  }

  private getCacheKey(siteKey: string, username: string): string {
    return `${siteKey}:${username}`;
  }
}
