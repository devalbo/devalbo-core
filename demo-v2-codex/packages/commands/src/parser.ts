import type { CommandDefinition } from './types';
import type { CommandRegistry } from './registry';

export interface ParsedCommand {
  fullName: string;
  path: string[];
  name: string;
  args: string[];
}

export interface ResolvedCommand extends ParsedCommand {
  command: CommandDefinition;
}

const splitInput = (input: string | string[]): string[] => {
  if (Array.isArray(input)) {
    return input.map((value) => value.trim()).filter((value): value is string => value.length > 0);
  }
  return input.trim().split(/\s+/).filter((value): value is string => value.length > 0);
};

export const parseCommand = (input: string | string[]): ParsedCommand => {
  const parts = splitInput(input);
  const first = parts[0];
  return {
    fullName: first ?? '',
    path: first ? [first] : [],
    name: first ?? '',
    args: parts.slice(1)
  };
};

export const resolveCommand = (registry: CommandRegistry, input: string | string[]): ResolvedCommand | undefined => {
  const parts = splitInput(input);
  if (parts.length === 0) {
    return undefined;
  }
  const first = parts[0];
  if (!first) {
    return undefined;
  }

  const path: string[] = [];
  const initial = registry.get(first);
  if (!initial) {
    return undefined;
  }
  let current: CommandDefinition = initial;

  path.push(first);
  let index = 1;
  while (index < parts.length) {
    const token = parts[index];
    if (!token) {
      break;
    }

    const child = (current.subcommands ?? []).find((candidate: CommandDefinition) => candidate.name === token);
    if (!child) {
      break;
    }
    current = child;
    path.push(token);
    index += 1;
  }

  return {
    fullName: path.join(' '),
    path,
    name: current.name,
    args: parts.slice(index),
    command: current
  };
};
