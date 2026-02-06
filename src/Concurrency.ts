/**
 * Concurrency module - Classes for managing concurrent operations
 */

import type { ConcurrencyOptions } from './types.js';

/**
 * Semaphore for limiting concurrent operations
 */
export class Semaphore {
  private permits: number;
  private waitQueue: Array<{ resolve: () => void; priority: number }> = [];

  constructor(permits: number) {
    if (permits < 1) {
      throw new Error('Semaphore must have at least 1 permit');
    }
    this.permits = permits;
  }

  /**
   * Acquire a permit, waiting if necessary
   */
  async acquire(priority = 0): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      // Insert in priority order (higher priority first)
      const entry = { resolve, priority };
      const index = this.waitQueue.findIndex((e) => e.priority < priority);
      if (index === -1) {
        this.waitQueue.push(entry);
      } else {
        this.waitQueue.splice(index, 0, entry);
      }
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next.resolve();
    } else {
      this.permits++;
    }
  }

  /**
   * Get available permits
   */
  get available(): number {
    return this.permits;
  }

  /**
   * Get queue length
   */
  get queueLength(): number {
    return this.waitQueue.length;
  }
}

/**
 * Domain-based rate limiter to prevent overwhelming single domains
 */
export class DomainRateLimiter {
  private lastRequestTime = new Map<string, number>();
  private readonly minDelayMs: number;

  constructor(minDelayMs = 100) {
    this.minDelayMs = minDelayMs;
  }

  /**
   * Wait if needed to respect rate limit for a domain
   */
  async waitForDomain(domain: string): Promise<void> {
    const lastTime = this.lastRequestTime.get(domain);
    if (lastTime) {
      const elapsed = Date.now() - lastTime;
      if (elapsed < this.minDelayMs) {
        await this.sleep(this.minDelayMs - elapsed);
      }
    }
    this.lastRequestTime.set(domain, Date.now());
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear tracked domains
   */
  clear(): void {
    this.lastRequestTime.clear();
  }
}

/**
 * Default concurrency options
 */
const DEFAULT_OPTIONS: ConcurrencyOptions = {
  maxConcurrency: 50,
  domainDelay: 100,
  timeout: 15000,
};

/**
 * Controller for managing concurrent operations with domain rate limiting
 */
export class ConcurrencyController {
  private semaphore: Semaphore;
  private rateLimiter: DomainRateLimiter;
  private abortController: AbortController;
  private readonly timeout: number;

  constructor(options: Partial<ConcurrencyOptions> = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.semaphore = new Semaphore(opts.maxConcurrency);
    this.rateLimiter = new DomainRateLimiter(opts.domainDelay);
    this.timeout = opts.timeout ?? 15000;
    this.abortController = new AbortController();
  }

  /**
   * Run tasks with concurrency control
   */
  async run<T, R>(
    items: T[],
    task: (item: T, signal?: AbortSignal) => Promise<R>,
    options: {
      onResult?: (result: R, item: T) => void;
      onError?: (error: Error, item: T) => void;
      getDomain?: (item: T) => string;
    } = {},
  ): Promise<R[]> {
    const { onResult, onError, getDomain } = options;
    // Reset abortController for new run
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const results: R[] = [];
    const errors: Array<{ item: T; error: Error }> = [];

    const runTask = async (item: T, index: number): Promise<void> => {
      if (signal.aborted) {
        return;
      }

      await this.semaphore.acquire();

      try {
        if (signal.aborted) {
          return;
        }

        // Apply domain rate limiting if getDomain is provided
        if (getDomain) {
          const domain = getDomain(item);
          await this.rateLimiter.waitForDomain(domain);
        }

        if (signal.aborted) {
          return;
        }

        const result = await this.runWithTimeout(task(item, signal), this.timeout);

        results[index] = result;
        onResult?.(result, item);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ item, error: err });
        onError?.(err, item);
      } finally {
        this.semaphore.release();
      }
    };

    await Promise.all(items.map((item, index) => runTask(item, index)));

    return results;
  }

  /**
   * Abort all running operations
   */
  abort(): void {
    this.abortController.abort();
  }

  /**
   * Check if controller is aborted
   */
  get isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  /**
   * Reset the controller for reuse
   */
  reset(): void {
    this.abortController = new AbortController();
    this.rateLimiter.clear();
  }

  private runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Operation timed out')), ms);
      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}

/**
 * Run tasks with concurrency control (standalone function)
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  task: (item: T) => Promise<R>,
  maxConcurrency = 50,
): Promise<R[]> {
  const controller = new ConcurrencyController({ maxConcurrency });
  return controller.run(items, task);
}
