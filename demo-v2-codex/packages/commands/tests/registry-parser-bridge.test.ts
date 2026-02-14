import { describe, expect, it } from 'vitest';
import { CommandRegistry } from '../src/registry';
import { parseCommand, resolveCommand } from '../src/parser';
import { createConsoleBridge } from '../src/console-bridge';

describe('commands registry/parser/bridge', () => {
  it('rejects duplicate command registration', () => {
    const registry = new CommandRegistry();
    const definition = {
      name: 'help',
      description: 'help',
      handler: () => ({ component: null })
    };

    registry.register(definition);
    expect(() => registry.register(definition)).toThrow('Command already registered: help');
  });

  it('resolves hierarchical command input', () => {
    const registry = new CommandRegistry();
    registry.register({
      name: 'fs',
      description: 'filesystem',
      handler: () => ({ component: null }),
      subcommands: [
        {
          name: 'read',
          description: 'read file',
          handler: (args) => ({ component: args.join(',') })
        }
      ]
    });

    const resolved = resolveCommand(registry, 'fs read /tmp/a.txt');
    expect(resolved?.fullName).toBe('fs read');
    expect(resolved?.args).toEqual(['/tmp/a.txt']);
  });

  it('parses flat command input', () => {
    const parsed = parseCommand('navigate .');
    expect(parsed.name).toBe('navigate');
    expect(parsed.args).toEqual(['.']);
  });

  it('executes command through console bridge', () => {
    const bridge = createConsoleBridge({
      ping: (args) => ({ component: `pong:${args[0] ?? ''}` })
    });

    expect(bridge.exec('ping', ['ok']).component).toBe('pong:ok');
    expect(bridge.list()).toEqual(['ping']);
  });
});
