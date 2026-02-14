import React from 'react';
import { Box, Text } from 'ink';
import type { CommandOptions, CommandResult } from '@devalbo/shared';
import { createProgram } from '@/program';
import { editCommand } from './edit';
import { navigateCommand } from './navigate';

export const commands = {
  navigate: (args: string[], _options?: CommandOptions): CommandResult => navigateCommand(args),
  edit: (args: string[], _options?: CommandOptions): CommandResult => editCommand(args),
  help: (_args?: string[], _options?: CommandOptions): CommandResult => {
    const program = createProgram();
    const lines: string[] = [];

    lines.push(`Usage: ${program.name()} [options] [command]`);
    lines.push('');
    lines.push(program.description());
    lines.push('');
    lines.push('Commands:');

    for (const cmd of program.commands) {
      const args = cmd.registeredArguments?.map((arg) => arg.required ? `<${arg.name()}>` : `[${arg.name()}]`).join(' ') || '';
      lines.push(`  ${(cmd.name() + ' ' + args).trim().padEnd(20)} ${cmd.description()}`);
    }

    return {
      component: (
        <Box flexDirection="column" padding={1}>
          <Text>{lines.join('\n')}</Text>
        </Box>
      )
    };
  }
};

export type CommandName = keyof typeof commands;
