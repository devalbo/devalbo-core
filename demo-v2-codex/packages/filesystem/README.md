# @devalbo/filesystem

Filesystem drivers and watcher abstractions.

## Exports

- `NativeFSDriver`
- `InMemoryDriver`
- `ZenFSDriver` (stub)
- `createWatcherService`

## Example

```ts
import { InMemoryDriver } from '@devalbo/filesystem';
import { asFilePath } from '@devalbo/shared';

const fs = new InMemoryDriver();
await fs.writeFile(asFilePath('/tmp/a.txt'), new TextEncoder().encode('hello'));
```
