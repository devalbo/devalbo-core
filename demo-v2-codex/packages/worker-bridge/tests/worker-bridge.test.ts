import { describe, expect, it } from 'vitest';
import { WorkerBridge } from '../src/bridge';
import { SharedBufferPool } from '../src/shared-buffer';

class FakeWorker {
  private listeners = new Set<(event: MessageEvent) => void>();

  postMessage(message: unknown): void {
    const request = message as { id: string };
    const response = { id: request.id, ok: true as const, payload: 'ok' };
    const event = { data: response } as MessageEvent;
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.delete(listener);
  }
}

describe('worker-bridge', () => {
  it('sends request and resolves response', async () => {
    const bridge = new WorkerBridge(new FakeWorker(), { timeoutMs: 1000 });
    const response = await bridge.send('ping', { value: 1 });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.payload).toBe('ok');
    }

    bridge.dispose();
  });

  it('allocates and releases shared buffers when supported', () => {
    if (!SharedBufferPool.isSupported()) {
      expect(SharedBufferPool.isSupported()).toBe(false);
      return;
    }

    const pool = new SharedBufferPool();
    const handle = pool.allocate('buf', 32);
    expect(handle.buffer.byteLength).toBe(32);
    expect(pool.get('buf')).toBeDefined();
    expect(pool.release('buf')).toBe(true);
  });
});
