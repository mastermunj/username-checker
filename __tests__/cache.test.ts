/**
 * Tests for Cache layer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CheckResultCache } from '../src/Cache.js';
import type { CheckResult } from '../src/types.js';
import { ErrorCategory } from '../src/types.js';

describe('CheckResultCache', () => {
  let cache: CheckResultCache;

  const createMockCheckResult = (
    siteKey: string,
    status: 'available' | 'taken' | 'error' = 'available',
  ): CheckResult => ({
    site: siteKey,
    siteName: siteKey,
    url: `https://${siteKey}.com/testuser`,
    status,
    errorCategory: ErrorCategory.NONE,
    responseTime: 100,
  });

  describe('memory cache', () => {
    beforeEach(() => {
      cache = new CheckResultCache({ type: 'memory', ttl: 3600000 });
    });

    it('should set and get cached results', () => {
      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      const cached = cache.get('GitHub', 'testuser');
      expect(cached).toEqual(result);
    });

    it('should check if result is cached', () => {
      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      expect(cache.has('GitHub', 'testuser')).toBe(true);
      expect(cache.has('GitHub', 'otheruser')).toBe(false);
    });

    it('should return null for non-cached results', () => {
      const cached = cache.get('GitHub', 'testuser');
      expect(cached).toBeNull();
    });

    it('should clear the cache', () => {
      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      cache.clear();

      const cached = cache.get('GitHub', 'testuser');
      expect(cached).toBeNull();
    });

    it('should handle cache expiration with TTL', () => {
      cache = new CheckResultCache({ type: 'memory', ttl: 1 });
      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      // Immediately after set, should be available
      expect(cache.has('GitHub', 'testuser')).toBe(true);

      // Wait for TTL to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.get('GitHub', 'testuser')).toBeNull();
          resolve(null);
        }, 100);
      });
    });

    it('should get cache statistics', () => {
      cache.set('GitHub', 'user1', createMockCheckResult('GitHub'));
      cache.set('Twitter', 'user1', createMockCheckResult('Twitter'));

      const stats = cache.stats();
      expect(stats.type).toBe('memory');
      expect(stats.memorySize).toBe(2);
    });

    it('should handle multiple sites for same username', () => {
      const gitHubResult = createMockCheckResult('GitHub', 'available');
      const twitterResult = createMockCheckResult('Twitter', 'taken');

      cache.set('GitHub', 'testuser', gitHubResult);
      cache.set('Twitter', 'testuser', twitterResult);

      expect(cache.get('GitHub', 'testuser')).toEqual(gitHubResult);
      expect(cache.get('Twitter', 'testuser')).toEqual(twitterResult);
    });

    it('should respect maxSize configuration', () => {
      cache = new CheckResultCache({ type: 'memory', maxSize: 2 });

      cache.set('GitHub', 'user1', createMockCheckResult('GitHub'));
      cache.set('Twitter', 'user1', createMockCheckResult('Twitter'));
      cache.set('Reddit', 'user1', createMockCheckResult('Reddit'));

      // After exceeding maxSize, should evict oldest
      const stats = cache.stats();
      expect(stats.memorySize).toBeLessThanOrEqual(2);
    });

    it('should handle zero-sized cache without throwing', () => {
      cache = new CheckResultCache({ type: 'memory', maxSize: 0 });
      expect(() => cache.set('GitHub', 'user1', createMockCheckResult('GitHub'))).not.toThrow();
    });
  });

  describe('file cache', () => {
    beforeEach(() => {
      cache = new CheckResultCache({
        type: 'file',
        ttl: 3600000,
        dir: './test-cache',
      });
    });

    afterEach(() => {
      cache.clear();
    });

    it('should set and get file-cached results', () => {
      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      const cached = cache.get('GitHub', 'testuser');
      expect(cached).toEqual(result);
    });

    it('should check if result is file-cached', () => {
      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      expect(cache.has('GitHub', 'testuser')).toBe(true);
    });

    it('should return null for missing file cache entries', () => {
      expect(cache.get('GitHub', 'missing-user')).toBeNull();
    });

    it('should handle file cache expiration', () => {
      cache = new CheckResultCache({
        type: 'file',
        ttl: 1,
        dir: './test-cache-ttl',
      });

      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.get('GitHub', 'testuser')).toBeNull();
          cache.clear();
          resolve(null);
        }, 100);
      });
    });

    it('should tolerate file write failures', () => {
      // /dev/null exists as a file on macOS, so writing nested files will fail.
      cache = new CheckResultCache({
        type: 'file',
        dir: '/dev/null',
      });

      expect(() => cache.set('GitHub', 'testuser', createMockCheckResult('GitHub'))).not.toThrow();
    });

    it('should return null for invalid JSON cache content', () => {
      const dir = './test-cache-invalid-json';
      mkdirSync(dir, { recursive: true });
      const filePath = join(dir, 'github_testuser.json');
      writeFileSync(filePath, '{invalid-json');

      cache = new CheckResultCache({
        type: 'file',
        dir,
      });

      expect(cache.get('GitHub', 'testuser')).toBeNull();
      cache.clear();
    });

    it('should clean up expired files when possible', () => {
      cache = new CheckResultCache({
        type: 'file',
        ttl: 1,
        dir: './test-cache-expire-cleanup',
      });

      cache.set('GitHub', 'testuser', createMockCheckResult('GitHub'));

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.get('GitHub', 'testuser')).toBeNull();
          expect(cache.stats().fileSize).toBe(0);
          cache.clear();
          resolve(null);
        }, 100);
      });
    });

    it('should ignore cleanup errors when deleting expired files', () => {
      const dir = './test-cache-expire-permissions';
      cache = new CheckResultCache({
        type: 'file',
        ttl: 1,
        dir,
      });

      cache.set('GitHub', 'testuser', createMockCheckResult('GitHub'));

      return new Promise((resolve) => {
        setTimeout(() => {
          chmodSync(dir, 0o555);
          expect(cache.get('GitHub', 'testuser')).toBeNull();
          chmodSync(dir, 0o755);
          cache.clear();
          resolve(null);
        }, 100);
      });
    });

    it('should return zero size when directory does not exist', () => {
      cache = new CheckResultCache({
        type: 'file',
        dir: './test-cache-size-missing',
      });

      cache.clear();
      expect(cache.stats().fileSize).toBe(0);
    });

    it('should return zero size when cache dir is not readable as a directory', () => {
      const filePath = './test-cache-as-file';
      writeFileSync(filePath, 'not-a-directory');

      cache = new CheckResultCache({
        type: 'file',
        dir: filePath,
      });

      expect(cache.stats().fileSize).toBe(0);
      rmSync(filePath, { force: true });
    });

    it('should use default file cache directory when none is provided', () => {
      const defaultDir = './.username-checker-cache';
      cache = new CheckResultCache({ type: 'file' });
      cache.set('GitHub', 'testuser', createMockCheckResult('GitHub'));

      expect(cache.get('GitHub', 'testuser')).not.toBeNull();
      rmSync(defaultDir, { recursive: true, force: true });
    });
  });

  describe('hybrid cache', () => {
    beforeEach(() => {
      cache = new CheckResultCache({
        type: 'hybrid',
        ttl: 3600000,
        dir: './test-hybrid-cache',
      });
    });

    afterEach(() => {
      cache.clear();
    });

    it('should use memory cache first', () => {
      const result = createMockCheckResult('GitHub');
      cache.set('GitHub', 'testuser', result);

      const cached = cache.get('GitHub', 'testuser');
      expect(cached).toEqual(result);
    });

    it('should fallback to file cache and populate memory', () => {
      const result = createMockCheckResult('GitHub');
      cache = new CheckResultCache({
        type: 'hybrid',
        ttl: 3600000,
        dir: './test-hybrid-cache',
      });

      cache.set('GitHub', 'testuser', result);

      // Create new cache instance to test file persistence
      cache = new CheckResultCache({
        type: 'hybrid',
        ttl: 3600000,
        dir: './test-hybrid-cache',
      });

      // This must hit fileCache.has() because memory cache is empty on a fresh instance.
      expect(cache.has('GitHub', 'testuser')).toBe(true);

      const cached = cache.get('GitHub', 'testuser');
      expect(cached).toEqual(result);
      expect(cache.has('GitHub', 'testuser')).toBe(true);
    });

    it('should get cache statistics with both memory and file', () => {
      cache.set('GitHub', 'user1', createMockCheckResult('GitHub'));
      cache.set('Twitter', 'user1', createMockCheckResult('Twitter'));

      const stats = cache.stats();
      expect(stats.type).toBe('hybrid');
      expect(stats.memorySize).toBeGreaterThan(0);
      expect(stats.fileSize).toBeDefined();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      cache = new CheckResultCache({ type: 'memory' });
    });

    it('should handle null results gracefully', () => {
      expect(() => {
        cache.get('GitHub', 'testuser');
      }).not.toThrow();
    });

    it('should handle special characters in cache keys', () => {
      const result = createMockCheckResult('GitHub');
      // Cache keys with special characters
      cache.set('GitHub-1', 'user@example', result);
      cache.set('Twitter', 'user with space', result);

      expect(cache.get('GitHub-1', 'user@example')).toEqual(result);
      expect(cache.get('Twitter', 'user with space')).toEqual(result);
    });

    it('should default to memory cache type when no options are provided', () => {
      cache = new CheckResultCache();
      const stats = cache.stats();
      expect(stats.type).toBe('memory');
    });
  });
});
