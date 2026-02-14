import React from 'react';
import { Box } from 'ink';

interface ScrollAreaProps {
  children: React.ReactNode;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children }) => (
  <Box flexDirection="column">{children}</Box>
);
