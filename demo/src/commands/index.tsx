import React from 'react';
import { Spinner } from '../components/ui/spinner';
import { Box, Text } from 'ink';

export interface CommandResult {
  component: React.ReactNode;
  error?: string;
}

export const commands = {
  greet: (args: string[]): CommandResult => {
    const name = args.join(' ') || 'World';
    return {
      component: (
        <Box flexDirection="column" padding={1}>
          <Text color="green">Hello, {name}!</Text>
        </Box>
      )
    };
  },

  info: (): CommandResult => {
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

  loading: (): CommandResult => {
    return {
      component: <Spinner type="dots" />
    };
  },

  help: (): CommandResult => {
    return {
      component: (
        <Box flexDirection="column">
          <Text bold color="yellow">Available Commands:</Text>
          <Text>  greet [name]  - Greet someone (default: World)</Text>
          <Text>  info          - Show application info</Text>
          <Text>  loading       - Show loading spinner</Text>
          <Text>  clear         - Clear the terminal</Text>
          <Text>  help          - Show this help message</Text>
        </Box>
      )
    };
  }
};

export type CommandName = keyof typeof commands;
