import type { DevalboStore } from '../store';

export class SqliteBrowserPersister {
  constructor(private readonly _store: DevalboStore, private readonly _dbPath: string) {}

  async startAutoLoad(): Promise<void> {
    throw new Error('SQLite browser persister is not implemented yet');
  }

  async startAutoSave(): Promise<void> {
    throw new Error('SQLite browser persister is not implemented yet');
  }
}
