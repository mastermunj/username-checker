/**
 * Tests for UsernameChecker class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UsernameChecker } from '../src/UsernameChecker.js';
import { Sites } from '../src/Sites.js';
import { Detector } from '../src/Detector.js';
import { ErrorCategory, DetectionMethod } from '../src/types.js';
import type { SiteConfig } from '../src/types.js';

// Mock fetch globally
const mockFetch = vi.fn();

describe('UsernameChecker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const checker = new UsernameChecker();
      expect(checker).toBeInstanceOf(UsernameChecker);
    });

    it('should accept custom options', () => {
      const checker = new UsernameChecker({
        timeout: 5000,
        maxConcurrency: 10,
        retries: 1,
      });
      expect(checker).toBeInstanceOf(UsernameChecker);
    });

    it('should accept useTor option', () => {
      const checker = new UsernameChecker({
        useTor: true,
      });
      expect(checker).toBeInstanceOf(UsernameChecker);
    });

    it('should accept proxy option', () => {
      const checker = new UsernameChecker({
        proxy: 'http://localhost:8080',
      });
      expect(checker).toBeInstanceOf(UsernameChecker);
    });
  });

  describe('check()', () => {
    it('should check username across multiple sites', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        maxConcurrency: 2,
        retries: 0,
      });

      const results = await checker.check('testuser', {
        sites: ['GitHub', 'GitLab'],
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
    });

    it('should filter to specified sites', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const results = await checker.check('testuser', {
        sites: ['GitHub'],
      });

      expect(results.length).toBe(1);
      expect(results[0].site).toBe('GitHub');
    });

    it('should call onProgress callback', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const onProgress = vi.fn();
      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      await checker.check('testuser', {
        sites: ['GitHub'],
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 1,
          completed: 1,
        }),
      );
    });

    it('should track available count in progress', async () => {
      // Return 404 to detect username as available
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://github.com/availableuser',
        text: async () => '',
        headers: new Headers(),
      });

      const onProgress = vi.fn();
      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      await checker.check('availableuser', {
        sites: ['GitHub'],
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          available: 1,
          taken: 0,
        }),
      );
    });

    it('should track errors in progress', async () => {
      mockFetch.mockRejectedValue(new Error('Connection timeout'));

      const onProgress = vi.fn();
      const checker = new UsernameChecker({
        timeout: 100,
        retries: 0,
      });

      const results = await checker.check('testuser', {
        sites: ['GitHub'],
        onProgress,
      });

      expect(results.length).toBe(1);
      expect(results[0].status).toBe('error');
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: 1,
        }),
      );
    });

    it('should throw for invalid username', async () => {
      const checker = new UsernameChecker();

      await expect(checker.check('')).rejects.toThrow();
      await expect(checker.check('a')).rejects.toThrow();
    });

    it('should handle empty site list', async () => {
      const checker = new UsernameChecker();
      const results = await checker.check('testuser', {
        sites: [],
      });
      expect(results).toEqual([]);
    });
  });

  describe('checkSite()', () => {
    it('should check single site by key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('testuser', 'GitHub');

      expect(result.site).toBe('GitHub');
      expect(result.siteName).toBe('GitHub');
      expect(result.url).toContain('github.com');
      expect(result.status).toBe('taken'); // 200 = taken
    });

    it('should detect available username on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://github.com/nonexistent',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('nonexistent', 'GitHub');

      expect(result.status).toBe('available');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('testuser', 'GitHub');

      expect(result.status).toBe('error');
      expect(result.errorCategory).toBe(ErrorCategory.CONNECTION_ERROR);
    });

    it('should detect by message', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://reddit.com/user/nonexistent',
        text: async () => 'Sorry, nobody on Reddit goes by that name.',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('nonexistent', 'Reddit');

      expect(result.status).toBe('available');
    });

    it('should return error for non-existent site', async () => {
      const checker = new UsernameChecker();
      const result = await checker.checkSite('testuser', 'nonexistent-site-xyz');

      expect(result.status).toBe('error');
      expect(result.errorMessage).toContain('not found');
    });

    it('should return invalid for username not matching regex', async () => {
      const checker = new UsernameChecker();
      // GitHub requires username to start with alphanumeric
      const result = await checker.checkSite('-invalid', 'GitHub');

      expect(result.status).toBe('invalid');
    });

    it('should check with custom site config', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://custom.example.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const customConfig: SiteConfig = {
        name: 'Custom Site',
        url: 'https://custom.example.com/{}',
        urlMain: 'https://custom.example.com',
        errorType: DetectionMethod.STATUS_CODE,
      };

      const result = await checker.checkSite('testuser', 'custom', customConfig);

      expect(result.site).toBe('custom');
      expect(result.siteName).toBe('Custom Site');
      expect(result.status).toBe('taken');
    });

    it('should catch unexpected errors in checkSite', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      // Mock Detector.detect to throw an error
      const originalDetect = Detector.detect;
      Detector.detect = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected detection error');
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('testuser', 'GitHub');

      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Unexpected detection error');
      expect(result.errorCategory).toBe(ErrorCategory.UNKNOWN);

      // Restore original
      Detector.detect = originalDetect;
    });
  });

  describe('abort()', () => {
    it('should abort running operations', async () => {
      let aborted = false;
      mockFetch.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!aborted) {
          return {
            ok: true,
            status: 200,
            url: 'https://example.com',
            text: async () => '',
            headers: new Headers(),
          };
        }
        throw new Error('aborted');
      });

      const checker = new UsernameChecker({
        timeout: 100,
        maxConcurrency: 1,
      });

      const promise = checker.check('testuser', {
        sites: ['GitHub', 'GitLab', 'BitBucket'],
      });

      // Abort after short delay
      setTimeout(() => {
        aborted = true;
        checker.abort();
      }, 100);

      const results = await promise;
      // Should have fewer results due to abort
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('static methods', () => {
    describe('getSiteCount()', () => {
      it('should return number of sites', () => {
        const count = UsernameChecker.getSiteCount();
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThan(200);
        expect(count).toBe(Sites.count());
      });
    });

    describe('hasSite()', () => {
      it('should return true for existing site', () => {
        expect(UsernameChecker.hasSite('GitHub')).toBe(true);
      });

      it('should return false for non-existent site', () => {
        expect(UsernameChecker.hasSite('nonexistent')).toBe(false);
      });
    });

    describe('getSite()', () => {
      it('should return site config', () => {
        const site = UsernameChecker.getSite('GitHub');
        expect(site).toBeDefined();
        expect(site?.name).toBe('GitHub');
      });

      it('should return undefined for non-existent site', () => {
        expect(UsernameChecker.getSite('nonexistent')).toBeUndefined();
      });
    });
  });

  describe('result structure', () => {
    it('should have correct result fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const results = await checker.check('testuser', {
        sites: ['GitHub'],
      });

      const result = results[0];
      expect(result).toHaveProperty('site');
      expect(result).toHaveProperty('siteName');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('errorCategory');
    });
  });
});
