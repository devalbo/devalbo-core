# @devalbo/shared

Shared primitives across devalbo packages.

## Exports

- branded path helpers: `asFilePath`, `asDirectoryPath`
- platform detection: `detectPlatform`
- DI container: `ServiceContainer`
- typed errors: `MissingArgument`, `FileNotFound`

## Example

```ts
import { detectPlatform, asFilePath } from '@devalbo/shared';

const env = detectPlatform();
const file = asFilePath('/tmp/demo.txt');
```
