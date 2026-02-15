import React from 'react';
import { Box, Text } from 'ink';

export const LineNumbers: React.FC<{ lineCount: number }> = ({ lineCount }) => (
  <Box flexDirection="column" marginRight={1}>
    {Array.from({ length: lineCount }, (_, i) => (
      <Text key={i} dimColor>{String(i + 1).padStart(3, ' ')}</Text>
    ))}
  </Box>
);
