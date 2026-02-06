/**
 * Tests for Fetcher class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Fetcher } from '../src/Fetcher.js';
import { ErrorCategory } from '../src/types.js';

// Mock fetch globally
const mockFetch = vi.fn();

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

    it('should categorize connection errors', () => {
      expect(Fetcher.categorizeError(new Error('ECONNREFUSED'))).toBe(ErrorCategory.CONNECTION_ERROR);
      expect(Fetcher.categorizeError(new Error('ENOTFOUND'))).toBe(ErrorCategory.CONNECTION_ERROR);
      expect(Fetcher.categorizeError(new Error('network error'))).toBe(ErrorCategory.CONNECTION_ERROR);
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
