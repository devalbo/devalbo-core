import { WorkerBridge } from '@devalbo/worker-bridge';

// WorkerLike for demo only.
const worker = {
  listeners: new Set<(event: MessageEvent) => void>(),
  postMessage(message: unknown) {
    const req = message as { id: string };
    const event = { data: { id: req.id, ok: true, payload: 'ok' } } as MessageEvent;
    for (const listener of this.listeners) listener(event);
  },
  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  },
  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
};

const bridge = new WorkerBridge(worker);
console.log(await bridge.send('ping', { message: 'hello' }));
bridge.dispose();
