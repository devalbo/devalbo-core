import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@devalbo/ui';
import { commands, type CommandName } from '@/commands';
import { BrowserShellProvider } from './BrowserShellProvider';

interface CommandOutput {
  command: string;
  component?: React.ReactNode;
}

function ShellContent() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'Welcome to naveditor',
      component: <Text color="cyan">Try: help, navigate ., edit README.md</Text>
    }
  ]);

  const executeCommand = (raw: string) => {
    const parts = raw.trim().split(/\s+/);
    const commandName = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    if (!commandName) return;

    const command = commands[commandName as CommandName];
    if (!command) {
      setHistory((prev) => [
        ...prev,
        { command: `$ ${raw}`, component: <Text color="red">Command not found: {commandName}</Text> }
      ]);
      setInput('');
      return;
    }

    const result = command(args);
    setHistory((prev) => [...prev, { command: `$ ${raw}`, component: result.component }]);
    setInput('');
  };

  return (
    <Box flexDirection="column" padding={1}>
      {history.map((item, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={1}>
          <Text dimColor>{item.command}</Text>
          {item.component && <Box marginLeft={2}>{item.component}</Box>}
        </Box>
      ))}
      <Box>
        <Text color="green">$ </Text>
        <TextInput value={input} onChange={setInput} onSubmit={executeCommand} placeholder="Type command" />
      </Box>
    </Box>
  );
}

export const InteractiveShell: React.FC = () => (
  <BrowserShellProvider>
    <ShellContent />
  </BrowserShellProvider>
);
