import { describe, expect, it } from 'vitest';
import { createDevalboStore } from '../src/store';
import { MemoryPersister } from '../src/persisters/memory';

describe('state store', () => {
  it('creates store with entries and buffers schema', () => {
    const store = createDevalboStore();

    expect(store.hasTable('entries')).toBe(false);
    expect(store.hasTable('buffers')).toBe(false);

    store.setCell('entries', 'row-1', 'name', 'README.md');
    expect(store.getCell('entries', 'row-1', 'name')).toBe('README.md');
  });

  it('memory persister lifecycle methods resolve', async () => {
    const store = createDevalboStore();
    const persister = new MemoryPersister(store);

    await expect(persister.startAutoLoad()).resolves.toBeUndefined();
    await expect(persister.startAutoSave()).resolves.toBeUndefined();
    await expect(persister.stopAutoLoad()).resolves.toBeUndefined();
    await expect(persister.stopAutoSave()).resolves.toBeUndefined();
  });
});
