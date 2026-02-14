import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  text: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({ text }) => (
  <Box borderStyle="single" paddingX={1}>
    <Text dimColor>{text}</Text>
  </Box>
);
