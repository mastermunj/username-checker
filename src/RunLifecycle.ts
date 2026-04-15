/**
 * RunLifecycle - link abort signals and process listeners to a single run context.
 */

export class RunLifecycle {
  private readonly abortController = new AbortController();
  private readonly linkedSignals = new Map<AbortSignal, () => void>();
  private readonly processHandlers = new Map<NodeJS.Signals, () => void>();

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  get isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  linkSignal(signal?: AbortSignal): void {
    if (!signal) {
      return;
    }

    if (signal.aborted) {
      this.abort();
      return;
    }

    const handler = () => this.abort();
    signal.addEventListener('abort', handler, { once: true });
    this.linkedSignals.set(signal, handler);
  }

  addProcessSignal(signalName: NodeJS.Signals, handler: () => void): void {
    process.once(signalName, handler);
    this.processHandlers.set(signalName, handler);
  }

  abort(): void {
    this.abortController.abort();
  }

  dispose(): void {
    for (const [signal, handler] of this.linkedSignals.entries()) {
      signal.removeEventListener('abort', handler);
    }
    this.linkedSignals.clear();

    for (const [signalName, handler] of this.processHandlers.entries()) {
      process.off(signalName, handler);
    }
    this.processHandlers.clear();
  }
}
