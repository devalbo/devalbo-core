import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '../components/ui/text-input';
import { commands, CommandName } from '../commands';

interface CommandOutput {
  command: string;
  timestamp: Date;
  component?: React.ReactNode;
  error?: string;
}

export const InteractiveShell: React.FC = () => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'Welcome to Demo CLI (ink-web)',
      timestamp: new Date(),
      component: <Text color="cyan">Type "help" to see available commands</Text>
    }
  ]);

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim();
    const [commandName, ...args] = trimmedCmd.split(' ');

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
      const result = command(args);
      output.component = result.component;
      output.error = result.error;
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

      <Box>
        <Text color="green">$ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a command..."
        />
      </Box>
    </Box>
  );
};
