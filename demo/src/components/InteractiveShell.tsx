import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '../components/ui/text-input';
import { commands, CommandName, CommandOptions } from '../commands';

interface CommandOutput {
  command: string;
  timestamp: Date;
  component?: React.ReactNode;
  error?: string;
}

export const InteractiveShell: React.FC = () => {
  const [input, setInput] = useState('');
  const [isInteractive, setIsInteractive] = useState(false);
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'Welcome to Demo CLI (ink-web)',
      timestamp: new Date(),
      component: <Text color="cyan">Type "help" to see available commands</Text>
    }
  ]);

  const handleInteractiveComplete = () => {
    setIsInteractive(false);
  };

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim();
    const parts = trimmedCmd.split(' ');
    const commandName = parts[0];

    // Parse args and flags
    const args: string[] = [];
    const options: CommandOptions = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part === '-i' || part === '--interactive') {
        options.interactive = true;
      } else if (part.startsWith('-')) {
        // Skip other flags for now
      } else {
        args.push(part);
      }
    }

    let output: CommandOutput = {
      command: `$ ${trimmedCmd}`,
      timestamp: new Date()
    };

    // Handle special commands
    if (commandName === 'clear') {
      setHistory([{
        command: 'Terminal cleared',
        timestamp: new Date(),
        component: <Text dimColor>Type "help" for available commands</Text>
      }]);
      setInput('');
      return;
    }

    if (!commandName) {
      return;
    }

    // Execute command from shared registry
    const command = commands[commandName.toLowerCase() as CommandName];
    if (command) {
      try {
        // If this is an interactive command, set the flag and pass completion callback
        if (options.interactive) {
          setIsInteractive(true);
          options.onComplete = handleInteractiveComplete;
        }

        const result = command(args, options);
        output.component = result.component;
        output.error = result.error;
      } catch (error) {
        console.error('Command execution error:', error);
        output.error = `Error executing ${commandName}: ${String(error)}`;
        output.component = <Text color="red">{output.error}</Text>;
      }
    } else {
      output.error = `Command not found: ${commandName}. Type "help" for available commands.`;
      output.component = <Text color="red">{output.error}</Text>;
    }

    setHistory([...history, output]);
    setInput('');
  };

  const handleSubmit = () => {
    if (input.trim()) {
      executeCommand(input);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        {history.map((item, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text dimColor>{item.command}</Text>
            {item.component && <Box marginLeft={2}>{item.component}</Box>}
          </Box>
        ))}
      </Box>

      {!isInteractive && (
        <Box>
          <Text color="green">$ </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type a command..."
          />
        </Box>
      )}
    </Box>
  );
};
