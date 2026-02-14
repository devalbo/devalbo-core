# @devalbo/commands

Command registration, parsing, and console-bridge helpers.

## Exports

- `CommandRegistry`
- `parseCommand`, `resolveCommand`
- `withValidation`
- `createConsoleBridge`

## Example

```ts
import { CommandRegistry, createConsoleBridge } from '@devalbo/commands';

const registry = new CommandRegistry();
registry.register({
  name: 'help',
  description: 'Show help',
  handler: () => ({ component: 'help' })
});

const bridge = createConsoleBridge(registry);
bridge.exec('help');
```
