import React from 'react';
import { Spinner } from '../components/ui/spinner';
import { Box, Text } from 'ink';
import { PromptGreet } from '../components/PromptGreet';
import { createProgram } from '../program';

export interface CommandResult {
  component: React.ReactNode;
  error?: string;
}

export interface CommandOptions {
  interactive?: boolean;
  onComplete?: () => void;
}

export const commands = {
  greet: (args: string[], options?: CommandOptions): CommandResult => {
    // If interactive mode, return the prompt component
    if (options?.interactive) {
      const initialName = args.join(' ');
      return {
        component: <PromptGreet initialName={initialName} onComplete={options.onComplete} />
      };
    }

    // Otherwise, return immediate greeting
    const name = args.join(' ') || 'World';
    return {
      component: (
        <Box flexDirection="column" padding={1}>
          <Text color="green">Hello, {name}!</Text>
        </Box>
      )
    };
  },

  info: (args?: string[], options?: CommandOptions): CommandResult => {
    return {
      component: (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">Demo CLI Application</Text>
          <Text>Version: 1.0.0</Text>
          <Text>Built following devalbo-core principles</Text>
          <Text>Supports both terminal and web browser environments</Text>
          <Box marginTop={1}>
            <Text dimColor>Features: Ink UI, React, TypeScript, Vite, Vitest</Text>
          </Box>
        </Box>
      )
    };
  },

  loading: (args?: string[], options?: CommandOptions): CommandResult => {
    return {
      component: <Spinner type="dots" />
    };
  },

  help: (args?: string[], options?: CommandOptions): CommandResult => {
    // Generate help text from Commander's configuration
    // Works in both browser and terminal
    const program = createProgram();
    const lines: string[] = [];

    lines.push(`Usage: ${program.name()} [options] [command]`);
    lines.push('');
    lines.push(program.description());
    lines.push('');
    lines.push('Options:');
    lines.push('  -V, --version              output the version number');
    lines.push('  -h, --help                 display help for command');
    lines.push('');
    lines.push('Commands:');

    // Generate command list from Commander's configuration
    program.commands.forEach(cmd => {
      const name = cmd.name();
      const args = cmd.registeredArguments?.map(arg =>
        `[${arg.name()}${arg.variadic ? '...' : ''}]`
      ).join(' ') || '';
      const opts = cmd.options?.length > 0 ? '[options] ' : '';
      const desc = cmd.description();
      const fullName = `${name} ${opts}${args}`.trim();
      lines.push(`  ${fullName.padEnd(27)} ${desc}`);
    });

    const helpText = lines.join('\n');

    return {
      component: (
        <Box flexDirection="column">
          <Text>{helpText}</Text>
        </Box>
      )
    };
  }
};

export type CommandName = keyof typeof commands;
