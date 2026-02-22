import { parseCommand } from '@devalbo/commands';
import type { AppConfig, CommandResult, IConnectivityService } from '@devalbo/shared';
import type { DevalboStore } from '@devalbo/state';
import type { SolidSession } from '@devalbo/solid-client';
import type { IFilesystemDriver } from '@devalbo/filesystem';
import { commands, type CommandName } from '@/commands';
import { makeError, makeOutput, type ExtendedCommandOptions } from '@/commands/_util';

export type CommandRuntimeContext = {
  store: DevalboStore;
  session?: SolidSession | null;
  config?: AppConfig;
  driver?: IFilesystemDriver | null;
  connectivity?: IConnectivityService;
  cwd: string;
  setCwd: (next: string) => void;
  clearScreen?: () => void;
  exit?: () => void;
};

export const parseCommandLine = (raw: string): { commandName: string; args: string[] } => {
  const { name, args } = parseCommand(raw);
  return { commandName: name, args };
};

const notReady = (): CommandResult => makeError('CLI not ready');

export const buildCommandOptions = (ctx: CommandRuntimeContext): ExtendedCommandOptions => ({
  store: ctx.store,
  cwd: ctx.cwd,
  setCwd: ctx.setCwd,
  ...(ctx.session !== undefined ? { session: ctx.session } : {}),
  ...(ctx.config !== undefined ? { config: ctx.config } : {}),
  ...(ctx.driver ? { driver: ctx.driver } : {}),
  ...(ctx.connectivity ? { connectivity: ctx.connectivity } : {}),
  ...(ctx.clearScreen ? { clearScreen: ctx.clearScreen } : {}),
  ...(ctx.exit ? { exit: ctx.exit } : {})
});

export const executeCommand = async (
  commandName: CommandName,
  args: string[],
  ctx: CommandRuntimeContext | null
): Promise<CommandResult> => {
  if (!ctx) return notReady();
  const command = commands[commandName];
  if (!command) {
    return makeError(`Command not found: ${commandName}`);
  }

  try {
    return await command(args, buildCommandOptions(ctx) as ExtendedCommandOptions & { store: DevalboStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return makeError(message);
  }
};

export const executeCommandRaw = async (raw: string, ctx: CommandRuntimeContext | null): Promise<CommandResult> => {
  if (!ctx) return notReady();
  const { commandName, args } = parseCommandLine(raw);
  if (!commandName) return makeOutput('');

  return executeCommand(commandName as CommandName, args, ctx);
};
