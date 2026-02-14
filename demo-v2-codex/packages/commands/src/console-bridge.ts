import type { CommandHandler } from '@devalbo/shared';
import { resolveCommand } from './parser';
import { CommandRegistry } from './registry';

const toRegistry = (commandsOrRegistry: Record<string, CommandHandler> | CommandRegistry): CommandRegistry => {
  if (commandsOrRegistry instanceof CommandRegistry) {
    return commandsOrRegistry;
  }

  const registry = new CommandRegistry();
  for (const [name, handler] of Object.entries(commandsOrRegistry)) {
    registry.register({
      name,
      description: `${name} command`,
      handler
    });
  }
  return registry;
};

export const createConsoleBridge = (commandsOrRegistry: Record<string, CommandHandler> | CommandRegistry) => {
  const registry = toRegistry(commandsOrRegistry);

  const exec = (input: string, args: string[] = []) => {
    const resolved = resolveCommand(registry, args.length > 0 ? [input, ...args] : input);
    if (!resolved) {
      throw new Error(`Command not found: ${input}`);
    }

    return resolved.command.handler(resolved.args);
  };

  const methods = Object.fromEntries(
    registry.listFlattened().map(({ path, command }) => [path, (args: string[] = []) => command.handler(args)])
  );

  return {
    exec,
    help: (appName = 'app') => registry.getHelp(appName),
    list: () => registry.listFlattened().map(({ path }) => path),
    ...methods
  };
};
