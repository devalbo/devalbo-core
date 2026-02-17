import React from 'react';
import { Box, Text } from 'ink';
import type { CommandOptions, CommandResult } from '@devalbo/shared';
import type { Store } from 'tinybase';

type CommandOptionsBase = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
};

export type ExtendedCommandOptions = CommandOptionsBase | (CommandOptionsBase & { store: Store });
export type ExtendedCommandOptionsWithStore = CommandOptionsBase & { store: Store };

export type AsyncCommandHandler = (args: string[], options?: ExtendedCommandOptions) => Promise<CommandResult>;
export type SocialCommandHandler = (args: string[], options: ExtendedCommandOptionsWithStore) => Promise<CommandResult>;
export type CommandHandler = AsyncCommandHandler | SocialCommandHandler;

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
