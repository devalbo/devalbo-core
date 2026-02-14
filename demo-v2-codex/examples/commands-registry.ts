import { CommandRegistry, createConsoleBridge } from '@devalbo/commands';

const registry = new CommandRegistry();
registry.register({
  name: 'hello',
  description: 'Print hello',
  handler: (args) => ({ component: `Hello ${args[0] ?? 'world'}` })
});

const bridge = createConsoleBridge(registry);
console.log(bridge.exec('hello', ['devalbo']));
