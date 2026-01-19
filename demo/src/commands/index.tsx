import React from 'react';
import { Spinner } from '../components/ui/spinner';
import { Box, Text } from 'ink';
import { PromptGreet } from '../components/PromptGreet';
import { Countdown } from '../components/Countdown';
import { createProgram } from '../program';
import { withValidation } from './with-validation';
import { validateGreetArgs } from '../lib/validate-args';

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
    // If explicitly interactive mode, always show prompt
    if (options?.interactive) {
      const initialName = args.join(' ');
      return {
        component: <PromptGreet initialName={initialName} onComplete={options.onComplete} />
      };
    }

    // Detect environment:
    // - Browser (no process): check if interactive flag explicitly false
    // - Terminal (has process): check TTY for interactivity
    const isBrowser = typeof process === 'undefined';
    const isTerminalTTY = !isBrowser && process.stdin?.isTTY;

    // Browser console explicitly non-interactive (unless interactive=true)
    const shouldPrompt = isBrowser
      ? false  // Browser console: never auto-prompt
      : isTerminalTTY;  // Terminal: prompt if TTY

    // Use Effect validation to auto-prompt for missing arguments
    return withValidation(
      validateGreetArgs(args),
      // On success: render greeting with validated name
      ({ name }) => (
        <Box flexDirection="column" padding={1}>
          <Text color="green">Hello, {name}!</Text>
        </Box>
      ),
      // On missing argument: prompt or use default based on environment
      (error) => {
        if (!shouldPrompt && error.defaultValue) {
          // Non-interactive: use default value
          return (
            <Box flexDirection="column" padding={1}>
              <Text color="green">Hello, {error.defaultValue}!</Text>
            </Box>
          );
        }

        // Interactive: show prompt
        return (
          <PromptGreet
            initialName={error.defaultValue}
            promptMessage={error.message}
            onComplete={options?.onComplete}
          />
        );
      }
    );
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

  countdown: (args?: string[], options?: CommandOptions): CommandResult => {
    return {
      component: <Countdown seconds={5} />
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
