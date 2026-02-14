import React from 'react';
import { Box, Text } from 'ink';

export const InteractiveShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <Box flexDirection="column" padding={1}>
    <Text color="cyan">Interactive shell</Text>
    {children}
  </Box>
);
