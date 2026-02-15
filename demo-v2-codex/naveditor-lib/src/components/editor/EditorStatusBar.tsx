import React from 'react';
import { Box, Text } from 'ink';

export const EditorStatusBar: React.FC<{ filePath: string; isDirty: boolean }> = ({ filePath, isDirty }) => (
  <Box borderStyle="single" paddingX={1}>
    <Text dimColor>
      {filePath} | {isDirty ? 'modified' : 'saved'}
    </Text>
  </Box>
);
