import type { CommandDefinition } from './types';

export class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): this {
    if (this.commands.has(command.name)) {
      throw new Error(`Command already registered: ${command.name}`);
    }
    this.commands.set(command.name, command);
    return this;
  }

  get(name: string): CommandDefinition | undefined {
    const path = name.trim().split(/\s+/).filter((value): value is string => value.length > 0);
    if (path.length === 0) {
      return undefined;
    }
    const first = path[0];
    if (!first) {
      return undefined;
    }

    let current = this.commands.get(first);
    for (let index = 1; index < path.length && current; index += 1) {
      const token = path[index];
      if (!token) {
        break;
      }
      current = current.subcommands?.find((candidate) => candidate.name === token);
    }
    return current;
  }

  list(): CommandDefinition[] {
    return [...this.commands.values()];
  }

  listFlattened(prefix = ''): Array<{ path: string; command: CommandDefinition }> {
    const lines: Array<{ path: string; command: CommandDefinition }> = [];
    const walk = (command: CommandDefinition, currentPrefix: string) => {
      const nextPath = currentPrefix ? `${currentPrefix} ${command.name}` : command.name;
      lines.push({ path: nextPath, command });
      for (const child of command.subcommands ?? []) {
        walk(child, nextPath);
      }
    };

    for (const command of this.commands.values()) {
      walk(command, prefix);
    }

    return lines;
  }

  getHelp(appName = 'app'): string {
    const lines = [`Usage: ${appName} <command> [args]`, '', 'Commands:'];
    for (const { path, command } of this.listFlattened()) {
      lines.push(`  ${path.padEnd(20)} ${command.description}`);
    }
    return lines.join('\n');
  }
}
