export class AtomicsSignal {
  static isSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined';
  }

  constructor(private readonly state: Int32Array) {}

  notify(value = 1): void {
    Atomics.store(this.state, 0, value);
    Atomics.notify(this.state, 0);
  }

  wait(expected = 0, timeoutMs?: number): 'ok' | 'timed-out' {
    const result = Atomics.wait(this.state, 0, expected, timeoutMs);
    return result === 'timed-out' ? 'timed-out' : 'ok';
  }

  reset(): void {
    Atomics.store(this.state, 0, 0);
  }
}

export class AtomicsLock {
  constructor(private readonly state: Int32Array) {}

  lock(timeoutMs?: number): boolean {
    const start = Date.now();
    while (true) {
      if (Atomics.compareExchange(this.state, 0, 0, 1) === 0) {
        return true;
      }

      const remaining = timeoutMs == null ? undefined : Math.max(timeoutMs - (Date.now() - start), 0);
      if (remaining === 0) {
        return false;
      }

      Atomics.wait(this.state, 0, 1, remaining);
    }
  }

  unlock(): void {
    Atomics.store(this.state, 0, 0);
    Atomics.notify(this.state, 0, 1);
  }
}
