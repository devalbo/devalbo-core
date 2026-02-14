import type { DevalboStore } from '../store';

export class MemoryPersister {
  constructor(private readonly _store: DevalboStore) {}

  async startAutoLoad(): Promise<void> {}
  async startAutoSave(): Promise<void> {}
  async stopAutoLoad(): Promise<void> {}
  async stopAutoSave(): Promise<void> {}
}
