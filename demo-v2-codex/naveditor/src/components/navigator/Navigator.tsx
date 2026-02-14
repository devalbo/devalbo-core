import React from 'react';
import { Box, Text } from 'ink';
import { useFileTree } from '@/hooks/use-file-tree';
import { FileTree } from './FileTree';
import { NavigatorStatusBar } from './NavigatorStatusBar';

export const Navigator: React.FC<{ rootPath: string }> = ({ rootPath }) => {
  const { entries } = useFileTree({ rootPath });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Navigator</Text>
      <FileTree rootPath={rootPath} />
      <NavigatorStatusBar path={rootPath} fileCount={entries.length} />
    </Box>
  );
};
