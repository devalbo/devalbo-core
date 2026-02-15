import React from 'react';
import { Box, Text } from 'ink';
import { LineNumbers } from './LineNumbers';

export const EditorContent: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <Box>
      <LineNumbers lineCount={lines.length} />
      <Box flexDirection="column">
        {lines.map((line, idx) => (
          <Text key={idx}>{line || ' '}</Text>
        ))}
      </Box>
    </Box>
  );
};
