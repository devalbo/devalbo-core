# @devalbo/state

TinyBase store factory, schemas, persister wrappers, and React hooks.

## Exports

- `createDevalboStore`
- `MemoryPersister`
- schema constants (`FILE_TREE_TABLE`, `EDITOR_BUFFER_TABLE`)
- hooks: `StoreContext`, `useStore`, `useTable`

## Example

```ts
import { createDevalboStore } from '@devalbo/state';

const store = createDevalboStore();
store.setCell('entries', '1', 'name', 'README.md');
```
