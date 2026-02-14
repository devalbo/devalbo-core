import { createStore, type Store } from 'tinybase';

export const createDevalboStore = (): Store => {
  const store = createStore();

  store.setTablesSchema({
    entries: {
      path: { type: 'string' },
      name: { type: 'string' },
      parentPath: { type: 'string' },
      isDirectory: { type: 'boolean' },
      size: { type: 'number' },
      mtime: { type: 'string' }
    },
    buffers: {
      path: { type: 'string' },
      content: { type: 'string' },
      isDirty: { type: 'boolean' },
      cursorLine: { type: 'number' },
      cursorCol: { type: 'number' }
    }
  });

  return store;
};

export type DevalboStore = Store;
