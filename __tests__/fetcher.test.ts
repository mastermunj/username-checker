/**
 * Tests for Fetcher class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Fetcher } from '../src/Fetcher.js';
import { ErrorCategory } from '../src/types.js';
import { responseFixtures } from './fixtures/accuracy-fixtures.js';

type MockResponse = {
  ok: boolean;
  status: number;
  url: string;
  text: () => Promise<string>;
  headers: Headers;
};

// Mock fetch globally
const mockFetch = vi.fn<(input: string, init?: RequestInit) => Promise<MockResponse>>();

describe('Fetcher', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetch()', () => {
    it('should make successful GET request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/user',
        text: async () => 'Hello World',
        headers: new Headers({ 'content-type': 'text/html' }),
      });

      const result = await Fetcher.fetch('https://example.com/user');

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Hello World');
      expect(result.finalUrl).toBe('https://example.com/user');
      expect(result.errorCategory).toBe(ErrorCategory.NONE);
    });

    it('should make POST request with body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://api.example.com/check',
        text: async () => '{"valid": true}',
        headers: new Headers(),
      });

      const result = await Fetcher.fetch('https://api.example.com/check', {
        method: 'POST',
        body: { username: 'test' },
      });

      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/check',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'test' }),
        }),
      );
    });

    it('should make HEAD requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/user',
        text: async () => '',
        headers: new Headers(),
      });

      await Fetcher.fetch('https://example.com/user', {
        method: 'HEAD',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/user',
        expect.objectContaining({
          method: 'HEAD',
        }),
      );
    });

    it('should make PUT request with body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://api.example.com/check',
        text: async () => '{"updated": true}',
        headers: new Headers(),
      });

      await Fetcher.fetch('https://api.example.com/check', {
        method: 'PUT',
        body: { username: 'test' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/check',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ username: 'test' }),
        }),
      );
    });

    it('should handle 404 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        url: 'https://example.com/user',
        text: async () => 'Not Found',
        headers: new Headers(),
      });

      const result = await Fetcher.fetch('https://example.com/user');

      expect(result.statusCode).toBe(404);
      expect(result.errorCategory).toBe(ErrorCategory.NONE);
    });

    it('should classify rate-limited bodies even on 200 responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/user',
        text: async () => responseFixtures.rateLimitedBody,
        headers: new Headers(),
      });

      const result = await Fetcher.fetch('https://example.com/user');

      expect(result.errorCategory).toBe(ErrorCategory.RATE_LIMITED);
      expect(result.errorMessage).toContain('Rate limited');
    });

    it('should classify challenge pages as blocked', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/user',
        text: async () => responseFixtures.cloudflareChallenge,
        headers: new Headers({ 'cf-mitigated': 'challenge' }),
      });

      const result = await Fetcher.fetch('https://example.com/user');

      expect(result.errorCategory).toBe(ErrorCategory.BLOCKED);
      expect(result.errorMessage).toContain('Blocked');
    });

    it('should allow manual redirect handling when requested', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 302,
        url: 'https://example.com/user/test',
        text: async () => '',
        headers: new Headers({ location: 'https://example.com/404' }),
      });

      await Fetcher.fetch('https://example.com/user/test', {
        followRedirects: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/user/test',
        expect.objectContaining({
          redirect: 'manual',
        }),
      );
    });

    it('should classify 429 responses as rate limited', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        url: 'https://example.com/user',
        text: async () => '',
        headers: new Headers(),
      });

      const result = await Fetcher.fetch('https://example.com/user', {
        retryConfig: { maxRetries: 0 },
      });

      expect(result.errorCategory).toBe(ErrorCategory.RATE_LIMITED);
    });

    it('should include retry-after information in rate-limit messages', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/user',
        text: async () => '',
        headers: new Headers({ 'retry-after': '30' }),
      });

      const result = await Fetcher.fetch('https://example.com/user');

      expect(result.errorCategory).toBe(ErrorCategory.RATE_LIMITED);
      expect(result.errorMessage).toContain('retry after 30s');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await Fetcher.fetch('https://broken-site.invalid', {
        retryConfig: { maxRetries: 0 },
      });

      expect(result.statusCode).toBe(0);
      expect(result.errorCategory).toBe(ErrorCategory.CONNECTION_ERROR);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('The operation was aborted'));

      const result = await Fetcher.fetch('https://slow-site.example', {
        timeout: 100,
        retryConfig: { maxRetries: 0 },
      });

      expect(result.statusCode).toBe(0);
      expect(result.errorCategory).toBe(ErrorCategory.TIMEOUT);
    });

    it('should retry on retryable status codes', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          url: 'https://example.com',
          text: async () => 'Service Unavailable',
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          url: 'https://example.com',
          text: async () => 'OK',
          headers: new Headers(),
        });

      const result = await Fetcher.fetch('https://example.com', {
        retryConfig: { maxRetries: 2, retryDelay: 10, backoffMultiplier: 1 },
      });

      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should merge custom headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com',
        text: async () => '',
        headers: new Headers(),
      });

      await Fetcher.fetch('https://example.com', {
        headers: { 'Custom-Header': 'value' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Custom-Header': 'value',
          }),
        }),
      );
    });

    it('should make POST request with string body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://api.example.com/check',
        text: async () => 'success',
        headers: new Headers(),
      });

      const result = await Fetcher.fetch('https://api.example.com/check', {
        method: 'POST',
        body: 'username=test',
      });

      expect(result.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/check',
        expect.objectContaining({
          method: 'POST',
          body: 'username=test',
        }),
      );
    });

    it('should respect external abort signal', async () => {
      const abortController = new AbortController();

      mockFetch.mockImplementation(async () => {
        return new Promise((_, reject) => {
          const checkAbort = () => {
            if (abortController.signal.aborted) {
              reject(new Error('The operation was aborted'));
            }
          };
          setTimeout(checkAbort, 10);
        });
      });

      abortController.abort();
      const result = await Fetcher.fetch('https://example.com', {
        signal: abortController.signal,
        retryConfig: { maxRetries: 0 },
      });

      expect(result.errorCategory).toBe(ErrorCategory.TIMEOUT);
    });

    it('should attach an abort listener for active external signals', async () => {
      const abortController = new AbortController();

      mockFetch.mockImplementation(async () => {
        return new Promise<MockResponse>((_, reject) => {
          abortController.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')), {
            once: true,
          });
        });
      });

      const resultPromise = Fetcher.fetch('https://example.com', {
        signal: abortController.signal,
        retryConfig: { maxRetries: 0 },
      });

      abortController.abort();
      const result = await resultPromise;

      expect(result.errorCategory).toBe(ErrorCategory.TIMEOUT);
    });

    it('should handle proxy option', async () => {
      const mockProxy = { type: 'https' } as never;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com',
        text: async () => '',
        headers: new Headers(),
      });

      await Fetcher.fetch('https://example.com', {
        proxy: mockProxy,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          dispatcher: mockProxy,
        }),
      );
    });

    it('should retry on network error and eventually fail', async () => {
      mockFetch.mockRejectedValue(new Error('connection refused'));

      const result = await Fetcher.fetch('https://example.com', {
        retryConfig: { maxRetries: 2, retryDelay: 10, backoffMultiplier: 1 },
      });

      expect(result.statusCode).toBe(0);
      expect(result.errorCategory).toBe(ErrorCategory.CONNECTION_ERROR);
      expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should not retry a retryable status code when the external signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        url: 'https://example.com',
        text: async () => 'Service Unavailable',
        headers: new Headers(),
      });

      const result = await Fetcher.fetch('https://example.com', {
        signal: controller.signal,
        retryConfig: { maxRetries: 2, retryDelay: 10, backoffMultiplier: 1 },
      });

      // Should return the 503 result without retrying because the signal was aborted
      expect(result.statusCode).toBe(503);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should normalize non-Error failures into Error instances', async () => {
      mockFetch.mockRejectedValue('boom');

      const result = await Fetcher.fetch('https://example.com', {
        retryConfig: { maxRetries: 0 },
      });

      expect(result.statusCode).toBe(0);
      expect(result.errorCategory).toBe(ErrorCategory.UNKNOWN);
      expect(result.errorMessage).toBe('boom');
    });
  });

  describe('categorizeError()', () => {
    it('should categorize timeout errors', () => {
      expect(Fetcher.categorizeError(new Error('timeout'))).toBe(ErrorCategory.TIMEOUT);
      expect(Fetcher.categorizeError(new Error('The operation was aborted'))).toBe(ErrorCategory.TIMEOUT);
    });

    it('should categorize rate limit errors', () => {
      expect(Fetcher.categorizeError(new Error('429 Too Many Requests'))).toBe(ErrorCategory.RATE_LIMITED);
      expect(Fetcher.categorizeError(new Error('rate limit exceeded'))).toBe(ErrorCategory.RATE_LIMITED);
    });

    it('should categorize blocked challenge errors', () => {
      expect(Fetcher.categorizeError(new Error('Cloudflare challenge page'))).toBe(ErrorCategory.BLOCKED);
      expect(Fetcher.categorizeError(new Error('AWS WAF blocked request'))).toBe(ErrorCategory.BLOCKED);
    });

    it('should categorize connection errors', () => {
      expect(Fetcher.categorizeError(new Error('ECONNREFUSED'))).toBe(ErrorCategory.CONNECTION_ERROR);
      expect(Fetcher.categorizeError(new Error('ENOTFOUND'))).toBe(ErrorCategory.CONNECTION_ERROR);
      expect(Fetcher.categorizeError(new Error('network error'))).toBe(ErrorCategory.CONNECTION_ERROR);
      expect(Fetcher.categorizeError(new Error('TLS certificate failure'))).toBe(ErrorCategory.CONNECTION_ERROR);
    });

    it('should categorize server errors', () => {
      expect(Fetcher.categorizeError(new Error('500 Internal Server Error'))).toBe(ErrorCategory.SERVER_ERROR);
      expect(Fetcher.categorizeError(new Error('server error occurred'))).toBe(ErrorCategory.SERVER_ERROR);
      expect(Fetcher.categorizeError(new Error('internal server'))).toBe(ErrorCategory.SERVER_ERROR);
    });

    it('should categorize unknown errors', () => {
      expect(Fetcher.categorizeError(new Error('Some random error'))).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe('defaultHeaders', () => {
    it('should return headers object', () => {
      const headers = Fetcher.defaultHeaders;
      expect(headers).toHaveProperty('User-Agent');
      expect(headers).toHaveProperty('Accept');
    });

    it('should return a copy not the original', () => {
      const headers1 = Fetcher.defaultHeaders;
      const headers2 = Fetcher.defaultHeaders;
      headers1.Custom = 'value';
      expect(headers2).not.toHaveProperty('Custom');
    });
  });

  describe('defaultRetryConfig', () => {
    it('should return retry config object', () => {
      const config = Fetcher.defaultRetryConfig;
      expect(config).toHaveProperty('maxRetries');
      expect(config).toHaveProperty('retryDelay');
      expect(config).toHaveProperty('backoffMultiplier');
    });
  });
});
