import { createRequestId, type BridgeRequest, type BridgeResponse } from './protocols';

export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export interface WorkerBridgeOptions {
  timeoutMs?: number;
}

export class WorkerBridge {
  private readonly timeoutMs: number;
  private readonly pending = new Map<string, { resolve: (value: BridgeResponse) => void; reject: (reason?: unknown) => void; timer: ReturnType<typeof setTimeout> | null }>();
  private readonly onMessageBound: (event: MessageEvent) => void;

  constructor(private readonly worker: WorkerLike, options: WorkerBridgeOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.onMessageBound = (event: MessageEvent) => this.onMessage(event);
    this.worker.addEventListener('message', this.onMessageBound);
  }

  send<TRequest = unknown>(type: string, payload: TRequest): Promise<BridgeResponse> {
    const id = createRequestId();
    const request: BridgeRequest<TRequest> = { id, type, payload };

    return new Promise<BridgeResponse>((resolve, reject) => {
      const timer = this.timeoutMs > 0
        ? setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`Bridge request timed out: ${type}`));
          }, this.timeoutMs)
        : null;

      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage(request);
    });
  }

  dispose(): void {
    this.worker.removeEventListener('message', this.onMessageBound);
    for (const pending of this.pending.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      pending.reject(new Error('WorkerBridge disposed'));
    }
    this.pending.clear();
  }

  private onMessage(event: MessageEvent): void {
    const data = event.data as BridgeResponse | undefined;
    if (!data || typeof data !== 'object' || typeof data.id !== 'string') {
      return;
    }

    const pending = this.pending.get(data.id);
    if (!pending) {
      return;
    }

    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    this.pending.delete(data.id);
    pending.resolve(data);
  }
}
