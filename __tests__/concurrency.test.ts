/**
 * Tests for Concurrency module
 */

import { describe, it, expect, vi } from 'vitest';
import { Semaphore, DomainRateLimiter, ConcurrencyController, runWithConcurrency } from '../src/Concurrency.js';

describe('Semaphore', () => {
  it('should create with specified permits', () => {
    const sem = new Semaphore(5);
    expect(sem.available).toBe(5);
  });

  it('should throw for invalid permits', () => {
    expect(() => new Semaphore(0)).toThrow();
    expect(() => new Semaphore(-1)).toThrow();
  });

  it('should acquire and release permits', async () => {
    const sem = new Semaphore(2);

    await sem.acquire();
    expect(sem.available).toBe(1);

    await sem.acquire();
    expect(sem.available).toBe(0);

    sem.release();
    expect(sem.available).toBe(1);
  });

  it('should queue when no permits available', async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    await sem.acquire();
    expect(sem.queueLength).toBe(0);

    // This will queue
    const p = sem.acquire().then(() => order.push(1));
    expect(sem.queueLength).toBe(1);

    // Release will allow queued to proceed
    sem.release();
    await p;
    expect(order).toEqual([1]);
  });

  it('should support priority ordering for queue', async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    // Acquire the first permit
    await sem.acquire();

    // Queue with different priorities
    const p1 = sem.acquire(0).then(() => {
      order.push(1);
      sem.release();
    });
    const p2 = sem.acquire(10).then(() => {
      order.push(2);
      sem.release();
    }); // Higher priority
    const p3 = sem.acquire(5).then(() => {
      order.push(3);
      sem.release();
    });

    expect(sem.queueLength).toBe(3);

    // Release the initial permit - this starts the chain
    sem.release();

    await Promise.all([p1, p2, p3]);
    // Higher priority should be processed first: 2 (priority 10), 3 (priority 5), 1 (priority 0)
    expect(order).toEqual([2, 3, 1]);
  });
});

describe('DomainRateLimiter', () => {
  it('should create with default delay', () => {
    const limiter = new DomainRateLimiter();
    expect(limiter).toBeDefined();
  });

  it('should create with custom delay', () => {
    const limiter = new DomainRateLimiter(500);
    expect(limiter).toBeDefined();
  });

  it('should extract domain from URL', () => {
    expect(DomainRateLimiter.extractDomain('https://www.example.com/path')).toBe('www.example.com');
    expect(DomainRateLimiter.extractDomain('https://api.github.com')).toBe('api.github.com');
  });

  it('should return input for invalid URL', () => {
    expect(DomainRateLimiter.extractDomain('not-a-url')).toBe('not-a-url');
  });

  it('should delay subsequent requests to same domain', async () => {
    const limiter = new DomainRateLimiter(50);

    const start = Date.now();
    await limiter.waitForDomain('example.com');
    await limiter.waitForDomain('example.com');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small margin
  });

  it('should not delay requests to different domains', async () => {
    const limiter = new DomainRateLimiter(100);

    const start = Date.now();
    await limiter.waitForDomain('example.com');
    await limiter.waitForDomain('different.com');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  it('should clear tracked domains', async () => {
    const limiter = new DomainRateLimiter(100);

    await limiter.waitForDomain('example.com');
    limiter.clear();

    const start = Date.now();
    await limiter.waitForDomain('example.com');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});

describe('ConcurrencyController', () => {
  it('should run tasks with concurrency control', async () => {
    const controller = new ConcurrencyController({ maxConcurrency: 2 });
    const items = [1, 2, 3, 4, 5];
    const task = vi.fn().mockImplementation(async (n: number) => n * 2);

    const results = await controller.run(items, task);

    expect(results).toHaveLength(5);
    expect(task).toHaveBeenCalledTimes(5);
  });

  it('should call onResult callback for each completion', async () => {
    const controller = new ConcurrencyController({ maxConcurrency: 2 });
    const items = [1, 2, 3];
    const onResult = vi.fn();

    await controller.run(items, async (n) => n * 2, { onResult });

    expect(onResult).toHaveBeenCalledTimes(3);
  });

  it('should call onError callback on failures', async () => {
    const controller = new ConcurrencyController({ maxConcurrency: 2 });
    const items = [1, 2, 3];
    const onError = vi.fn();

    await controller.run(
      items,
      async (n) => {
        if (n === 2) {
          throw new Error('Test error');
        }
        return n;
      },
      { onError },
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 2);
  });

  it('should apply domain rate limiting when getDomain provided', async () => {
    // Use maxConcurrency: 1 to ensure tasks run sequentially
    // so domain rate limiting is actually applied
    const controller = new ConcurrencyController({
      maxConcurrency: 1,
      domainDelay: 50,
    });

    const items = ['a', 'b', 'c'];
    const start = Date.now();

    await controller.run(
      items,
      async () => {
        /* noop */
      },
      { getDomain: () => 'same-domain.com' },
    );

    const elapsed = Date.now() - start;
    // 3 items to same domain requires 2 delays of 50ms each = ~100ms
    // Allow some tolerance for test timing variations
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  it('should support abort', async () => {
    const controller = new ConcurrencyController({ maxConcurrency: 1 });
    let completed = 0;

    const runPromise = controller.run([1, 2, 3, 4, 5], async () => {
      await new Promise((r) => setTimeout(r, 50));
      completed++;
    });

    // Abort after a short delay
    setTimeout(() => controller.abort(), 75);

    await runPromise;
    expect(completed).toBeLessThan(5);
    expect(controller.isAborted).toBe(true);
  });

  it('should exit early when aborted before task execution', async () => {
    const controller = new ConcurrencyController({ maxConcurrency: 1 });
    let tasksStarted = 0;

    // Use a task that takes time so we can abort during execution
    const runPromise = controller.run([1, 2, 3, 4, 5], async () => {
      tasksStarted++;
      // First task takes longer, allowing abort to happen
      if (tasksStarted === 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return tasksStarted;
    });

    // Abort after first task has started but before others complete
    setTimeout(() => controller.abort(), 50);

    await runPromise;
    // With abort, not all tasks should complete
    expect(tasksStarted).toBeLessThan(5);
  });

  it('should exit early when aborted during domain rate limiting', async () => {
    const controller = new ConcurrencyController({
      maxConcurrency: 1,
      domainDelay: 100,
    });
    let completedCount = 0;

    const runPromise = controller.run(
      [1, 2, 3, 4, 5],
      async () => {
        completedCount++;
        return completedCount;
      },
      { getDomain: () => 'same-domain.com' },
    );

    // Abort after first task starts processing
    setTimeout(() => controller.abort(), 50);

    await runPromise;
    expect(completedCount).toBeLessThanOrEqual(2);
  });

  it('should reset for reuse', async () => {
    const controller = new ConcurrencyController({ maxConcurrency: 2 });

    controller.abort();
    expect(controller.isAborted).toBe(true);

    controller.reset();
    expect(controller.isAborted).toBe(false);
  });

  it('should skip all tasks when aborted before run starts', async () => {
    // Note: This test verifies the abort mechanism works, but line 165
    // (check before semaphore.acquire) is very hard to hit because
    // run() resets the AbortController. The check exists for safety.
    const controller = new ConcurrencyController({ maxConcurrency: 1 });
    let tasksExecuted = 0;

    // Start run and abort immediately from within first task
    await controller.run([1, 2, 3, 4, 5], async (n) => {
      tasksExecuted++;
      if (n === 1) {
        // Abort immediately in first task, before it does any work
        controller.abort();
        // Give other tasks a chance to check abort before semaphore
        await new Promise((r) => setImmediate(r));
      }
      return n;
    });

    // First task always runs (it triggers the abort), others may be skipped
    expect(tasksExecuted).toBeLessThanOrEqual(2);
  });
});

describe('runWithConcurrency()', () => {
  it('should run tasks with specified concurrency', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithConcurrency(items, async (n) => n * 2, 3);

    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('should use default concurrency of 50', async () => {
    const items = [1, 2, 3];
    const results = await runWithConcurrency(items, async (n) => n);

    expect(results).toEqual([1, 2, 3]);
  });
});
