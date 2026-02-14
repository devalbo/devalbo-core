export interface SharedBufferHandle {
  id: string;
  buffer: SharedArrayBuffer;
  bytes: Uint8Array;
}

export class SharedBufferPool {
  private readonly buffers = new Map<string, SharedBufferHandle>();

  static isSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
  }

  allocate(id: string, size: number): SharedBufferHandle {
    if (!SharedBufferPool.isSupported()) {
      throw new Error('SharedArrayBuffer is not available in this runtime');
    }

    const existing = this.buffers.get(id);
    if (existing && existing.buffer.byteLength >= size) {
      return existing;
    }

    const buffer = new SharedArrayBuffer(size);
    const handle: SharedBufferHandle = {
      id,
      buffer,
      bytes: new Uint8Array(buffer)
    };
    this.buffers.set(id, handle);
    return handle;
  }

  get(id: string): SharedBufferHandle | undefined {
    return this.buffers.get(id);
  }

  release(id: string): boolean {
    return this.buffers.delete(id);
  }

  clear(): void {
    this.buffers.clear();
  }
}
