import { Box, Text } from 'ink';
import React from 'react';
import type { AppConfig, CommandOptions, CommandResult, IConnectivityService } from '@devalbo/shared';
import type { Store } from 'tinybase';
import type { IFilesystemDriver } from '@devalbo/filesystem';

type CommandOptionsBase = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
  session?: unknown | null;
  config?: AppConfig;
  driver?: IFilesystemDriver;
  connectivity?: IConnectivityService;
  createProgram?: () => import('commander').Command;
};

export type ExtendedCommandOptions = CommandOptionsBase | (CommandOptionsBase & { store: Store });
export type ExtendedCommandOptionsWithStore = CommandOptionsBase & { store: Store };

export type AsyncCommandHandler = (args: string[], options?: ExtendedCommandOptions) => Promise<CommandResult>;
export type StoreCommandHandler = (args: string[], options: ExtendedCommandOptionsWithStore) => Promise<CommandResult>;
export type CommandHandler = AsyncCommandHandler | StoreCommandHandler;

export const makeOutput = (text: string): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text>{text}</Text>
    </Box>
  )
});

export const makeError = (message: string): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text color="red">{message}</Text>
    </Box>
  ),
  error: message
});

export const makeResult = (text: string, data: unknown): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text>{text}</Text>
    </Box>
  ),
  data,
  status: 'ok'
});

export const makeResultError = (message: string, data?: unknown): CommandResult => ({
  component: (
    <Box flexDirection="column" padding={1}>
      <Text color="red">{message}</Text>
    </Box>
  ),
  error: message,
  data,
  status: 'error'
});

/**
 * Merge multiple command groups into a single record, throwing on duplicates.
 *
 * Use this instead of object spread (`{ ...groupA, ...groupB }`) to catch
 * accidental command name collisions at startup rather than silently
 * shadowing one handler with another.
 *
 * @throws {Error} if any command name appears in more than one group
 *
 * @example
 * ```ts
 * import { mergeCommands, builtinCommands } from '@devalbo/cli-shell';
 *
 * export const commands = mergeCommands(builtinCommands, myAppCommands);
 * ```
 */
export const mergeCommands = (...groups: Record<string, CommandHandler>[]): Record<string, CommandHandler> => {
  const merged: Record<string, CommandHandler> = {};
  for (const group of groups) {
    for (const [name, handler] of Object.entries(group)) {
      if (name in merged) {
        throw new Error(`Duplicate command registration: "${name}"`);
      }
      merged[name] = handler;
    }
  }
  return merged;
};
