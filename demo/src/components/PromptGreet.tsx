import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { TextInput } from './ui/text-input';

export interface PromptGreetProps {
  initialName?: string;
  promptMessage?: string;
  onComplete?: (name: string) => void;
}

export const PromptGreet: React.FC<PromptGreetProps> = ({
  initialName = '',
  promptMessage = 'Who would you like to greet?',
  onComplete
}) => {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [finalName, setFinalName] = useState('');

  const handleSubmit = (value: string) => {
    const nameToUse = value.trim() || initialName || 'World';
    setFinalName(nameToUse);
    setSubmitted(true);
    onComplete?.(nameToUse);
  };

  if (submitted) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">Hello, {finalName}!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Interactive Greeter</Text>
      <Box marginTop={1}>
        <Text>{promptMessage} </Text>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={name}
          onChange={setName}
          onSubmit={handleSubmit}
          placeholder={initialName || 'World'}
          prompt="Name: "
          promptColor="cyan"
          focus
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to submit</Text>
      </Box>
    </Box>
  );
};
