import type React from 'react';
import type { AppConfig, CommandResult, CommandOptions } from '../../../packages/shared/src';
import type { DevalboStore } from '../../../packages/state/src';
import { createCliAppConfig } from '../../../packages/shared/src/app-config';

export {
  createDevalboStore,
  AppConfigProvider,
  useAppConfig,
  StoreContext
} from '../../../packages/state/src';
export { createFilesystemDriver } from '../../../packages/filesystem/src';
export { BrowserConnectivityService } from '../../../packages/shared/src';

type CommandOptionsBase = CommandOptions & {
  store?: DevalboStore;
  cwd?: string;
  setCwd?: (path: string) => void;
  config?: AppConfig;
  createProgram?: () => import('commander').Command;
};

export type ExtendedCommandOptions = CommandOptionsBase | (CommandOptionsBase & { store: DevalboStore });
export type ExtendedCommandOptionsWithStore = CommandOptionsBase & { store: DevalboStore };
export type AsyncCommandHandler = (args: string[], options?: ExtendedCommandOptions) => Promise<CommandResult>;
export type StoreCommandHandler = (args: string[], options: ExtendedCommandOptionsWithStore) => Promise<CommandResult>;
export type CommandHandler = AsyncCommandHandler | StoreCommandHandler;

export const makeResult = (component: React.ReactNode): CommandResult => ({ component });
export const makeOutput = (text: string): CommandResult => ({ component: text });
export const makeError = (message: string): CommandResult => ({ component: message, error: message, status: 'error' });
export const makeResultError = (message: string): CommandResult => makeError(message);

export const mergeCommands = (...groups: Record<string, CommandHandler>[]): Record<string, CommandHandler> =>
  Object.assign({}, ...groups);

const helpCommand: AsyncCommandHandler = async (_args, options) => {
  const program = options?.createProgram?.();
  if (program) {
    const names = program.commands.map((cmd) => cmd.name()).join('\n');
    return makeOutput(names);
  }
  return makeOutput('help');
};

const pwdCommand: AsyncCommandHandler = async (_args, options) => {
  return makeOutput(options?.cwd ?? '/');
};

const cdCommand: AsyncCommandHandler = async (args, options) => {
  const target = args[0] ?? '/';
  options?.setCwd?.(target);
  return makeOutput(target);
};

const appConfigCommand: AsyncCommandHandler = async (_args, options) => {
  const config = options?.config;
  if (!config) return makeOutput('appId: unknown');
  return makeOutput(
    `appId: ${config.appId}\nappName: ${config.appName}\nstorageKey: ${config.storageKey}`
  );
};

export const builtinCommands: Record<string, CommandHandler> = {
  help: helpCommand,
  pwd: pwdCommand,
  cd: cdCommand,
  'app-config': appConfigCommand,
  ls: async () => makeOutput(''),
  tree: async () => makeOutput(''),
  cat: async () => makeOutput(''),
  touch: async () => makeOutput(''),
  mkdir: async () => makeOutput(''),
  cp: async () => makeOutput(''),
  mv: async () => makeOutput(''),
  rm: async () => makeOutput(''),
  stat: async () => makeOutput(''),
  clear: async () => makeOutput(''),
  backend: async () => makeOutput(''),
  exit: async () => makeOutput('')
};

export const registerBuiltinCommands = (program: import('commander').Command): void => {
  program.command('pwd').description('Print working directory');
  program.command('cd <path>').description('Change directory');
  program.command('ls [path]').description('List directory contents');
  program.command('tree [path]').description('Show directory tree');
  program.command('cat <file>').description('Display file contents');
  program.command('touch <file>').description('Create empty file');
  program.command('mkdir <dir>').description('Create directory');
  program.command('cp <src> <dest>').description('Copy file or directory');
  program.command('mv <src> <dest>').description('Move/rename file or directory');
  program.command('rm <path>').description('Remove file or directory');
  program.command('stat <path>').description('Show file/directory info');
  program.command('clear').description('Clear terminal');
  program.command('backend').description('Show filesystem backend info');
  program.command('exit').description('Exit the shell');
  program.command('help').description('Show available commands');
  program.command('app-config').description('Show current app configuration');
};

export const defaultWelcomeMessage = (config?: Pick<AppConfig, 'appName' | 'appId'>): string => {
  const name = config?.appName ?? config?.appId ?? 'CLI shell';
  return `Welcome to ${name}. Type "help" for available commands.`;
};

type CommandRuntimeContext = {
  commands: Record<string, CommandHandler>;
  store: DevalboStore;
  config?: AppConfig;
  cwd: string;
  setCwd: (next: string) => void;
  createProgram?: () => import('commander').Command;
};

type CliRuntimeSource = {
  getContext: () => CommandRuntimeContext | null;
};

let runtimeSource: CliRuntimeSource | null = null;

export const bindCliRuntimeSource = (source: CliRuntimeSource): void => {
  runtimeSource = source;
};

export const unbindCliRuntimeSource = (): void => {
  runtimeSource = null;
};

const extractText = (value: React.ReactNode): string => {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(extractText).join('');
  if (typeof value === 'object' && 'props' in value) {
    const props = (value as { props?: { children?: React.ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
};

const resolveCommand = (name: string, ctx: CommandRuntimeContext): CommandHandler | null => {
  return ctx.commands[name] ?? null;
};

const runCommand = async (name: string, args: string[], ctx: CommandRuntimeContext): Promise<CommandResult> => {
  const command = resolveCommand(name, ctx);
  if (!command) return makeError(`Command not found: ${name}`);
  return command(args, {
    store: ctx.store,
    config: ctx.config,
    cwd: ctx.cwd,
    setCwd: ctx.setCwd,
    createProgram: ctx.createProgram
  } as ExtendedCommandOptionsWithStore);
};

export const cli = {
  exec: async (commandName: string, args: string[] = []): Promise<CommandResult> => {
    const ctx = runtimeSource?.getContext() ?? null;
    if (!ctx) return makeError('CLI not ready');
    return runCommand(commandName, args, ctx);
  },
  execText: async (
    commandName: string,
    args: string[] = []
  ): Promise<{ text: string; error: string | null }> => {
    const result = await cli.exec(commandName, args);
    return {
      text: extractText(result.component),
      error: result.error ?? null
    };
  }
};

export const startInteractiveCli = async (): Promise<void> => {
  throw new Error('startInteractiveCli is not available in vitest shim');
};

export const InteractiveShell = (): null => null;

export { createCliAppConfig };
