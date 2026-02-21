import { Box, Text } from 'ink';
import type { AppConfig, CommandOptions, CommandResult, IConnectivityService } from '@devalbo/shared';
import type { SolidSession } from '@devalbo/solid-client';
import type { Store } from 'tinybase';
import type { IFilesystemDriver } from '@devalbo/filesystem';

type CommandOptionsBase = CommandOptions & {
  cwd?: string;
  setCwd?: (nextCwd: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
  session?: SolidSession | null;
  config?: AppConfig;
  driver?: IFilesystemDriver;
  connectivity?: IConnectivityService;
};

export type ExtendedCommandOptions = CommandOptionsBase | (CommandOptionsBase & { store: Store });
export type ExtendedCommandOptionsWithStore = CommandOptionsBase & { store: Store };
export type ExtendedCommandOptionsWithSession = CommandOptionsBase & {
  store: Store;
  session: SolidSession;
};

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
