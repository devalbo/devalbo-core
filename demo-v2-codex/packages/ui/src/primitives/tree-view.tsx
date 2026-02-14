import React from 'react';
import { Box, Text } from 'ink';
import type { FileEntry } from '@devalbo/shared';

interface TreeViewProps {
  entries: FileEntry[];
}

export const TreeView: React.FC<TreeViewProps> = ({ entries }) => {
  return (
    <Box flexDirection="column">
      {entries.map((entry) => (
        <Text key={entry.path}>
          {entry.isDirectory ? 'd' : 'f'} {entry.name}
        </Text>
      ))}
    </Box>
  );
};
