/**
 * Fetcher class - Static methods for HTTP fetching with retry logic
 */

import type { HttpsProxyAgent } from 'https-proxy-agent';
import type { SocksProxyAgent } from 'socks-proxy-agent';
import { ErrorCategory, type RetryConfig, type FetchResult, type RequestMethod } from './types.js';

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

const RATE_LIMIT_PATTERNS = [/too many requests/i, /rate limit/i, /try again later/i, /slow down/i];

const BLOCKED_RESPONSE_PATTERNS = [
  /challenge-error-text/i,
  /challenge-running/i,
  /cf-browser-verification/i,
  /awswafintegration\.forcerefreshtoken/i,
  /attention required!?\s*\|\s*cloudflare/i,
  /captcha/i,
  /access denied/i,
];

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
      method?: RequestMethod;
      headers?: Record<string, string>;
      body?: string | object;
      timeout?: number;
      proxy?: HttpsProxyAgent<string> | SocksProxyAgent;
      retryConfig?: RetryConfig;
      followRedirects?: boolean;
      signal?: AbortSignal;
    } = {},
  ): Promise<FetchResult> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 15000,
      proxy,
      retryConfig = {},
      followRedirects = true,
      signal,
    } = options;

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
          followRedirects,
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
    const finalError = lastError!;
    const errorCategory = this.categorizeError(finalError);
    return {
      statusCode: 0,
      body: '',
      headers: {},
      finalUrl: url,
      errorCategory,
      errorMessage: finalError.message,
    };
  }

  /**
   * Single fetch attempt
   */
  private static async singleFetch(
    url: string,
    options: {
      method: RequestMethod;
      headers: Record<string, string>;
      body?: string | object;
      timeout: number;
      proxy?: HttpsProxyAgent<string> | SocksProxyAgent;
      followRedirects: boolean;
      signal?: AbortSignal;
    },
  ): Promise<FetchResult> {
    const { method, headers, body, timeout, proxy, followRedirects, signal } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const abortHandler = () => controller.abort();

    // Link external signal if provided
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal,
        redirect: followRedirects ? 'follow' : 'manual',
      };

      // Add body for methods that support payloads
      if (body && method !== 'GET' && method !== 'HEAD') {
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

      const errorCategory = this.classifyResponse(response.status, responseText, responseHeaders);

      return {
        statusCode: response.status,
        body: responseText,
        headers: responseHeaders,
        finalUrl: response.url,
        errorCategory,
        errorMessage: this.buildResponseErrorMessage(errorCategory, response.status, responseHeaders),
      };
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortHandler);
    }
  }

  private static classifyResponse(statusCode: number, body: string, headers: Record<string, string>): ErrorCategory {
    if (statusCode === 429) {
      return ErrorCategory.RATE_LIMITED;
    }

    if (statusCode >= 500) {
      return ErrorCategory.SERVER_ERROR;
    }

    const retryAfter = headers['retry-after'];
    const rateLimitRemaining = headers['x-ratelimit-remaining'];
    const blockedHeader = headers['cf-mitigated'];
    const awsErrorType = headers['x-amzn-errortype']?.toLowerCase();

    if (retryAfter || rateLimitRemaining === '0' || RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(body))) {
      return ErrorCategory.RATE_LIMITED;
    }

    if (
      blockedHeader === 'challenge' ||
      awsErrorType?.includes('waf') ||
      BLOCKED_RESPONSE_PATTERNS.some((pattern) => pattern.test(body))
    ) {
      return ErrorCategory.BLOCKED;
    }

    return ErrorCategory.NONE;
  }

  private static buildResponseErrorMessage(
    errorCategory: ErrorCategory,
    statusCode: number,
    headers: Record<string, string>,
  ): string | undefined {
    switch (errorCategory) {
      case ErrorCategory.RATE_LIMITED: {
        const retryAfter = headers['retry-after'];
        if (retryAfter) {
          return `Rate limited by remote service (retry after ${retryAfter}s)`;
        }

        return `Rate limited by remote service (HTTP ${statusCode})`;
      }

      case ErrorCategory.BLOCKED:
        return `Blocked by remote service challenge or access control (HTTP ${statusCode})`;

      case ErrorCategory.SERVER_ERROR:
        return `Remote service returned HTTP ${statusCode}`;

      default:
        return undefined;
    }
  }

  /**
   * Categorize an error for reporting
   */
  static categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (/(timeout|timed out|abort(?:ed)?)/.test(message)) {
      return ErrorCategory.TIMEOUT;
    }

    if (/(429|rate limit(?:ed)?|too many requests|retry after)/.test(message)) {
      return ErrorCategory.RATE_LIMITED;
    }

    if (/(cloudflare|captcha|challenge|access denied|waf)/.test(message)) {
      return ErrorCategory.BLOCKED;
    }

    if (/(\b5\d\d\b|server error|internal server|bad gateway|service unavailable|gateway timeout)/.test(message)) {
      return ErrorCategory.SERVER_ERROR;
    }

    if (
      /(econnrefused|enotfound|enetunreach|eai_again|fetch failed|socket hang up|certificate|tls|connection reset)/.test(
        message,
      ) ||
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
