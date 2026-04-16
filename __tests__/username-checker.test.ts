/**
 * Tests for UsernameChecker class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UsernameChecker } from '../src/UsernameChecker.js';
import { ManifestRepository } from '../src/ManifestRepository.js';
import { Sites } from '../src/Sites.js';
import { Detector } from '../src/Detector.js';
import { ErrorCategory, DetectionMethod } from '../src/types.js';
import type { SiteConfig, CheckProgress } from '../src/types.js';
import { regressionSiteFixtures, responseFixtures } from './fixtures/accuracy-fixtures.js';

type MockResponse = {
  ok: boolean;
  status: number;
  url: string;
  text: () => Promise<string>;
  headers: Headers;
};

// Mock fetch globally
const mockFetch = vi.fn<(input: string, init?: RequestInit) => Promise<MockResponse>>();

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

    it('should accept repository injection', () => {
      const checker = new UsernameChecker({
        repository: ManifestRepository.fromSiteConfigs({
          Example: {
            name: 'Example',
            url: 'https://example.com/{}',
            urlMain: 'https://example.com/',
            errorType: DetectionMethod.STATUS_CODE,
          },
        }),
      });

      expect(checker).toBeInstanceOf(UsernameChecker);
    });

    it('should accept cache options', () => {
      const checker = new UsernameChecker({
        cache: {
          type: 'memory',
          ttl: 3600000,
        },
      });
      expect(checker).toBeInstanceOf(UsernameChecker);
    });

    it('should not create cache when cache option is false', () => {
      const checker = new UsernameChecker({
        cache: false,
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

    it('should resolve specified sites case-insensitively', async () => {
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
        sites: ['github'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].site).toBe('GitHub');
    });

    it('should throw a clear error for unknown sites with suggestions', async () => {
      const checker = new UsernameChecker();

      await expect(
        checker.check('testuser', {
          sites: ['gitub'],
        }),
      ).rejects.toThrow(/Unknown site: "gitub" .*GitHub/);
    });

    it('should throw a clear error for unknown sites without suggestions', async () => {
      const checker = new UsernameChecker();

      await expect(
        checker.check('testuser', {
          sites: ['zzzzzzzzzzzzzzzzzz'],
        }),
      ).rejects.toThrow(/Unknown site: "zzzzzzzzzzzzzzzzzz"/);
    });

    it('should use the plural unknown-sites error when multiple sites are missing', async () => {
      const checker = new UsernameChecker();

      await expect(
        checker.check('testuser', {
          sites: ['zzzzzzzzzzzzzzzzzz', 'yyyyyyyyyyyyyyyyyy'],
        }),
      ).rejects.toThrow(/Unknown sites:/);
    });

    it('should call onProgress callback', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const onProgress = vi.fn<(progress: CheckProgress) => void>();
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

      const onProgress = vi.fn<(progress: CheckProgress) => void>();
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

      const onProgress = vi.fn<(progress: CheckProgress) => void>();
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
      await expect(checker.check('user name')).rejects.toThrow();
    });

    it('should allow one-character usernames on supported sites and mark unsupported sites invalid', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://flipboard.com/@a',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const results = await checker.check('a', {
        sites: ['Flipboard', 'Flightradar24'],
      });

      expect(results).toHaveLength(2);
      expect(results.find((result) => result.site === 'Flipboard')?.status).toBe('available');
      expect(results.find((result) => result.site === 'Flightradar24')?.status).toBe('invalid');
    });

    it('should allow @ usernames on supported sites and mark unsupported sites invalid', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://translate.jellyfin.org/user/@alias/',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const results = await checker.check('@alias', {
        sites: ['Jellyfin Weblate', 'GitHub'],
      });

      expect(results).toHaveLength(2);
      expect(results.find((result) => result.site === 'Jellyfin Weblate')?.status).toBe('available');
      expect(results.find((result) => result.site === 'GitHub')?.status).toBe('invalid');
    });

    it('should handle empty site list', async () => {
      const checker = new UsernameChecker();
      const results = await checker.check('testuser', {
        sites: [],
      });
      expect(results).toEqual([]);
    });

    it('should use an injected repository instead of the global site registry', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://example.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const repository = ManifestRepository.fromSiteConfigs({
        Example: {
          name: 'Example',
          url: 'https://example.com/{}',
          urlMain: 'https://example.com/',
          errorType: DetectionMethod.STATUS_CODE,
        },
      });
      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
        repository,
      });

      const results = await checker.check('testuser');

      expect(results).toHaveLength(1);
      expect(results[0].site).toBe('Example');
      expect(results[0].status).toBe('available');
    });
  });

  describe('checkBatch()', () => {
    it('should check multiple usernames across sites', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/user',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        maxConcurrency: 2,
        retries: 0,
      });

      const results = await checker.checkBatch(['user1', 'user2'], {
        sites: ['GitHub'],
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      expect(results[0].username).toBe('user1');
      expect(results[1].username).toBe('user2');
    });

    it('should call onBatchProgress callback', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/user',
        text: async () => '',
        headers: new Headers(),
      });

      const onBatchProgress = vi.fn<(progress: import('../src/types.js').BatchCheckProgress) => void>();
      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      await checker.checkBatch(['user1', 'user2'], {
        sites: ['GitHub'],
        onBatchProgress,
      });

      expect(onBatchProgress).toHaveBeenCalled();
      expect(onBatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUsername: expect.any(String),
          currentUsernameIndex: expect.any(Number),
          totalUsernames: 2,
        }),
      );
    });

    it('should include normalized username in batch result', async () => {
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

      const results = await checker.checkBatch(['TestUser123'], {
        sites: ['GitHub'],
      });

      expect(results[0].normalizedUsername).toBe('TestUser123');
    });

    it('should include batch summary', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/user',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const results = await checker.checkBatch(['user1'], {
        sites: ['GitHub', 'Twitter'],
      });

      expect(results[0].summary).toBeDefined();
      expect(results[0].summary.total).toBe(2);
      expect(results[0].summary.available).toBeGreaterThanOrEqual(0);
      expect(results[0].summary.taken).toBeGreaterThanOrEqual(0);
      expect(results[0].summary.errors).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty username list', async () => {
      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const results = await checker.checkBatch([], {
        sites: ['GitHub'],
      });

      expect(results).toHaveLength(0);
    });

    it('should respect abort signal', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                status: 200,
                url: 'https://github.com/user',
                text: async () => '',
                headers: new Headers(),
              });
            }, 100);
          }),
      );

      const controller = new AbortController();
      const checker = new UsernameChecker({
        timeout: 10000,
        retries: 0,
      });

      setTimeout(() => {
        controller.abort();
      }, 50);

      const results = await checker.checkBatch(['user1', 'user2', 'user3'], {
        sites: ['GitHub'],
        signal: controller.signal,
      });

      // Should stop before checking all usernames
      expect(results.length).toBeLessThan(3);
    });

    it('should track progress with site results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/user',
        text: async () => '',
        headers: new Headers(),
      });

      const onBatchProgress = vi.fn<(progress: import('../src/types.js').BatchCheckProgress) => void>();
      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      await checker.checkBatch(['user1'], {
        sites: ['GitHub'],
        onBatchProgress,
      });

      // Should have batch progress updates with site progress
      const callsWithSiteProgress = onBatchProgress.mock.calls.filter((call) => call[0].siteProgress !== undefined);
      expect(callsWithSiteProgress.length).toBeGreaterThan(0);
    });

    it('should handle batch check with errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const checker = new UsernameChecker({
        timeout: 100,
        retries: 0,
      });

      const results = await checker.checkBatch(['user1'], {
        sites: ['GitHub'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].results[0].status).toBe('error');
      expect(results[0].summary.errors).toBe(1);
    });

    it('should count available results in batch summary', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://github.com/freeuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const results = await checker.checkBatch(['freeuser'], {
        sites: ['GitHub'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].results[0].status).toBe('available');
      expect(results[0].summary.available).toBe(1);
    });

    it('should not count invalid status in batch summary errors', async () => {
      const siteWithRegex: SiteConfig = {
        name: 'StrictSite',
        url: 'https://strictsite.example/{}',
        urlMain: 'https://strictsite.example',
        errorType: DetectionMethod.STATUS_CODE,
        regexCheck: '^[a-z]+$',
      };
      const repo = ManifestRepository.fromSiteConfigs({ StrictSite: siteWithRegex });
      const checker = new UsernameChecker({ timeout: 1000, retries: 0, repository: repo });

      const results = await checker.checkBatch(['UPPERCASE123'], {
        sites: ['StrictSite'],
      });

      expect(results[0].results[0].status).toBe('invalid');
      expect(results[0].summary.errors).toBe(0);
      expect(results[0].summary.available).toBe(0);
      expect(results[0].summary.taken).toBe(0);
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

    it('should preserve site-specific errorCode behavior for Slides', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        url: 'https://slides.com/missing',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('missing', 'Slides');

      expect(result.status).toBe('available');
      expect(result.diagnostics?.requestMethod).toBe('HEAD');
    });

    it('should preserve explicit GET probes for Platzi', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://platzi.com/p/missing/',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('missing', 'Platzi');

      expect(result.status).toBe('available');
      expect(result.diagnostics?.requestMethod).toBe('GET');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://platzi.com/p/missing/',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should attach diagnostics for invalid site-specific usernames', async () => {
      const checker = new UsernameChecker();
      const result = await checker.checkSite('@alias', 'GitHub');

      expect(result.status).toBe('invalid');
      expect(result.diagnostics).toEqual(
        expect.objectContaining({
          requestMethod: 'HEAD',
          detectionMethods: [DetectionMethod.STATUS_CODE],
          followRedirects: true,
        }),
      );
      expect(result.diagnostics?.probeUrl).toContain('/@alias');
    });

    it('should classify blocked challenge pages as transport errors with diagnostics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/testuser',
        text: async () => responseFixtures.awsWafChallenge,
        headers: new Headers({ 'x-amzn-errortype': 'WAFBlocked' }),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('testuser', 'custom-blocked', regressionSiteFixtures.addonsWago);

      expect(result.status).toBe('error');
      expect(result.errorCategory).toBe(ErrorCategory.BLOCKED);
      expect(result.errorMessage).toContain('Blocked');
      expect(result.diagnostics).toEqual(
        expect.objectContaining({
          requestMethod: 'HEAD',
          probeUrl: 'https://addons.wago.io/user/testuser',
          detectionMethods: [DetectionMethod.STATUS_CODE],
        }),
      );
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

    it('should handle regression fixtures with custom status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://wowhead.com/user=missing',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({ timeout: 1000, retries: 0 });
      const result = await checker.checkSite('missing', 'wowhead', regressionSiteFixtures.wowhead);

      expect(result.status).toBe('available');
    });

    it('should include diagnostic errorCodes arrays when configured', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://example.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({ timeout: 1000, retries: 0 });
      const result = await checker.checkSite('testuser', 'custom-array-codes', {
        name: 'Custom Array Codes',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com/',
        errorType: DetectionMethod.STATUS_CODE,
        errorCode: [404, 410],
      });

      expect(result.diagnostics?.errorCodes).toEqual([404, 410]);
    });

    it('should include multiple detection methods in diagnostics when configured', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/testuser',
        text: async () => 'profile page',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({ timeout: 1000, retries: 0 });
      const result = await checker.checkSite('testuser', 'custom-mixed-detection', {
        name: 'Custom Mixed Detection',
        url: 'https://example.com/{}',
        urlMain: 'https://example.com/',
        errorType: [DetectionMethod.MESSAGE, DetectionMethod.STATUS_CODE],
        errorMsg: 'missing',
      });

      expect(result.diagnostics?.detectionMethods).toEqual([DetectionMethod.MESSAGE, DetectionMethod.STATUS_CODE]);
    });

    it('should include debug status by default when debug mode is enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers({ 'x-test': 'present' }),
      });

      const checker = new UsernameChecker({ timeout: 1000, retries: 0 });
      const result = await checker.checkSite('testuser', 'GitHub', undefined, undefined, {});

      expect(result.debug).toEqual({ statusCode: 200, responseHeaders: undefined, responseBody: undefined });
    });

    it('should include debug headers and truncate long debug bodies', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '0123456789',
        headers: new Headers({ 'x-test': 'present' }),
      });

      const checker = new UsernameChecker({ timeout: 1000, retries: 0 });
      const result = await checker.checkSite('testuser', 'GitHub', undefined, undefined, {
        includeHeaders: true,
        includeBody: true,
        maxBodyLength: 5,
      });

      expect(result.debug).toEqual({
        statusCode: 200,
        responseHeaders: { 'x-test': 'present' },
        responseBody: '01234\n... [truncated 5 chars]',
      });
    });

    it('should include non-truncated debug bodies when under max length', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => 'short',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({ timeout: 1000, retries: 0 });
      const result = await checker.checkSite('testuser', 'GitHub', undefined, undefined, {
        includeBody: true,
        maxBodyLength: 10,
      });

      expect(result.debug?.responseBody).toBe('short');
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
      const detectSpy = vi.spyOn(Detector, 'detect').mockImplementation(() => {
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

      detectSpy.mockRestore();
    });

    it('should catch non-Error exceptions in checkSite', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://github.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const detectSpy = vi.spyOn(Detector, 'detect').mockImplementation(() => {
        throw 'boom';
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
      });

      const result = await checker.checkSite('testuser', 'GitHub');

      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('boom');
      expect(result.errorCategory).toBe(ErrorCategory.UNKNOWN);

      detectSpy.mockRestore();
    });
  });

  describe('caching behavior', () => {
    it('should cache results when cache is enabled', async () => {
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
        cache: { type: 'memory' },
      });

      // First call should fetch
      const result1 = await checker.checkSite('testuser', 'GitHub');
      expect(result1.status).toBe('taken');

      mockFetch.mockClear();

      // Second call should use cache
      const result2 = await checker.checkSite('testuser', 'GitHub');
      expect(result2).toEqual(result1);

      // Fetch should not have been called again
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not cache when cache is disabled', async () => {
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
        // No cache option
      });

      await checker.checkSite('testuser', 'GitHub');
      const firstCallCount = mockFetch.mock.calls.length;

      await checker.checkSite('testuser', 'GitHub');
      const secondCallCount = mockFetch.mock.calls.length;

      // Fetch should be called again if caching is disabled
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it('should cache different usernames separately', async () => {
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
        cache: { type: 'memory' },
      });

      const result1 = await checker.checkSite('user1', 'GitHub');
      const result2 = await checker.checkSite('user2', 'GitHub');

      expect(result1.url).not.toBe(result2.url);
    });

    it('should cache different sites separately', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/testuser',
        text: async () => '',
        headers: new Headers(),
      });

      const checker = new UsernameChecker({
        timeout: 1000,
        retries: 0,
        cache: { type: 'memory' },
      });

      await checker.checkSite('testuser', 'GitHub');
      const firstCallCount = mockFetch.mock.calls.length;

      await checker.checkSite('testuser', 'Twitter');
      const secondCallCount = mockFetch.mock.calls.length;

      // Second site check should have made additional fetch calls
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
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

      it('should return true for existing site with different casing', () => {
        expect(UsernameChecker.hasSite('github')).toBe(true);
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

      it('should resolve site config case-insensitively', () => {
        const site = UsernameChecker.getSite('github');
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
