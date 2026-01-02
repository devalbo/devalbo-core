import React from 'react';
import { Spinner } from '../components/ui/spinner';
import { Box, Text } from 'ink';
import { PromptGreet } from '../components/PromptGreet';

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
    return {
      component: (
        <Box flexDirection="column">
          <Text bold color="yellow">Available Commands:</Text>
          <Text>  greet [name] [-i|--interactive]  - Greet someone (default: World)</Text>
          <Text>  info                             - Show application info</Text>
          <Text>  loading                          - Show loading spinner</Text>
          <Text>  clear                            - Clear the terminal</Text>
          <Text>  help                             - Show this help message</Text>
          <Box marginTop={1}>
            <Text dimColor>Use -i or --interactive with greet for interactive prompts</Text>
          </Box>
        </Box>
      )
    };
  }
};

export type CommandName = keyof typeof commands;
