/**
 * Tests for RunLifecycle
 */

import { describe, it, expect, vi } from 'vitest';
import { RunLifecycle } from '../src/RunLifecycle.js';

describe('RunLifecycle', () => {
  it('should link external abort signals', () => {
    const lifecycle = new RunLifecycle();
    const controller = new AbortController();

    lifecycle.linkSignal(controller.signal);
    controller.abort();

    expect(lifecycle.isAborted).toBe(true);
    lifecycle.dispose();
  });

  it('should abort immediately when linking an already aborted signal', () => {
    const lifecycle = new RunLifecycle();
    const controller = new AbortController();
    controller.abort();

    lifecycle.linkSignal(controller.signal);

    expect(lifecycle.signal.aborted).toBe(true);
    lifecycle.dispose();
  });

  it('should add and remove process signal handlers', () => {
    const lifecycle = new RunLifecycle();
    const handler = vi.fn<() => void>();
    const initialListenerCount = process.listenerCount('SIGINT');

    lifecycle.addProcessSignal('SIGINT', handler);
    expect(process.listenerCount('SIGINT')).toBe(initialListenerCount + 1);

    process.emit('SIGINT');
    expect(handler).toHaveBeenCalledTimes(1);

    lifecycle.dispose();
    expect(process.listenerCount('SIGINT')).toBe(initialListenerCount);
  });

  it('should support manual abort', () => {
    const lifecycle = new RunLifecycle();

    lifecycle.abort();
    lifecycle.abort();

    expect(lifecycle.isAborted).toBe(true);
    lifecycle.dispose();
  });
});
