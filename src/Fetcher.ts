/**
 * Fetcher class - Static methods for HTTP fetching with retry logic
 */

import type { HttpsProxyAgent } from 'https-proxy-agent';
import type { SocksProxyAgent } from 'socks-proxy-agent';
import { ErrorCategory, type RetryConfig, type FetchResult } from './types.js';

/**
 * Default headers for requests
 */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'close',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 2,
  retryDelay: 1000,
  backoffMultiplier: 2,
};

/**
 * HTTP status codes that should trigger a retry
 */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);

/**
 * Static class for HTTP fetch operations with retry logic
 */
export class Fetcher {
  /**
   * Fetch a URL with retry logic
   */
  static async fetch(
    url: string,
    options: {
      method?: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: string | object;
      timeout?: number;
      proxy?: HttpsProxyAgent<string> | SocksProxyAgent;
      retryConfig?: RetryConfig;
      signal?: AbortSignal;
    } = {},
  ): Promise<FetchResult> {
    const { method = 'GET', headers = {}, body, timeout = 15000, proxy, retryConfig = {}, signal } = options;

    const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= config.maxRetries) {
      try {
        const result = await this.singleFetch(url, {
          method,
          headers,
          body,
          timeout,
          proxy,
          signal,
        });

        // Check if we should retry based on status code
        if (RETRYABLE_STATUS_CODES.has(result.statusCode) && attempt < config.maxRetries) {
          attempt++;
          await this.sleep(config.retryDelay * Math.pow(config.backoffMultiplier, attempt - 1));
          continue;
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorCategory = this.categorizeError(lastError);

        // Don't retry certain errors
        if (errorCategory === ErrorCategory.TIMEOUT && attempt >= config.maxRetries) {
          break;
        }

        if (attempt < config.maxRetries) {
          attempt++;
          await this.sleep(config.retryDelay * Math.pow(config.backoffMultiplier, attempt - 1));
          continue;
        }

        break;
      }
    }

    // All retries failed
    const errorCategory = lastError ? this.categorizeError(lastError) : ErrorCategory.UNKNOWN;
    return {
      statusCode: 0,
      body: '',
      headers: {},
      finalUrl: url,
      errorCategory,
      errorMessage: lastError?.message,
    };
  }

  /**
   * Single fetch attempt
   */
  private static async singleFetch(
    url: string,
    options: {
      method: 'GET' | 'POST';
      headers: Record<string, string>;
      body?: string | object;
      timeout: number;
      proxy?: HttpsProxyAgent<string> | SocksProxyAgent;
      signal?: AbortSignal;
    },
  ): Promise<FetchResult> {
    const { method, headers, body, timeout, proxy, signal } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Link external signal if provided
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal,
        redirect: 'follow',
      };

      // Add body for POST requests
      if (body && method === 'POST') {
        if (typeof body === 'object') {
          fetchOptions.body = JSON.stringify(body);
          (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
        } else {
          fetchOptions.body = body;
        }
      }

      // Add proxy agent if provided
      if (proxy) {
        // @ts-expect-error - dispatcher is a valid option for undici-based fetch
        fetchOptions.dispatcher = proxy;
      }

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();

      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        statusCode: response.status,
        body: responseText,
        headers: responseHeaders,
        finalUrl: response.url,
        errorCategory: ErrorCategory.NONE,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Categorize an error for reporting
   */
  static categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('aborted')) {
      return ErrorCategory.TIMEOUT;
    }

    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorCategory.RATE_LIMITED;
    }

    if (message.includes('5') || message.includes('server error') || message.includes('internal server')) {
      return ErrorCategory.SERVER_ERROR;
    }

    if (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('enetunreach') ||
      message.includes('connection') ||
      message.includes('network')
    ) {
      return ErrorCategory.CONNECTION_ERROR;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Get default headers
   */
  static get defaultHeaders(): Record<string, string> {
    return { ...DEFAULT_HEADERS };
  }

  /**
   * Get default retry config
   */
  static get defaultRetryConfig(): Required<RetryConfig> {
    return { ...DEFAULT_RETRY_CONFIG };
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
