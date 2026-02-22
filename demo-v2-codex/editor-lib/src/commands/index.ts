import type { CommandHandler, ExtendedCommandOptions } from '@devalbo/cli-shell';
import { filesystemCommands, systemCommands, appCommands } from '@devalbo/cli-shell';
import { ioCommands } from './io';
import { solidCommands } from './solid';
import { personaCommand } from './persona';
import { contactCommand } from './contact';
import { groupCommand } from './group';
import { filesCommands } from './files';

type CoreCommandName =
  | keyof typeof filesystemCommands
  | keyof typeof systemCommands
  | keyof typeof ioCommands
  | keyof typeof solidCommands
  | keyof typeof filesCommands
  | keyof typeof appCommands;

type SocialCommandName = 'persona' | 'contact' | 'group';
type AliasCommandName = 'navigate' | 'edit';
export type CommandName = CoreCommandName | SocialCommandName | AliasCommandName;

type CommandMap = Record<CommandName, CommandHandler>;

const baseCommands = {
  ...filesystemCommands,
  ...systemCommands,
  ...ioCommands,
  ...solidCommands,
  ...filesCommands,
  ...appCommands
} as const;

export const commands: CommandMap = {
  ...baseCommands,
  persona: personaCommand,
  contact: contactCommand,
  group: groupCommand,
  navigate: async (args: string[], options?: ExtendedCommandOptions) => filesystemCommands.ls(args, options),
  edit: async (args: string[], options?: ExtendedCommandOptions) => filesystemCommands.cat(args, options)
};
