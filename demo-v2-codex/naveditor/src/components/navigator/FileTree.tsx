import React from 'react';
import { Box, Text } from 'ink';
import { FileTreeItem } from './FileTreeItem';
import { useFileTree } from '@/hooks/use-file-tree';

export const FileTree: React.FC<{ rootPath: string }> = ({ rootPath }) => {
  const { entries, selectedPath, isLoading, error } = useFileTree({ rootPath });

  if (isLoading) {
    return <Text>Loading files...</Text>;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  return (
    <Box flexDirection="column">
      {entries.map((entry) => (
        <FileTreeItem key={entry.path} entry={entry} selected={selectedPath === entry.path} />
      ))}
    </Box>
  );
};
