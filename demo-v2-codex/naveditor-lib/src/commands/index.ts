import type { AsyncCommandHandler } from './_util';
import { filesystemCommands } from './filesystem';
import { ioCommands } from './io';
import { systemCommands } from './system';

type CoreCommandName =
  | keyof typeof filesystemCommands
  | keyof typeof systemCommands
  | keyof typeof ioCommands;

type AliasCommandName = 'navigate' | 'edit';
export type CommandName = CoreCommandName | AliasCommandName;

type CommandMap = Record<CommandName, AsyncCommandHandler>;

const baseCommands = {
  ...filesystemCommands,
  ...systemCommands,
  ...ioCommands
} as const;

export const commands: CommandMap = {
  ...baseCommands,
  navigate: async (args, options) => filesystemCommands.ls(args, options),
  edit: async (args, options) => filesystemCommands.cat(args, options)
};
